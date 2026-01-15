"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Download, FileDown, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { VelocityChart } from "./velocity-chart";
import { BurndownChart } from "./burndown-chart";
import { CycleTimeChart } from "./cycle-time-chart";
import { DistributionChart } from "./distribution-chart";
import { CompletionTrendsChart } from "./completion-trends-chart";
import { BoardHealthIndicators } from "./board-health-indicators";
import { TaskAgingReport } from "./task-aging-report";
import { WorkloadDistribution } from "./workload-distribution";
import { CapacityPlanningChart } from "./capacity-planning-chart";
import {
  getTeamVelocity,
  getBurndownData,
  getCycleTimeMetrics,
  getLeadTimeMetrics,
  getTaskDistribution,
  getCompletionRateTrends,
  getBoardHealth,
  getTaskAgingReport,
  getWorkloadDistribution,
  getCapacityMetrics,
  type GroupBy,
  type DateRange,
} from "@/lib/actions/analytics";

type AnalyticsDashboardProps = {
  workspaceId?: string;
  boardId?: string;
};

export function AnalyticsDashboard({ workspaceId, boardId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [groupBy, setGroupBy] = useState<GroupBy>("week");
  const [distributionGroupBy, setDistributionGroupBy] = useState<"priority" | "assignee" | "label">(
    "priority"
  );

  // Velocity data
  const [velocityData, setVelocityData] = useState<any>(null);
  const [velocityLoading, setVelocityLoading] = useState(true);

  // Burndown data
  const [burndownData, setBurndownData] = useState<any>(null);
  const [burndownLoading, setBurndownLoading] = useState(false);

  // Cycle time data
  const [cycleTimeData, setCycleTimeData] = useState<any>(null);
  const [cycleTimeLoading, setCycleTimeLoading] = useState(true);

  // Distribution data
  const [distributionData, setDistributionData] = useState<any>(null);
  const [distributionLoading, setDistributionLoading] = useState(true);

  // Completion trends data
  const [completionTrendsData, setCompletionTrendsData] = useState<any>(null);
  const [completionTrendsLoading, setCompletionTrendsLoading] = useState(true);

  // Board health data
  const [boardHealthData, setBoardHealthData] = useState<any>(null);
  const [boardHealthLoading, setBoardHealthLoading] = useState(true);

  // Task aging data
  const [taskAgingData, setTaskAgingData] = useState<any>(null);
  const [taskAgingLoading, setTaskAgingLoading] = useState(true);

  // Workload data
  const [workloadData, setWorkloadData] = useState<any>(null);
  const [workloadLoading, setWorkloadLoading] = useState(true);

  // Capacity data
  const [capacityData, setCapacityData] = useState<any>(null);
  const [capacityLoading, setCapacityLoading] = useState(true);

  // Load velocity data
  useEffect(() => {
    if (!workspaceId && !boardId) return;

    setVelocityLoading(true);
    getTeamVelocity({
      workspaceId,
      boardId,
      dateRange,
      groupBy,
    }).then((result) => {
      if (result.success && result.data) {
        setVelocityData(result.data);
      }
      setVelocityLoading(false);
    });
  }, [workspaceId, boardId, dateRange, groupBy]);

  // Load cycle time data
  useEffect(() => {
    if (!workspaceId && !boardId) return;

    setCycleTimeLoading(true);
    getCycleTimeMetrics({
      workspaceId,
      boardId,
      dateRange,
    }).then((result) => {
      if (result.success && result.data) {
        setCycleTimeData(result.data);
      }
      setCycleTimeLoading(false);
    });
  }, [workspaceId, boardId, dateRange]);

  // Load distribution data
  useEffect(() => {
    if (!workspaceId && !boardId) return;

    setDistributionLoading(true);
    getTaskDistribution({
      workspaceId,
      boardId,
      groupBy: distributionGroupBy,
      includeCompleted: false,
    }).then((result) => {
      if (result.success && result.data) {
        setDistributionData(result.data);
      }
      setDistributionLoading(false);
    });
  }, [workspaceId, boardId, distributionGroupBy]);

  // Load completion trends
  useEffect(() => {
    if (!workspaceId && !boardId) return;

    setCompletionTrendsLoading(true);
    getCompletionRateTrends({
      workspaceId,
      boardId,
      dateRange,
      groupBy,
    }).then((result) => {
      if (result.success && result.data) {
        setCompletionTrendsData(result.data);
      }
      setCompletionTrendsLoading(false);
    });
  }, [workspaceId, boardId, dateRange, groupBy]);

  // Load board health (only for board-level)
  useEffect(() => {
    if (!boardId) {
      setBoardHealthData(null);
      setBoardHealthLoading(false);
      return;
    }

    setBoardHealthLoading(true);
    getBoardHealth({ boardId }).then((result) => {
      if (result.success && result.data) {
        setBoardHealthData(result.data);
      }
      setBoardHealthLoading(false);
    });
  }, [boardId]);

  // Load task aging
  useEffect(() => {
    if (!workspaceId && !boardId) return;

    setTaskAgingLoading(true);
    getTaskAgingReport({
      workspaceId,
      boardId,
    }).then((result) => {
      if (result.success && result.data) {
        setTaskAgingData(result.data);
      }
      setTaskAgingLoading(false);
    });
  }, [workspaceId, boardId]);

  // Load workload (requires workspaceId)
  useEffect(() => {
    if (!workspaceId) {
      setWorkloadData(null);
      setWorkloadLoading(false);
      return;
    }

    setWorkloadLoading(true);
    getWorkloadDistribution({
      workspaceId,
      boardId,
    }).then((result) => {
      if (result.success && result.data) {
        setWorkloadData(result.data);
      }
      setWorkloadLoading(false);
    });
  }, [workspaceId, boardId]);

  // Load capacity (requires workspaceId)
  useEffect(() => {
    if (!workspaceId) {
      setCapacityData(null);
      setCapacityLoading(false);
      return;
    }

    setCapacityLoading(true);
    getCapacityMetrics({
      workspaceId,
      boardId,
    }).then((result) => {
      if (result.success && result.data) {
        setCapacityData(result.data);
      }
      setCapacityLoading(false);
    });
  }, [workspaceId, boardId]);

  const handleExport = async (format: "csv" | "pdf" | "excel") => {
    try {
      const params = new URLSearchParams({
        format,
      });

      if (workspaceId) {
        params.set("workspaceId", workspaceId);
      }
      if (boardId) {
        params.set("boardId", boardId);
      }

      // Build filters object
      const filters: any = {};
      if (dateRange.from || dateRange.to) {
        filters.dateRange = {};
        if (dateRange.from) filters.dateRange.from = dateRange.from;
        if (dateRange.to) filters.dateRange.to = dateRange.to;
      }

      if (Object.keys(filters).length > 0) {
        params.set("filters", JSON.stringify(filters));
      } else {
        // Also add date range as individual params for API route compatibility
        if (dateRange.from) {
          params.set("filters.dateRange.from", dateRange.from);
        }
        if (dateRange.to) {
          params.set("filters.dateRange.to", dateRange.to);
        }
      }

      const url = `/api/reports/export?${params.toString()}`;

      // Create a temporary link and click it to trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exporting ${format.toUpperCase()} report...`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {boardId ? "Board-level analytics" : "Workspace-level analytics"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(new Date(dateRange.from), "LLL dd, y")} -{" "}
                        {format(new Date(dateRange.to), "LLL dd, y")}
                      </>
                    ) : (
                      format(new Date(dateRange.from), "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Select Date Range</span>
                    {(dateRange.from || dateRange.to) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDateRange({ from: undefined, to: undefined });
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <Calendar
                  mode="range"
                  selected={{
                    from: dateRange.from ? new Date(dateRange.from) : undefined,
                    to: dateRange.to ? new Date(dateRange.to) : undefined,
                  }}
                  onSelect={(range) => {
                    setDateRange({
                      from: range?.from?.toISOString().split("T")[0],
                      to: range?.to?.toISOString().split("T")[0],
                    });
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {(dateRange.from || dateRange.to) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDateRange({ from: undefined, to: undefined });
                }}
                className="h-9 w-9"
                title="Clear date range"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileDown className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileDown className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")}>
                <FileDown className="mr-2 h-4 w-4" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Real-time Metrics */}
      {boardId && boardHealthData && (
        <BoardHealthIndicators data={boardHealthData} isLoading={boardHealthLoading} />
      )}

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <VelocityChart
          data={velocityData || []}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          isLoading={velocityLoading}
        />
        <CompletionTrendsChart data={completionTrendsData || []} isLoading={completionTrendsLoading} />
        <CycleTimeChart data={cycleTimeData} isLoading={cycleTimeLoading} />
        <DistributionChart
          data={distributionData || []}
          groupBy={distributionGroupBy}
          onGroupByChange={setDistributionGroupBy}
          isLoading={distributionLoading}
        />
      </div>

      {/* Workload and Capacity (workspace-level) */}
      {workspaceId && (
        <div className="grid gap-6 md:grid-cols-2">
          <WorkloadDistribution data={workloadData || []} isLoading={workloadLoading} />
          <CapacityPlanningChart data={capacityData} isLoading={capacityLoading} />
        </div>
      )}

      {/* Task Aging Report */}
      <TaskAgingReport data={taskAgingData || []} isLoading={taskAgingLoading} />
    </div>
  );
}
