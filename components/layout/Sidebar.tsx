const menus = [
  "Beranda",
  "Dompet",
  "Transaksi",
  "Anggaran",
  "Tujuan",
  "Aset",
  "Hutang",
  "Analisis",
];

export default function Sidebar() {
  return (
    <aside className="w-72 bg-[#172235] border-r border-white/10 flex flex-col">

      {/* Logo */}

      <div className="px-8 py-8">

        <h1 className="text-3xl font-bold text-white">
          OKANE
        </h1>

        <p className="mt-1 text-slate-400 text-sm">
          Personal Finance Dashboard
        </p>

      </div>

      {/* Menu */}

      <nav className="flex-1 px-4">

        {menus.map((menu, index) => (

          <button
            key={menu}
            className={`mb-2 flex w-full rounded-xl px-5 py-4 text-left transition

            ${
              index === 0
                ? "bg-[#2A364D] text-white"
                : "text-slate-400 hover:bg-[#2A364D] hover:text-white"
            }`}
          >
            {menu}
          </button>

        ))}

      </nav>

      {/* Footer */}

      <div className="border-t border-white/10 p-6">

        <p className="text-sm text-slate-400">
          v0.1
        </p>

      </div>

    </aside>
  );
}