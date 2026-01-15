"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import type { BoardHealth } from "@/lib/actions/analytics";

type BoardHealthIndicatorsProps = {
  data: BoardHealth;
  isLoading?: boolean;
};

export function BoardHealthIndicators({ data, isLoading }: BoardHealthIndicatorsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Board Health</CardTitle>
          <CardDescription>Real-time board metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthStatus = () => {
    if (data.overdueTasks > 5 || data.agingTasks > 10) {
      return { label: "Needs Attention", color: "destructive" };
    }
    if (data.overdueTasks > 0 || data.agingTasks > 5) {
      return { label: "Good", color: "default" };
    }
    return { label: "Healthy", color: "default" };
  };

  const healthStatus = getHealthStatus();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Board Health</CardTitle>
            <CardDescription>Real-time board metrics</CardDescription>
          </div>
          <Badge variant={healthStatus.color === "destructive" ? "destructive" : "secondary"}>
            {healthStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>Overdue</span>
            </div>
            <p className="text-2xl font-bold">{data.overdueTasks}</p>
            <p className="text-xs text-muted-foreground">tasks</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-orange-500" />
              <span>At Risk</span>
            </div>
            <p className="text-2xl font-bold">{data.atRiskTasks}</p>
            <p className="text-xs text-muted-foreground">tasks</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>Aging</span>
            </div>
            <p className="text-2xl font-bold">{data.agingTasks}</p>
            <p className="text-xs text-muted-foreground">tasks</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Throughput</span>
            </div>
            <p className="text-2xl font-bold">{data.throughput}</p>
            <p className="text-xs text-muted-foreground">last 7 days</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Completion Rate</span>
            </div>
            <p className="text-2xl font-bold">{data.completionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">of all tasks</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Avg Cycle Time</span>
            </div>
            <p className="text-2xl font-bold">{data.averageCycleTime.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
