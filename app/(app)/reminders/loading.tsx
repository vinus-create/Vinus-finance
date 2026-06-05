import { PageHeaderSkeleton, ListSkeleton } from '@/components/ui/PageSkeleton'

export default function RemindersLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="px-4 mt-4">
        <ListSkeleton count={5} />
      </div>
    </div>
  )
}
