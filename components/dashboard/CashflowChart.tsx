"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  Tooltip,
} from "recharts";
import Card from "@/components/ui/Card";

const data = [
  { month: "Jan", income: 12, expense: 8 },
  { month: "Feb", income: 15, expense: 9 },
  { month: "Mar", income: 13, expense: 11 },
  { month: "Apr", income: 18, expense: 12 },
  { month: "Mei", income: 20, expense: 14 },
  { month: "Jun", income: 19, expense: 13 },
];

export default function CashflowChart() {
  return (
    <Card>
      <h3 className="mb-6 text-lg font-semibold text-white">
        Cashflow
      </h3>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>

            <XAxis
              dataKey="month"
              stroke="#94A3B8"
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="income"
              stroke="#22C55E"
              strokeWidth={3}
            />

            <Line
              type="monotone"
              dataKey="expense"
              stroke="#EF4444"
              strokeWidth={3}
            />

          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}