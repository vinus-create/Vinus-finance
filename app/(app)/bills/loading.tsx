import { PageHeaderSkeleton, CardSkeleton, ListSkeleton } from '@/components/ui/PageSkeleton'

export default function BillsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="px-4 mt-4 space-y-3">
        <CardSkeleton rows={3} />
        <ListSkeleton count={4} />
      </div>
    </div>
  )
}
