import BottomNav from '@/components/layout/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Page content — padded to clear bottom nav */}
      <main className="flex-1 page-content overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
