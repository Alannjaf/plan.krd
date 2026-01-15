"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { VelocityDataPoint, GroupBy } from "@/lib/actions/analytics";

type VelocityChartProps = {
  data: VelocityDataPoint[];
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  isLoading?: boolean;
};

export function VelocityChart({ data, groupBy, onGroupByChange, isLoading }: VelocityChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      date: formatDateLabel(point.date, groupBy),
      completed: point.completed,
      created: point.created,
    }));
  }, [data, groupBy]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Velocity</CardTitle>
          <CardDescription>Tasks completed and created over time</CardDescription>
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
          <CardTitle>Team Velocity</CardTitle>
          <CardDescription>Tasks completed and created over time</CardDescription>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Velocity</CardTitle>
            <CardDescription>Tasks completed and created over time</CardDescription>
          </div>
          <Select value={groupBy} onValueChange={onGroupByChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
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
            <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="created" fill="#3b82f6" name="Created" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function formatDateLabel(date: string, groupBy: GroupBy): string {
  if (groupBy === "day") {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } else if (groupBy === "week") {
    return date.replace("W", " Week ");
  } else {
    const [year, month] = date.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
}
