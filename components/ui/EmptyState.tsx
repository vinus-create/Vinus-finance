import { cn } from '@/lib/utils'

interface EmptyStateProps {
  emoji: string
  title: string
  body: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ emoji, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-14 text-center px-6', className)}>
      <span className="text-5xl mb-4 block animate-float animate-bounce-in">{emoji}</span>
      <p className="text-base font-semibold text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
