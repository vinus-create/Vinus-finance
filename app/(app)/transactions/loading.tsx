import { PageHeaderSkeleton, ListSkeleton, SkeletonBlock } from '@/components/ui/PageSkeleton'

export default function TransactionsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="flex items-center justify-between px-4 py-2">
        <SkeletonBlock className="h-8 w-8 rounded-full" />
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-8 w-8 rounded-full" />
      </div>
      <div className="px-4 mt-2">
        <SkeletonBlock className="h-10 w-full rounded-xl mb-4" />
        <ListSkeleton count={8} />
      </div>
    </div>
  )
}
