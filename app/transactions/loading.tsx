export default function Loading() {
  return (
    <div className="w-full space-y-6 px-4 py-4 md:px-8 md:py-6" aria-busy="true" aria-label="Loading transactions">
      <div className="space-y-3">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-white/10" />
        <div className="h-5 w-64 animate-pulse rounded-lg bg-white/5" />
      </div>

      <div className="flex gap-2">
        <div className="h-10 w-36 animate-pulse rounded-lg bg-white/5" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-white/5" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-white/10" />
      </div>

      <section className="rounded-[18px] border border-white/10 bg-[#0d141e] p-4">
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="space-y-2"><div className="h-3 w-20 animate-pulse rounded bg-white/5" /><div className="h-11 w-full animate-pulse rounded-xl bg-white/5" /></div>)}
          <div className="h-11 animate-pulse rounded-xl bg-white/10 md:self-end" />
        </div>
      </section>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-[16px] border border-white/10 bg-[#172A3D] px-4 py-4">
            <div className="space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-64 animate-pulse rounded bg-white/5" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-6 w-36 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
