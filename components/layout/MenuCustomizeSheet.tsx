'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface MenuItem {
  href: string
  label: string
  emoji: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: MenuItem[]
  onOrderChange: (items: MenuItem[]) => void
}

export default function MenuCustomizeSheet({ open, onOpenChange, items, onOrderChange }: Props) {
  function move(index: number, dir: -1 | 1) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onOrderChange(next)
    localStorage.setItem('menu_order', JSON.stringify(next.map(i => i.href)))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80dvh] overflow-y-auto">
        <SheetHeader className="px-4 pt-2">
          <SheetTitle>自定义 Menu 排序</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 mt-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">用 ↑↓ 调整顺序，关闭后自动保存</p>
          {items.map((item, i) => (
            <div key={item.href} className="flex items-center gap-3 p-3 rounded-xl bg-muted">
              <span className="text-xl">{item.emoji}</span>
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-background disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-sm hover:bg-background disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
