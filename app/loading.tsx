import Image from "next/image";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#070c12] text-slate-100" aria-busy="true" aria-label="Loading OKANE">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 pb-28 md:px-8 md:py-8 md:pb-8 xl:px-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:hidden">
            <Skeleton className="h-10 w-10" />
            <div className="flex items-center gap-2">
              <Image src="/okane-mascot.svg" alt="" width={28} height={28} priority />
              <span className="text-lg font-black tracking-[0.03em] text-white">OKANE</span>
            </div>
          </div>
          <div className="hidden space-y-2 md:block">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="hidden h-10 w-32 md:block" />
          </div>
        </div>

        <Skeleton className="mb-5 h-36 w-full rounded-[22px] md:h-44" />

        <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-[18px]" />)}
        </div>

        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <section key={index} className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5 md:p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-7 w-48" />
              <Skeleton className="mt-5 h-28 w-full" />
              <Skeleton className="mt-4 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
            </section>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <section key={index} className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5 md:p-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-7 w-52" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 5 }).map((__, row) => <Skeleton key={row} className="h-12 w-full" />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
