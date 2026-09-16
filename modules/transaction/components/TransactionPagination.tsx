import Link from "next/link";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string>;
};

function buildHref(page: number, searchParams: Record<string, string>) {
  const params = new URLSearchParams(searchParams);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  return `/transactions${params.toString() ? `?${params.toString()}` : ""}`;
}

export default function TransactionPagination({ page, pageSize, total, searchParams }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <nav className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-[#0d141e] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Transaction pagination">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-300">{firstItem}–{lastItem}</span> of <span className="font-semibold text-slate-300">{total.toLocaleString("id-ID")}</span> transactions
      </p>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {page > 1 ? (
          <Link href={buildHref(page - 1, searchParams)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-300 transition hover:bg-white/5">
            ← <span className="ml-1 hidden sm:inline">Previous</span>
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/5 px-3 text-sm text-slate-700">← <span className="ml-1 hidden sm:inline">Previous</span></span>
        )}

        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((pageNumber) => (
            <Link key={pageNumber} href={buildHref(pageNumber, searchParams)} className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-sm font-semibold transition ${pageNumber === page ? "bg-emerald-500 text-[#06110B]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} aria-current={pageNumber === page ? "page" : undefined}>
              {pageNumber}
            </Link>
          ))}
        </div>

        <span className="text-xs font-semibold text-slate-400 sm:hidden">Page {page} / {pageCount}</span>

        {page < pageCount ? (
          <Link href={buildHref(page + 1, searchParams)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-300 transition hover:bg-white/5">
            <span className="mr-1 hidden sm:inline">Next</span> →
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/5 px-3 text-sm text-slate-700"><span className="mr-1 hidden sm:inline">Next</span> →</span>
        )}
      </div>
    </nav>
  );
}
