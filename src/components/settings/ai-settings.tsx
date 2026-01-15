"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Brain, Zap, PenTool, Workflow } from "lucide-react";

interface AISettingsProps {
  workspaceId: string;
  boardId?: string;
}

export function AISettings({ workspaceId, boardId }: AISettingsProps) {
  const [insightsEnabled, setInsightsEnabled] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [writingEnabled, setWritingEnabled] = useState(true);
  const [workflowEnabled, setWorkflowEnabled] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Features</h2>
        <p className="text-muted-foreground">
          Configure AI-powered features to enhance your task management
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <CardTitle>AI-Powered Insights</CardTitle>
          </div>
          <CardDescription>
            Predictive analytics and intelligent recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="insights-enabled">Enable Insights</Label>
              <p className="text-sm text-muted-foreground">
                Get predictions about at-risk tasks, bottlenecks, and workload
              </p>
            </div>
            <Switch
              id="insights-enabled"
              checked={insightsEnabled}
              onCheckedChange={setInsightsEnabled}
            />
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>At-risk task detection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Smart due date suggestions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Bottleneck detection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Workload predictions</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>AI Automation</CardTitle>
          </div>
          <CardDescription>
            Automate routine task management operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="automation-enabled">Enable Automation</Label>
              <p className="text-sm text-muted-foreground">
                Auto-assign tasks, detect duplicates, and generate reminders
              </p>
            </div>
            <Switch
              id="automation-enabled"
              checked={automationEnabled}
              onCheckedChange={setAutomationEnabled}
            />
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Smart task routing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Auto-assignment based on skills</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Duplicate task detection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Contextual reminders</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            <CardTitle>AI Writing Assistant</CardTitle>
          </div>
          <CardDescription>
            Enhance task descriptions and generate content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="writing-enabled">Enable Writing Assistant</Label>
              <p className="text-sm text-muted-foreground">
                Improve descriptions, generate meeting notes, and create templates
              </p>
            </div>
            <Switch
              id="writing-enabled"
              checked={writingEnabled}
              onCheckedChange={setWritingEnabled}
            />
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Description improvement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Meeting notes generation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Task template creation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>User story generation</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            <CardTitle>AI Workflow Optimization</CardTitle>
          </div>
          <CardDescription>
            Analyze and suggest workflow improvements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="workflow-enabled">Enable Workflow Analysis</Label>
              <p className="text-sm text-muted-foreground">
                Get recommendations for workflow improvements and board optimization
              </p>
            </div>
            <Switch
              id="workflow-enabled"
              checked={workflowEnabled}
              onCheckedChange={setWorkflowEnabled}
            />
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Workflow analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Bottleneck identification</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Board structure optimization</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Productivity pattern analysis</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
