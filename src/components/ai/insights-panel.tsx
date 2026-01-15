"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Users, Clock, Loader2, X } from "lucide-react";
import {
  generateAndStoreAtRiskInsights,
  getAtRiskInsights,
  dismissInsight,
  getBottlenecks,
  detectAndStoreBottlenecks,
  getWorkloadPredictions,
  predictAndStoreWorkload,
} from "@/lib/actions/ai-insights";
import { format } from "date-fns";
import { toast } from "sonner";

interface InsightsPanelProps {
  boardId: string;
  workspaceId: string;
}

export function InsightsPanel({ boardId, workspaceId }: InsightsPanelProps) {
  const [activeTab, setActiveTab] = useState("at-risk");
  const [loading, setLoading] = useState(false);
  const [atRiskTasks, setAtRiskTasks] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [workloadPredictions, setWorkloadPredictions] = useState<any[]>([]);

  const loadAtRiskInsights = async () => {
    setLoading(true);
    try {
      const result = await getAtRiskInsights(boardId);
      if (result.success && result.insights) {
        setAtRiskTasks(result.insights);
      }
    } catch (error) {
      toast.error("Failed to load at-risk insights");
    } finally {
      setLoading(false);
    }
  };

  const loadBottlenecks = async () => {
    setLoading(true);
    try {
      const result = await getBottlenecks(boardId);
      if (result.success && result.bottlenecks) {
        setBottlenecks(result.bottlenecks);
      }
    } catch (error) {
      toast.error("Failed to load bottlenecks");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkloadPredictions = async () => {
    setLoading(true);
    try {
      const result = await getWorkloadPredictions(workspaceId);
      if (result.success && result.predictions) {
        setWorkloadPredictions(result.predictions);
      }
    } catch (error) {
      toast.error("Failed to load workload predictions");
    } finally {
      setLoading(false);
    }
  };

  const generateAtRisk = async () => {
    setLoading(true);
    try {
      const result = await generateAndStoreAtRiskInsights(boardId);
      if (result.success) {
        toast.success("At-risk insights generated");
        await loadAtRiskInsights();
      } else {
        toast.error(result.error || "Failed to generate insights");
      }
    } catch (error) {
      toast.error("Failed to generate insights");
    } finally {
      setLoading(false);
    }
  };

  const generateBottlenecks = async () => {
    setLoading(true);
    try {
      const result = await detectAndStoreBottlenecks(boardId);
      if (result.success) {
        toast.success("Bottlenecks detected");
        await loadBottlenecks();
      } else {
        toast.error(result.error || "Failed to detect bottlenecks");
      }
    } catch (error) {
      toast.error("Failed to detect bottlenecks");
    } finally {
      setLoading(false);
    }
  };

  const generateWorkload = async () => {
    setLoading(true);
    try {
      const dateRange = {
        from: new Date().toISOString().split("T")[0],
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
      const result = await predictAndStoreWorkload(workspaceId, dateRange);
      if (result.success) {
        toast.success("Workload predictions generated");
        await loadWorkloadPredictions();
      } else {
        toast.error(result.error || "Failed to generate predictions");
      }
    } catch (error) {
      toast.error("Failed to generate predictions");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (insightId: string) => {
    try {
      const result = await dismissInsight(insightId);
      if (result.success) {
        toast.success("Insight dismissed");
        await loadAtRiskInsights();
      }
    } catch (error) {
      toast.error("Failed to dismiss insight");
    }
  };

  useEffect(() => {
    if (activeTab === "at-risk") {
      loadAtRiskInsights();
    } else if (activeTab === "bottlenecks") {
      loadBottlenecks();
    } else if (activeTab === "workload") {
      loadWorkloadPredictions();
    }
  }, [activeTab, boardId, workspaceId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
        <CardDescription>Predictive analytics and intelligent recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="at-risk">At-Risk Tasks</TabsTrigger>
            <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
            <TabsTrigger value="workload">Workload</TabsTrigger>
          </TabsList>

          <TabsContent value="at-risk" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Tasks that are likely to miss their deadlines
              </p>
              <Button onClick={generateAtRisk} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
              </Button>
            </div>
            {atRiskTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No at-risk tasks found. Click Generate to analyze.
              </p>
            ) : (
              <div className="space-y-2">
                {atRiskTasks.map((task, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{task.task_title}</h4>
                        <div className="mt-2 space-y-1">
                          {task.risk_factors.map((factor: string, i: number) => (
                            <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                              <AlertCircle className="h-3 w-3" />
                              {factor}
                            </div>
                          ))}
                        </div>
                        {task.suggested_action && (
                          <p className="text-sm text-muted-foreground mt-2">
                            💡 {task.suggested_action}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={task.confidence > 0.8 ? "destructive" : "secondary"}>
                          {(task.confidence * 100).toFixed(0)}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(task.task_id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bottlenecks" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Workflow bottlenecks where tasks get stuck
              </p>
              <Button onClick={generateBottlenecks} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Detect"}
              </Button>
            </div>
            {bottlenecks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No bottlenecks detected. Click Detect to analyze.
              </p>
            ) : (
              <div className="space-y-2">
                {bottlenecks.map((bottleneck, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{bottleneck.list_name}</h4>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <div>Tasks: {bottleneck.task_count}</div>
                          <div>Avg days in list: {bottleneck.avg_days_in_list.toFixed(1)}</div>
                        </div>
                        {bottleneck.recommendations.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium mb-1">Recommendations:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              {bottleneck.recommendations.map((rec: string, i: number) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          bottleneck.risk_level === "high"
                            ? "destructive"
                            : bottleneck.risk_level === "medium"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {bottleneck.risk_level}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="workload" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Team workload predictions and capacity analysis
              </p>
              <Button onClick={generateWorkload} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Predict"}
              </Button>
            </div>
            {workloadPredictions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No workload predictions. Click Predict to analyze.
              </p>
            ) : (
              <div className="space-y-2">
                {workloadPredictions.map((prediction, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{prediction.user_name}</h4>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <div>Current tasks: {prediction.current_tasks}</div>
                          <div>Predicted tasks: {prediction.predicted_tasks}</div>
                          <div>
                            Capacity: {(prediction.capacity_utilization * 100).toFixed(0)}%
                          </div>
                        </div>
                        {prediction.recommendations.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium mb-1">Recommendations:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              {prediction.recommendations.map((rec: string, i: number) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          prediction.risk_level === "overloaded"
                            ? "destructive"
                            : prediction.risk_level === "high"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {prediction.risk_level}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
