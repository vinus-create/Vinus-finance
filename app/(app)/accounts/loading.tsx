import { PageHeaderSkeleton, ListSkeleton, CardSkeleton, SkeletonBlock } from '@/components/ui/PageSkeleton'

export default function AccountsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="px-4 mt-4 space-y-3">
        <CardSkeleton rows={2} />
        <SkeletonBlock className="h-4 w-24 mt-2" />
        <ListSkeleton count={4} />
      </div>
    </div>
  )
}
