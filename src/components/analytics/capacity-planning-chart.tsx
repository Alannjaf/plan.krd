"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { CapacityMetrics } from "@/lib/actions/analytics";

type CapacityPlanningChartProps = {
  data: CapacityMetrics | null;
  isLoading?: boolean;
};

export function CapacityPlanningChart({ data, isLoading }: CapacityPlanningChartProps) {
  const chartData = useMemo(() => {
    if (!data || !data.byUser || data.byUser.length === 0) {
      return [];
    }

    return data.byUser
      .map((user) => ({
        name: user.userName.split(" ")[0] || "User",
        allocated: user.allocated,
        available: user.available,
      }))
      .sort((a, b) => b.allocated - a.allocated);
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacity Planning</CardTitle>
          <CardDescription>Team capacity and utilization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capacity Planning</CardTitle>
          <CardDescription>Team capacity and utilization</CardDescription>
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
        <CardTitle>Capacity Planning</CardTitle>
        <CardDescription>Team capacity and utilization</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Capacity</p>
              <p className="text-lg font-semibold">{data.totalCapacity}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Allocated</p>
              <p className="text-lg font-semibold">{data.allocatedCapacity}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-lg font-semibold">{data.availableCapacity}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Utilization</p>
              <p className="text-lg font-semibold">{data.utilization.toFixed(1)}%</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
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
                <Legend />
                <Bar
                  dataKey="allocated"
                  fill="#3b82f6"
                  name="Allocated"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="available"
                  fill="#10b981"
                  name="Available"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
