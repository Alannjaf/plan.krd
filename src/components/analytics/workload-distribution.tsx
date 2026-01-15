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
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { WorkloadData } from "@/lib/actions/analytics";

type WorkloadDistributionProps = {
  data: WorkloadData[];
  isLoading?: boolean;
};

export function WorkloadDistribution({ data, isLoading }: WorkloadDistributionProps) {
  const chartData = useMemo(() => {
    return data
      .map((item) => ({
        name: item.userName.split(" ")[0] || item.userEmail.split("@")[0] || "User",
        tasks: item.taskCount,
        overdue: item.overdueCount,
        capacity: item.capacity,
      }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [data]);

  const getColor = (capacity: number) => {
    if (capacity >= 100) return "#ef4444"; // Red for overloaded
    if (capacity >= 70) return "#f59e0b"; // Amber for heavy
    if (capacity >= 40) return "#eab308"; // Yellow for moderate
    return "#10b981"; // Green for light
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workload Distribution</CardTitle>
          <CardDescription>Task distribution across team members</CardDescription>
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
          <CardTitle>Workload Distribution</CardTitle>
          <CardDescription>Task distribution across team members</CardDescription>
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
        <CardTitle>Workload Distribution</CardTitle>
        <CardDescription>Task distribution across team members</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
                formatter={(value: number | undefined, name: string | undefined) => {
                  const val = value ?? 0;
                  if (name === "overdue") {
                    return [val, "Overdue Tasks"];
                  }
                  return [val, "Total Tasks"];
                }}
              />
              <Bar dataKey="tasks" name="Tasks" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.capacity)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            {data.slice(0, 5).map((item) => (
              <div key={item.userId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.userName}</span>
                  <span className="text-muted-foreground">
                    {item.taskCount} tasks
                    {item.overdueCount > 0 && (
                      <span className="text-destructive ml-2">
                        ({item.overdueCount} overdue)
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={item.capacity} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
