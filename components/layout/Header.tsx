import { Bell, Search, Plus } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-white/10 bg-[#111827] px-8">

      <div>
        <h1 className="text-3xl font-bold text-white">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Selamat datang kembali 👋
        </p>
      </div>

      <div className="flex items-center gap-4">

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#182335] px-4 py-3">

          <Search size={18} className="text-slate-400" />

          <input
            placeholder="Cari transaksi..."
            className="w-56 bg-transparent text-white outline-none placeholder:text-slate-500"
          />

        </div>

        <button className="rounded-2xl border border-white/10 bg-[#182335] p-3 text-slate-300 transition hover:bg-white/10">
          <Bell size={20} />
        </button>

        <Link
          href="/transactions/smart"
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
        >
          <Plus size={18} />
          Transaksi
        </Link>

      </div>

    </header>
  );
}
