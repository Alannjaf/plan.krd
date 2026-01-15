"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { saveCustomReport, deleteCustomReport, type CustomReport } from "@/lib/actions/custom-reports";
import { toast } from "sonner";
import type { ReportFilters } from "@/lib/actions/reports";

type CustomReportBuilderProps = {
  workspaceId: string;
  boardId?: string;
  report?: CustomReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

const AVAILABLE_FIELDS = [
  { id: "title", label: "Title", default: true },
  { id: "description", label: "Description", default: true },
  { id: "priority", label: "Priority", default: true },
  { id: "due_date", label: "Due Date", default: true },
  { id: "start_date", label: "Start Date", default: false },
  { id: "completed_at", label: "Completed At", default: false },
  { id: "status", label: "Status/List", default: true },
  { id: "assignees", label: "Assignees", default: true },
  { id: "labels", label: "Labels", default: true },
  { id: "subtasks", label: "Subtasks", default: false },
];

export function CustomReportBuilder({
  workspaceId,
  boardId,
  report,
  open,
  onOpenChange,
  onSaved,
}: CustomReportBuilderProps) {
  const [name, setName] = useState(report?.name || "");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    report?.config?.fields && Array.isArray(report.config.fields)
      ? report.config.fields
      : AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.id)
  );
  const [filters, setFilters] = useState<ReportFilters>(report?.config?.filters || {});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a report name");
      return;
    }

    setIsSaving(true);
    const result = await saveCustomReport({
      workspaceId,
      boardId,
      name: name.trim(),
      config: {
        filters,
        fields: selectedFields,
      },
      reportId: report?.id,
    });

    setIsSaving(false);

    if (result.success) {
      toast.success(report ? "Report updated" : "Report saved");
      onSaved?.();
      onOpenChange(false);
    } else {
      toast.error(result.error || "Failed to save report");
    }
  };

  const handleDelete = async () => {
    if (!report) return;

    if (!confirm("Are you sure you want to delete this report?")) {
      return;
    }

    setIsDeleting(true);
    const result = await deleteCustomReport(report.id);
    setIsDeleting(false);

    if (result.success) {
      toast.success("Report deleted");
      onSaved?.();
      onOpenChange(false);
    } else {
      toast.error(result.error || "Failed to delete report");
    }
  };

  const toggleField = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter((id) => id !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report ? "Edit Report" : "Create Custom Report"}</DialogTitle>
          <DialogDescription>
            Configure your custom report with selected fields and filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Name */}
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Report"
            />
          </div>

          {/* Field Selection */}
          <div className="space-y-2">
            <Label>Fields to Include</Label>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_FIELDS.map((field) => (
                    <Badge
                      key={field.id}
                      variant={selectedFields.includes(field.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleField(field.id)}
                    >
                      {field.label}
                      {selectedFields.includes(field.id) && (
                        <X className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))}
                </div>
                {selectedFields.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Select at least one field
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <Label>Filters</Label>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Completion Status</Label>
                    <Select
                      value={filters.completed === undefined ? "all" : filters.completed ? "completed" : "incomplete"}
                      onValueChange={(value) => {
                        setFilters({
                          ...filters,
                          completed: value === "all" ? undefined : value === "completed",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tasks</SelectItem>
                        <SelectItem value="completed">Completed Only</SelectItem>
                        <SelectItem value="incomplete">Incomplete Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={filters.priority || "all"}
                      onValueChange={(value) => {
                        setFilters({
                          ...filters,
                          priority: value === "all" ? undefined : value as any,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          {report && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || selectedFields.length === 0}>
            {isSaving ? "Saving..." : report ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
