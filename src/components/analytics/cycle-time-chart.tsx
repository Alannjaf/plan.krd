"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { CycleTimeMetrics } from "@/lib/actions/analytics";

type CycleTimeChartProps = {
  data: CycleTimeMetrics | null;
  isLoading?: boolean;
};

export function CycleTimeChart({ data, isLoading }: CycleTimeChartProps) {
  const histogramData = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) {
      return [];
    }

    // Create histogram buckets
    const buckets = new Map<number, number>();
    const maxCycleTime = Math.max(...data.data.map((d) => d.cycleTime), 0);
    const bucketSize = Math.max(1, Math.ceil(maxCycleTime / 20));

    data.data.forEach((item) => {
      const bucket = Math.floor(item.cycleTime / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });

    return Array.from(buckets.entries())
      .map(([cycleTime, count]) => ({
        cycleTime: `${cycleTime}-${cycleTime + bucketSize}`,
        count,
      }))
      .sort((a, b) => a.cycleTime.localeCompare(b.cycleTime));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cycle Time Analysis</CardTitle>
          <CardDescription>Time from task creation to completion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cycle Time Analysis</CardTitle>
          <CardDescription>Time from task creation to completion</CardDescription>
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
        <CardTitle>Cycle Time Analysis</CardTitle>
        <CardDescription>Time from task creation to completion</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-semibold">{data.average.toFixed(1)} days</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Median (P50)</p>
              <p className="text-lg font-semibold">{data.median.toFixed(1)} days</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">P75</p>
              <p className="text-lg font-semibold">{data.p75.toFixed(1)} days</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">P95</p>
              <p className="text-lg font-semibold">{data.p95.toFixed(1)} days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="cycleTime"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
              />
              <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]}>
                {histogramData.map((entry, index) => {
                  // Create a gradient from purple to pink
                  const colors = ["#8b5cf6", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff"];
                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
