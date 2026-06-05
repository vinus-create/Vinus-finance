import { PageHeaderSkeleton, SummaryCardSkeleton, ListSkeleton, SkeletonBlock } from '@/components/ui/PageSkeleton'

export default function StocksLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <SummaryCardSkeleton />
      <div className="mx-4 mt-4 flex gap-1.5">
        {[0,1,2].map(i => <SkeletonBlock key={i} className="flex-1 h-9 rounded-xl" />)}
      </div>
      <div className="px-4 mt-4">
        <ListSkeleton count={4} />
      </div>
    </div>
  )
}
