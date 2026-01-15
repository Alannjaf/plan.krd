"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, CheckCircle } from "lucide-react";
import { analyzeAndStoreWorkflow, getWorkflowAnalyses } from "@/lib/actions/ai-workflow";
import { toast } from "sonner";

interface WorkflowAnalyzerProps {
  boardId: string;
}

export function WorkflowAnalyzer({ boardId }: WorkflowAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAndStoreWorkflow(boardId);
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
        toast.success("Workflow analysis complete");
      } else {
        toast.error(result.error || "Failed to analyze workflow");
      }
    } catch (error) {
      toast.error("Failed to analyze workflow");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Analysis</CardTitle>
        <CardDescription>Analyze and optimize your board workflow</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Analyze Workflow
            </>
          )}
        </Button>

        {analysis && (
          <div className="space-y-4 mt-4">
            {analysis.metrics && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Cycle Time</p>
                  <p className="text-2xl font-bold">{analysis.metrics.avg_cycle_time.toFixed(1)} days</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold">{(analysis.metrics.completion_rate * 100).toFixed(0)}%</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Task Velocity</p>
                  <p className="text-2xl font-bold">{analysis.metrics.task_velocity} tasks/week</p>
                </div>
              </div>
            )}

            {analysis.findings?.issues && analysis.findings.issues.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Issues Found:</h4>
                <div className="space-y-2">
                  {analysis.findings.issues.map((issue: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{issue.type}</span>
                        <Badge
                          variant={
                            issue.severity === "high"
                              ? "destructive"
                              : issue.severity === "medium"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                      <p className="text-sm text-muted-foreground mt-1">Impact: {issue.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Recommendations:</h4>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">{rec.recommendation}</span>
                        <Badge variant="outline">{rec.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.expected_impact}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Effort: {rec.implementation_effort}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
