export default function Header() {
  return (
    <header className="h-20 border-b border-white/10 bg-[#111C31] px-8 flex items-center justify-between">

      <div>
        <h1 className="text-3xl font-bold text-white">
          Dashboard
        </h1>

        <p className="text-slate-400">
          Selamat datang di OKANE
        </p>
      </div>

      <button className="rounded-xl bg-white px-6 py-3 font-semibold text-black hover:bg-slate-200 transition">
        + Transaksi
      </button>

    </header>
  );
}