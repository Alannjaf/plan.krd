"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle } from "lucide-react";
import type { TaskAgingItem } from "@/lib/actions/analytics";

type TaskAgingReportProps = {
  data: TaskAgingItem[];
  isLoading?: boolean;
};

export function TaskAgingReport({ data, isLoading }: TaskAgingReportProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task Aging Report</CardTitle>
          <CardDescription>Tasks that are overdue or at risk</CardDescription>
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
          <CardTitle>Task Aging Report</CardTitle>
          <CardDescription>Tasks that are overdue or at risk</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No aging tasks found
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverity = (item: TaskAgingItem): { label: string; color: "default" | "destructive" | "secondary" | "outline" } => {
    if (item.daysOverdue !== null && item.daysOverdue > 7) {
      return { label: "Critical", color: "destructive" };
    }
    if (item.daysOverdue !== null && item.daysOverdue > 0) {
      return { label: "Overdue", color: "destructive" };
    }
    if (item.age > 14) {
      return { label: "At Risk", color: "default" };
    }
    return { label: "Normal", color: "secondary" };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Aging Report</CardTitle>
        <CardDescription>Tasks that are overdue or at risk</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Assignees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 20).map((item) => {
                const severity = getSeverity(item);
                return (
                  <TableRow key={item.taskId}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{item.age} days</span>
                        {item.daysOverdue !== null && (
                          <Badge variant="destructive" className="text-xs">
                            {item.daysOverdue} overdue
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severity.color}>{severity.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.priority || "none"}</Badge>
                    </TableCell>
                    <TableCell>{item.listName}</TableCell>
                    <TableCell>
                      {item.assignees.length > 0
                        ? item.assignees.map((a) => a.name).join(", ")
                        : "Unassigned"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {data.length > 20 && (
          <p className="text-sm text-muted-foreground mt-4">
            Showing top 20 of {data.length} aging tasks
          </p>
        )}
      </CardContent>
    </Card>
  );
}
