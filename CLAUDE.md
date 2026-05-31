@AGENTS.md

# Vinus Finance — Project Rules for Claude

## 🔴 MANDATORY: Every git commit MUST include version + changelog update

Before creating ANY git commit, you MUST:

1. **Bump `APP_VERSION`** in `lib/changelog.ts`
   - Format: `'1.XXX'` (increment the 3-digit suffix: 1.004 → 1.005 → 1.006 …)

2. **Add a new entry** at the TOP of the `CHANGELOG` array in `lib/changelog.ts`
   - Include today's date in `YYYY-MM-DD` format
   - Write a meaningful title (Chinese preferred)
   - List every feature, fix, and improvement with an emoji prefix

3. **Bump `version`** in `package.json` to match
   - Map: APP_VERSION `1.005` → package.json `"1.5.0"`

**No exceptions. Do not commit code without updating the changelog.**

---

## 🔁 localhost ↔ Vercel Sync Rule

- **Vercel** (`vinus-finance.vercel.app`) auto-deploys from GitHub `main` branch on every push
- **localhost** (`localhost:3000`) runs `npm run dev` from the local files

They are identical ONLY when local files = what is pushed to GitHub.

**Rule:** Always `git push origin main` after committing. Never leave unpushed commits.
The user should see the same version number on both `localhost:3000` and Vercel.

---

## Database SQL changes

When a feature requires a DB schema change (new column, new table, new trigger), always:
1. Write the SQL as a clearly labelled block in your response
2. Tell the user to run it in **Supabase SQL Editor** before testing
3. Make the SQL idempotent (use `IF NOT EXISTS`, `OR REPLACE`, `ADD COLUMN IF NOT EXISTS`)

---

## Tech stack quick reference

- Framework: Next.js 16.2.6 App Router (server + client components)
- Database: Supabase PostgreSQL with Row Level Security
- AI: Gemini 2.5 Flash Lite (`gemini-2.5-flash-lite`) via `@google/generative-ai`
- Auth: Supabase Auth (cookie-based SSR)
- Styling: Tailwind CSS v4 + shadcn/ui components
- Deployment: Vercel (auto from GitHub main)
- i18n: Cookie-based (`lang` cookie), 3 locales: `en` / `ms` / `zh`
- Version tracking: `lib/changelog.ts` → `APP_VERSION` + `CHANGELOG[]`
