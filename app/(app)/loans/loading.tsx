import { PageHeaderSkeleton, CardSkeleton, ListSkeleton } from '@/components/ui/PageSkeleton'

export default function LoansLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="px-4 mt-4 space-y-3">
        <CardSkeleton rows={3} />
        <ListSkeleton count={3} />
      </div>
    </div>
  )
}
