import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/export?month=2026-05  (omit month for all time)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM format

  let query = supabase
    .from('transactions')
    .select('transaction_date, type, amount, currency, merchant_name, description, expense_category, income_category, account_name, is_tax_deductible, created_at')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    const mm = String(m).padStart(2, '0')
    const lastDay = new Date(y, m, 0).getDate()
    query = query
      .gte('transaction_date', `${y}-${mm}-01`)
      .lte('transaction_date', `${y}-${mm}-${String(lastDay).padStart(2, '0')}`)
  }

  // Also try to fetch ledger column (may not exist)
  const { data: rows } = await query

  if (!rows || rows.length === 0) {
    return new Response('date,type,amount,currency,merchant,description,category,account,tax_deductible\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vinus-transactions${month ? `-${month}` : ''}.csv"`,
      },
    })
  }

  // Build CSV
  const headers = ['Date', 'Type', 'Amount', 'Currency', 'Merchant', 'Description', 'Expense Category', 'Income Category', 'Account', 'Tax Deductible']
  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      r.transaction_date,
      r.type,
      r.amount,
      r.currency,
      csvEscape(r.merchant_name ?? ''),
      csvEscape(r.description ?? ''),
      r.expense_category ?? '',
      r.income_category ?? '',
      csvEscape(r.account_name ?? ''),
      r.is_tax_deductible ? 'Yes' : 'No',
    ].join(',')),
  ]

  const csv = csvRows.join('\r\n')
  const filename = `vinus-transactions${month ? `-${month}` : '-all'}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
