/**
 * Reusable skeleton components for loading states.
 * Used by loading.tsx files across all app pages.
 */

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-xl ${className}`} />
}

export function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
      <SkeletonBlock className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
          <SkeletonBlock className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-2.5 w-1/3" />
          </div>
          <SkeletonBlock className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function PageHeaderSkeleton({ hasBack = false }: { hasBack?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      {hasBack && <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />}
      <SkeletonBlock className="h-5 w-32" />
    </div>
  )
}

export function SummaryCardSkeleton() {
  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-card border border-border space-y-3">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="h-8 w-40" />
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-1">
            <SkeletonBlock className="h-2 w-full" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
