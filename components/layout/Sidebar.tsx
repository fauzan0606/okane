import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  Target,
  Landmark,
  PiggyBank,
  HandCoins,
  BarChart3,
  Settings,
} from "lucide-react";

const menus = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", active: true },
    ],
  },
  {
    title: "Finance",
    items: [
      { icon: Wallet, label: "Wallet" },
      { icon: Receipt, label: "Transactions" },
      { icon: ArrowLeftRight, label: "Transfer" },
    ],
  },
  {
    title: "Planning",
    items: [
      { icon: Target, label: "Budget" },
      { icon: PiggyBank, label: "Goals" },
    ],
  },
  {
    title: "Wealth",
    items: [
      { icon: Landmark, label: "Assets" },
      { icon: HandCoins, label: "Debt" },
    ],
  },
  {
    title: "Insight",
    items: [
      { icon: BarChart3, label: "Analytics" },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-72 bg-[#111827] border-r border-white/10 flex flex-col">

      <div className="px-8 pt-8 pb-6">

        <h1 className="text-3xl font-black tracking-tight text-white">
          OKANE
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Personal Finance OS
        </p>

      </div>

      <div className="flex-1 overflow-y-auto px-4">

        {menus.map((group) => (

          <div key={group.title} className="mb-8">

            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </p>

            {group.items.map((item) => {

              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition

                  ${
                    item.active
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={20} />

                  <span className="font-medium">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

        ))}

      </div>

      <div className="border-t border-white/10 p-4">

        <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-slate-400 transition hover:bg-white/5 hover:text-white">

          <Settings size={20} />

          Settings

        </button>

      </div>

    </aside>
  );
}