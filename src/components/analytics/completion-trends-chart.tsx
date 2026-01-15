"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type CompletionTrendsChartProps = {
  data: Array<{ date: string; rate: number }>;
  isLoading?: boolean;
};

export function CompletionTrendsChart({ data, isLoading }: CompletionTrendsChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      date: formatDate(point.date),
      rate: point.rate,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate Trends</CardTitle>
          <CardDescription>Percentage of tasks completed over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate Trends</CardTitle>
          <CardDescription>Percentage of tasks completed over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Rate Trends</CardTitle>
        <CardDescription>Percentage of tasks completed over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number | undefined) => [`${value?.toFixed(1) ?? 0}%`, "Completion Rate"]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: "#10b981", r: 5, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 7, fill: "#10b981" }}
              name="Completion Rate"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function formatDate(date: string): string {
  // Handle different date formats
  if (date.includes("W")) {
    return date.replace("W", " Week ");
  }
  if (date.includes("-")) {
    const parts = date.split("-");
    if (parts.length === 3) {
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } else if (parts.length === 2) {
      const [year, month] = parts;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
  }
  return date;
}
