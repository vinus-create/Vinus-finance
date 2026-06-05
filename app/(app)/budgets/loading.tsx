import { PageHeaderSkeleton, CardSkeleton, ListSkeleton, SkeletonBlock } from '@/components/ui/PageSkeleton'

export default function BudgetsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="px-4 mt-4 space-y-3">
        <SkeletonBlock className="h-10 w-full rounded-xl" />
        <CardSkeleton rows={2} />
        <ListSkeleton count={5} />
      </div>
    </div>
  )
}
