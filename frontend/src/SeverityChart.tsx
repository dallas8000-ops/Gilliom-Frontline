import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SeverityDatum {
  severity: string;
  count: number;
}

export default function SeverityChart({ data }: Readonly<{ data: SeverityDatum[] }>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 18 }}
      >
        <CartesianGrid stroke="#2a343e" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="severity"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#a9a192", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "#212a33" }}
          contentStyle={{
            background: "#161d24",
            border: "1px solid #2a343e",
          }}
        />
        <Bar dataKey="count" fill="#e8a33d" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}