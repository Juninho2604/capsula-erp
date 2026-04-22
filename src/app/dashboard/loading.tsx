export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border-primary/10 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded-xl mb-2" />
        <div className="h-4 w-48 bg-muted rounded-xl" />
      </div>

      {/* Sales KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel rounded-2xl p-5 animate-pulse">
            <div className="flex items-start justify-between mb-1">
              <div className="h-2.5 w-20 bg-muted rounded" />
              <div className="h-2 w-14 bg-muted rounded" />
            </div>
            <div className="h-8 w-28 bg-muted rounded mt-2 mb-3" />
            <div className="h-10 bg-muted rounded-lg" />
            <div className="h-2.5 w-24 bg-muted rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Executive summary */}
      <div className="glass-panel rounded-2xl border border-primary/10 animate-pulse">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-muted rounded" />
            <div>
              <div className="h-3 w-36 bg-muted rounded mb-1.5" />
              <div className="h-2.5 w-24 bg-muted rounded" />
            </div>
          </div>
          <div className="h-3 w-3 bg-muted rounded" />
        </div>
      </div>

      {/* Financial summary widget */}
      <div className="glass-panel rounded-2xl border border-border p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted rounded-xl" />
            <div>
              <div className="h-3.5 w-44 bg-muted rounded mb-1.5" />
              <div className="h-3 w-28 bg-muted rounded" />
            </div>
          </div>
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl bg-muted h-16" />
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 w-20 bg-muted rounded mb-3" />
                <div className="h-10 w-16 bg-muted rounded" />
              </div>
              <div className="h-14 w-14 bg-muted rounded-2xl" />
            </div>
            <div className="mt-4 h-1 bg-muted rounded-full" />
          </div>
        ))}
      </div>

      {/* Low stock table */}
      <div className="capsula-card border-primary/20 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-capsula-line px-8 py-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-muted rounded-2xl" />
            <div>
              <div className="h-5 w-44 bg-muted rounded mb-2" />
              <div className="h-3 w-56 bg-muted rounded" />
            </div>
          </div>
          <div className="h-8 w-28 bg-muted rounded-xl" />
        </div>
        <div className="divide-y divide-capsula-line">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-8 py-5 flex items-center gap-4 animate-pulse">
              <div className="h-12 w-12 bg-muted rounded-2xl flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-muted rounded mb-1.5" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="capsula-card p-2 animate-pulse">
            <div className="flex items-center gap-5 p-4 rounded-xl">
              <div className="h-14 w-14 bg-muted rounded-2xl flex-shrink-0" />
              <div>
                <div className="h-4 w-24 bg-muted rounded mb-1.5" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
