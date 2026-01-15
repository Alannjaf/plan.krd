# AI Features Integration Guide

This document provides guidance on integrating the Advanced AI Features into the existing Plan.krd UI.

## Overview

The Advanced AI Features have been implemented with:
- ✅ Database schema (migrations applied)
- ✅ Core AI logic (`src/lib/ai/`)
- ✅ Server actions (`src/lib/actions/ai-*.ts`)
- ✅ UI components (`src/components/ai/`)
- ✅ AI settings panel (`src/components/settings/ai-settings.tsx`)

## Integration Points

### 1. Task Detail View

Add AI features to the task detail panel:

```tsx
// In src/components/tasks/task-detail.tsx
import { DescriptionImprover } from "@/components/ai/description-improver";
import { AutoAssignmentPanel } from "@/components/ai/auto-assignment-panel";
import { suggestAndStoreDueDate } from "@/lib/actions/ai-insights";

// Add "Improve Description" button near description field
<DescriptionImprover
  taskId={task.id}
  currentText={task.description || ""}
  fieldType="description"
  onImproved={(text) => {
    // Update local state or refetch
  }}
/>

// Add "AI Suggest Assignee" button in assignees section
<AutoAssignmentPanel
  taskId={task.id}
  onAssigned={() => {
    // Refetch assignees
  }}
/>

// Add "Suggest Due Date" button
<Button onClick={async () => {
  const result = await suggestAndStoreDueDate(task.id);
  if (result.success) {
    // Show suggestion or update UI
  }
}}>
  Suggest Due Date
</Button>
```

### 2. Board Header

Add insights indicator and access to insights panel:

```tsx
// In src/components/boards/board-header.tsx
import { InsightsPanel } from "@/components/ai/insights-panel";
import { 
  Dialog,
  DialogContent,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Brain } from "lucide-react";

// Add insights button
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <Brain className="h-4 w-4 mr-2" />
      AI Insights
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl">
    <InsightsPanel boardId={boardId} workspaceId={workspaceId} />
  </DialogContent>
</Dialog>
```

### 3. Task Form

Add smart routing suggestions when creating tasks:

```tsx
// In src/components/tasks/task-form.tsx
import { getAssigneeSuggestions } from "@/lib/actions/ai-automation";
import { useEffect, useState } from "react";

// When task title/description changes, show AI suggestions
useEffect(() => {
  if (title && description) {
    // Get assignee suggestions (taskId will be created)
    // Show suggestions as chips or dropdown
  }
}, [title, description]);
```

### 4. Comment Section

Add meeting notes generation:

```tsx
// In src/components/tasks/comment-section.tsx
import { generateNotesFromComments } from "@/lib/actions/ai-writing";
import { FileText } from "lucide-react";

// Add "Generate Meeting Notes" button
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    const result = await generateNotesFromComments(taskId);
    if (result.success && result.notes) {
      // Show notes in a dialog or add as comment
    }
  }}
>
  <FileText className="h-4 w-4 mr-2" />
  Generate Meeting Notes
</Button>
```

### 5. Board Settings

Add workflow analysis and AI settings:

```tsx
// In src/components/boards/board-settings.tsx
import { WorkflowAnalyzer } from "@/components/ai/workflow-analyzer";
import { AISettings } from "@/components/settings/ai-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Add AI tab
<Tabs>
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="ai">AI Features</TabsTrigger>
    <TabsTrigger value="workflow">Workflow</TabsTrigger>
  </TabsList>
  
  <TabsContent value="ai">
    <AISettings workspaceId={workspaceId} boardId={boardId} />
  </TabsContent>
  
  <TabsContent value="workflow">
    <WorkflowAnalyzer boardId={boardId} />
  </TabsContent>
</Tabs>
```

## Available Components

### Insights Components
- `InsightsPanel` - Main insights dashboard with tabs for at-risk tasks, bottlenecks, and workload
- Individual components can be used separately if needed

### Automation Components
- `AutoAssignmentPanel` - Shows AI-suggested assignees with confidence scores
- Additional components for duplicate detection and reminders can be created following the same pattern

### Writing Components
- `DescriptionImprover` - Improves task descriptions, titles, or comments
- Additional components for meeting notes, templates, and user stories can be created

### Workflow Components
- `WorkflowAnalyzer` - Analyzes board workflow and provides recommendations
- Additional components for board structure optimization can be created

## Server Actions Reference

### Insights
- `generateAndStoreAtRiskInsights(boardId)` - Generate at-risk task insights
- `getAtRiskInsights(boardId)` - Get stored insights
- `suggestAndStoreDueDate(taskId, store?)` - Suggest due date for task
- `detectAndStoreBottlenecks(boardId)` - Detect workflow bottlenecks
- `predictAndStoreWorkload(workspaceId, dateRange?)` - Predict team workload

### Automation
- `getAssigneeSuggestions(taskId)` - Get assignee suggestions
- `applyAutoAssignment(taskId, userId?)` - Auto-assign task
- `detectAndStoreDuplicates(boardId, taskId?)` - Detect duplicate tasks
- `generateTaskReminder(taskId)` - Generate contextual reminder

### Writing
- `improveAndStoreDescription(taskId, fieldType, apply)` - Improve text
- `getWritingSuggestions(taskId)` - Get stored suggestions
- `respondToWritingSuggestion(suggestionId, accept)` - Accept/reject suggestion
- `generateNotesFromComments(taskId)` - Generate meeting notes
- `createTaskTemplate(boardId, taskIds)` - Create template from tasks
- `generateTaskUserStory(taskId)` - Generate user story

### Workflow
- `analyzeAndStoreWorkflow(boardId)` - Analyze workflow
- `getWorkflowAnalyses(boardId)` - Get stored analyses
- `getBoardStructureSuggestions(boardId)` - Get structure suggestions
- `analyzeAndStoreProductivity(workspaceId, dateRange)` - Analyze productivity
- `markAnalysisApplied(analysisId)` - Mark analysis as applied

## Next Steps

1. **Integrate components** into existing UI as shown above
2. **Add feature flags** if needed for gradual rollout
3. **Create additional UI components** for features not yet implemented (duplicate detector, reminder scheduler, etc.)
4. **Add tests** for the new features
5. **Monitor usage** and gather feedback

## Notes

- All AI features respect RLS policies
- Insights are cached in the database for performance
- AI suggestions can be dismissed or accepted by users
- All features are opt-in via the AI settings panel
