import Card from "./card";
import { formatCurrency } from "@/lib/formatCurrency";

type Props = {
  title: string;
  value: number;
};

export default function StatCard({
  title,
  value,
}: Props) {
  return (
    <Card>

      <p className="text-sm text-slate-400">
        {title}
      </p>

      <h2 className="mt-3 text-4xl font-bold text-white">
        {formatCurrency(value)}
      </h2>

    </Card>
  );
}