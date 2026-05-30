import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { CHANGELOG, APP_VERSION } from '@/lib/changelog'

export default function ChangelogPage() {
  return (
    <div>
      <PageHeader title="Changelog" showBack />
      <div className="px-4 mt-4 pb-8 space-y-4">

        {/* Current version badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full">
            当前版本 V{APP_VERSION}
          </span>
        </div>

        {CHANGELOG.map((entry, idx) => (
          <Card key={entry.version} className={`border-0 shadow-sm overflow-hidden`}>
            {/* Version header */}
            <div className={`px-4 py-3 flex items-center justify-between ${
              idx === 0
                ? 'bg-emerald-500 text-white'
                : 'bg-muted/60'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  idx === 0
                    ? 'bg-white/20 text-white'
                    : 'bg-background text-foreground'
                }`}>
                  V{entry.version}
                </span>
                <span className={`text-sm font-semibold ${idx === 0 ? 'text-white' : 'text-foreground'}`}>
                  {entry.title}
                </span>
                {idx === 0 && (
                  <span className="text-[10px] bg-white/30 text-white px-1.5 py-0.5 rounded-full font-medium">
                    最新
                  </span>
                )}
              </div>
              <span className={`text-xs ${idx === 0 ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                {entry.date}
              </span>
            </div>

            {/* Change items */}
            <CardContent className="pt-3 pb-3">
              <ul className="space-y-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="text-sm leading-snug">
                    {change}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
