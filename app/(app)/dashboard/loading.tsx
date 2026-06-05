import { PageHeaderSkeleton, SummaryCardSkeleton, ListSkeleton, CardSkeleton, SkeletonBlock } from '@/components/ui/PageSkeleton'

export default function DashboardLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2">
        <SkeletonBlock className="h-8 w-8 rounded-full" />
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-8 w-8 rounded-full" />
      </div>
      <SummaryCardSkeleton />
      <div className="px-4 mt-6 space-y-2">
        <SkeletonBlock className="h-4 w-32 mb-3" />
        <ListSkeleton count={4} />
      </div>
      <div className="px-4 mt-6 space-y-2">
        <SkeletonBlock className="h-4 w-40 mb-3" />
        <CardSkeleton rows={3} />
      </div>
    </div>
  )
}
