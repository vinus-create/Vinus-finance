'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Home, ArrowLeftRight, Plus, Wallet, LayoutGrid } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useLang } from '@/lib/i18n/LanguageProvider'

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)

  const NAV_ITEMS = [
    { href: '/dashboard', label: t.nav_home, icon: Home },
    { href: '/transactions', label: t.nav_transactions, icon: ArrowLeftRight },
    { href: null, label: t.nav_add, icon: Plus, isFab: true },
    { href: '/accounts', label: t.nav_accounts, icon: Wallet },
    { href: null, label: t.nav_more, icon: LayoutGrid, isMore: true },
  ]

  const MORE_ITEMS = [
    { href: '/budgets',   label: t.more_budgets,   emoji: '📊' },
    { href: '/loans',     label: t.more_loans,     emoji: '🏦' },
    { href: '/stocks',    label: t.more_stocks,    emoji: '📈' },
    { href: '/insights',  label: t.more_insights,  emoji: '🤖' },
    { href: '/tax',       label: t.more_tax,       emoji: '🏛️' },
    { href: '/reminders', label: t.more_reminders, emoji: '🔔' },
    { href: '/settings',  label: t.more_settings,  emoji: '⚙️' },
  ]

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          if (item.isFab) {
            return (
              <Link
                key="fab"
                href="/transactions?new=1"
                className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform -mt-5"
                aria-label={t.nav_add_aria}
              >
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
              </Link>
            )
          }

          if (item.isMore) {
            return (
              <Sheet key="more" open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger
                  className="flex flex-col items-center justify-center gap-1 min-w-[3rem] min-h-[2.75rem] px-2 bg-transparent border-0 cursor-pointer"
                  aria-label={t.nav_more}
                >
                  <LayoutGrid
                    className={cn('w-6 h-6', 'text-muted-foreground')}
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] text-muted-foreground">{t.nav_more}</span>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
                  <SheetHeader className="mb-4">
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="grid grid-cols-2 gap-3"
                       style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}>
                    {MORE_ITEMS.map((mi) => (
                      <Link
                        key={mi.href}
                        href={mi.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 p-4 rounded-xl bg-muted active:bg-muted/70 transition-colors"
                      >
                        <span className="text-2xl">{mi.emoji}</span>
                        <span className="text-sm font-medium">{mi.label}</span>
                      </Link>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            )
          }

          const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href!}
              className="flex flex-col items-center justify-center gap-1 min-w-[3rem] min-h-[2.75rem] px-2"
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn('w-6 h-6', isActive ? 'text-emerald-600' : 'text-muted-foreground')}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span className={cn('text-[10px]', isActive ? 'text-emerald-600 font-semibold' : 'text-muted-foreground')}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
