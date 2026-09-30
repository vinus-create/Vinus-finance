// Balance-trigger regression test: runs migration 002 on a real Postgres (PGlite)
// on top of the migration-001 trigger and checks every balance scenario.
// Run (does not touch package.json):
//   npm i --no-save @electric-sql/pglite@0.3 && node supabase/tests/balance-trigger.test.mjs
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../migrations/', import.meta.url)
const m001 = readFileSync(new URL('001_automation_foundation.sql', ROOT), 'utf8')
const oldTrigger = m001.slice(m001.indexOf('CREATE OR REPLACE FUNCTION public.fn_apply_txn_to_balances('),
                              m001.indexOf('FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();') +
                              'FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();'.length)
const m002 = readFileSync(new URL('002_integrity_and_security.sql', ROOT), 'utf8')

const U = '11111111-1111-1111-1111-111111111111'
const SCHEMA = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
  CREATE TABLE accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text, account_type text,
    balance numeric DEFAULT 0, last_statement_date date, updated_at timestamptz, is_active bool DEFAULT true);
  CREATE TABLE transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, amount numeric,
    account_name text, to_account_name text, transaction_date date);
  CREATE TABLE monthly_bills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, auto_deduct_account text);
  CREATE TABLE app_config (key text PRIMARY KEY, value text);
  CREATE TABLE api_usage (day date, tier text, count int, PRIMARY KEY (day, tier));
  CREATE FUNCTION increment_api_usage(p_tier text) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
  CREATE TABLE foo_unprotected (id int, user_id uuid);
  CREATE TABLE bar_protected (id int, user_id uuid);
  ALTER TABLE bar_protected ENABLE ROW LEVEL SECURITY;
  -- mirror production: these already have RLS (verified live: rows exist, anon reads 0)
  ALTER TABLE accounts ENABLE ROW LEVEL SECURITY; ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE monthly_bills ENABLE ROW LEVEL SECURITY;
`
const accounts = `
  INSERT INTO accounts (user_id, name, account_type, balance, last_statement_date) VALUES
    ('${U}', 'Maybank',     'bank',        1000, '2026-06-30'),
    ('${U}', 'TNG eWallet', 'ewallet',       50, NULL),
    ('${U}', 'UOB ONE',     'credit_card', -500, '2026-07-18');
  INSERT INTO monthly_bills (user_id, auto_deduct_account) VALUES ('${U}', 'Maybank');
`
const bal = async (db, name) =>
  Number((await db.query(`SELECT balance FROM accounts WHERE name = $1`, [name])).rows[0].balance)
const tx = (db, type, amount, from, to, date) =>
  db.query(`INSERT INTO transactions (user_id, type, amount, account_name, to_account_name, transaction_date)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [U, type, amount, from, to, date]).then(r => r.rows[0].id)

// ── BEFORE: the trigger that is live today ─────────────────────────────
{
  const db = new PGlite()
  await db.exec(SCHEMA + oldTrigger + accounts)
  await tx(db, 'expense', 100, 'Maybank', null, '2026-06-20')   // importing an OLDER statement
  const b = await bal(db, 'Maybank')
  assert.equal(b, 900)
  console.log(`BEFORE (live trigger): Maybank synced to 1000 at 06-30, then an older 06-20 row imported -> ${b}  ❌ double-counted`)
}

// ── AFTER: migration 002 applied on top ────────────────────────────────
const db = new PGlite()
await db.exec(SCHEMA + oldTrigger + accounts)
await db.exec(m002)
await db.exec(m002)   // idempotent: running it twice must not fail

const juneRow = await tx(db, 'expense', 100, 'Maybank', null, '2026-06-20')
assert.equal(await bal(db, 'Maybank'), 1000, 'a) older-statement row is already inside the synced balance')
const julyRow = await tx(db, 'expense', 50, 'Maybank', null, '2026-07-05')
assert.equal(await bal(db, 'Maybank'), 950, 'b) activity after the statement applies')
await db.query(`UPDATE transactions SET amount = 80 WHERE id = $1`, [julyRow])
assert.equal(await bal(db, 'Maybank'), 920, 'c) edit re-applies the difference')
await db.query(`DELETE FROM transactions WHERE id = $1`, [juneRow])
assert.equal(await bal(db, 'Maybank'), 920, 'd) deleting a pre-statement row does not move the statement balance')
await tx(db, 'transfer', 200, 'Maybank', 'TNG eWallet', '2026-06-25')
assert.equal(await bal(db, 'Maybank'), 920, 'e) transfer: anchored source leg skipped')
assert.equal(await bal(db, 'TNG eWallet'), 250, 'e) transfer: un-anchored destination leg applied')
await tx(db, 'transfer', 30, 'Maybank', 'TNG eWallet', '2026-07-10')
assert.equal(await bal(db, 'Maybank'), 890); assert.equal(await bal(db, 'TNG eWallet'), 280, 'f) both legs after anchors')
await tx(db, 'transfer', 400, '', 'UOB ONE', '2026-07-20')
assert.equal(await bal(db, 'UOB ONE'), -100, 'g) card payment (unknown source) reduces the debt')
await tx(db, 'transfer', 999, '', 'UOB ONE', '2026-07-08')
assert.equal(await bal(db, 'UOB ONE'), -100, 'h) card payment inside the synced statement is not re-applied')

const acctId = (await db.query(`SELECT id FROM accounts WHERE name = 'Maybank'`)).rows[0].id
await db.query(`SELECT rename_account($1, $2)`, [acctId, '  Maybank Personal  '])
assert.equal(await bal(db, 'Maybank Personal'), 890, 'i) rename moves no money')
const left = (await db.query(`SELECT count(*)::int n FROM transactions WHERE account_name = 'Maybank' OR to_account_name = 'Maybank'`)).rows[0].n
assert.equal(left, 0, 'i) every transaction follows the rename')
const bill = (await db.query(`SELECT auto_deduct_account FROM monthly_bills`)).rows[0].auto_deduct_account
assert.equal(bill, 'Maybank Personal', 'i) bill auto-deduct follows the rename')
await tx(db, 'expense', 10, 'Maybank Personal', null, '2026-08-01')
assert.equal(await bal(db, 'Maybank Personal'), 880, 'j) the skip flag does not leak past the rename')
await assert.rejects(db.query(`SELECT rename_account($1, $2)`, [acctId, 'tng ewallet']), /已经有/, 'k) duplicate name refused')

const rls = Object.fromEntries((await db.query(
  `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('foo_unprotected','bar_protected','app_config')`)).rows
  .map(r => [r.relname, r.relrowsecurity]))
assert.deepEqual(rls, { foo_unprotected: true, bar_protected: true, app_config: true }, 'l/m) RLS on')
const pol = (await db.query(`SELECT tablename FROM pg_policies WHERE policyname LIKE 'own_rows_%' ORDER BY 1`)).rows.map(r => r.tablename)
assert.deepEqual(pol, ['foo_unprotected'], 'l) owner policy only added where RLS was off (not to already-protected tables)')

console.log('AFTER  (migration 002): all 15 checks passed — out-of-order import, edit, delete, transfers, card payments, rename, RLS, idempotent')
