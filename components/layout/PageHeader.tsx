'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  showBack?: boolean
  right?: React.ReactNode
  className?: string
}

export default function PageHeader({ title, showBack = false, right, className }: PageHeaderProps) {
  const router = useRouter()

  return (
    <div
      className={cn('flex items-center justify-between px-4 border-b border-border bg-background', className)}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.875rem)',
        paddingBottom: '0.875rem',
        minHeight: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
      }}
    >
      <div className="flex items-center gap-2 flex-1">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-full active:bg-muted transition-colors -ml-1"
            aria-label="Kembali"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
