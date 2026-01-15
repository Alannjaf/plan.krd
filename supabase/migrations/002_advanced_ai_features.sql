-- Advanced AI Features Database Schema
-- This migration creates tables for AI-Powered Insights, AI Automation, AI Writing Assistant, and AI Workflow Optimization

-- 1. AI Insights Table - Store generated insights and predictions
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('at_risk', 'bottleneck', 'workload', 'due_date_suggestion')),
  data JSONB NOT NULL DEFAULT '{}',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 2. AI Automation Rules Table - Store AI-generated automation rules
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('auto_assign', 'smart_routing', 'reminder', 'duplicate_detection')),
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Writing Suggestions Table - Store writing improvement suggestions
CREATE TABLE IF NOT EXISTS ai_writing_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('description', 'comment', 'title')),
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. AI Workflow Analyses Table - Store workflow optimization analyses
CREATE TABLE IF NOT EXISTS ai_workflow_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('bottleneck', 'structure', 'productivity')),
  findings JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE
);

-- 5. AI Duplicate Tasks Table - Track detected duplicate tasks
CREATE TABLE IF NOT EXISTS ai_duplicate_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  duplicate_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  similarity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (similarity_score >= 0.0 AND similarity_score <= 1.0),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  action_taken TEXT CHECK (action_taken IN ('merged', 'dismissed', 'kept_separate'))
);

-- Add new columns to existing tables
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS ai_suggested_due_date DATE,
  ADD COLUMN IF NOT EXISTS ai_confidence_score DOUBLE PRECISION CHECK (ai_confidence_score >= 0.0 AND ai_confidence_score <= 1.0);

ALTER TABLE task_assignees
  ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_insights_workspace_id ON ai_insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_board_id ON ai_insights(board_id) WHERE board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_insights_task_id ON ai_insights(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_dismissed ON ai_insights(dismissed_at) WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_workspace_id ON ai_automation_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_board_id ON ai_automation_rules(board_id) WHERE board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_enabled ON ai_automation_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_type ON ai_automation_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_ai_writing_suggestions_task_id ON ai_writing_suggestions(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_writing_suggestions_status ON ai_writing_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_writing_suggestions_field_type ON ai_writing_suggestions(field_type);

CREATE INDEX IF NOT EXISTS idx_ai_workflow_analyses_workspace_id ON ai_workflow_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_analyses_board_id ON ai_workflow_analyses(board_id) WHERE board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_workflow_analyses_type ON ai_workflow_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_analyses_created_at ON ai_workflow_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_duplicate_tasks_task_id ON ai_duplicate_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_duplicate_tasks_duplicate_id ON ai_duplicate_tasks(duplicate_task_id);
CREATE INDEX IF NOT EXISTS idx_ai_duplicate_tasks_resolved ON ai_duplicate_tasks(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_duplicate_tasks_similarity ON ai_duplicate_tasks(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_ai_suggested_due_date ON tasks(ai_suggested_due_date) WHERE ai_suggested_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_assignees_ai_suggested ON task_assignees(ai_suggested) WHERE ai_suggested = true;

-- Enable Row Level Security
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_writing_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflow_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_duplicate_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_insights
CREATE POLICY "Users can view insights for their workspaces"
  ON ai_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_insights.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create insights for their workspaces"
  ON ai_insights FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_insights.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update insights for their workspaces"
  ON ai_insights FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_insights.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_automation_rules
CREATE POLICY "Users can view automation rules for their workspaces"
  ON ai_automation_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_automation_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create automation rules for their workspaces"
  ON ai_automation_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_automation_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update automation rules for their workspaces"
  ON ai_automation_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_automation_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete automation rules for their workspaces"
  ON ai_automation_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_automation_rules.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for ai_writing_suggestions
CREATE POLICY "Users can view writing suggestions for accessible tasks"
  ON ai_writing_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN lists ON tasks.list_id = lists.id
      JOIN boards ON lists.board_id = boards.id
      JOIN workspace_members ON boards.workspace_id = workspace_members.workspace_id
      WHERE tasks.id = ai_writing_suggestions.task_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create writing suggestions for accessible tasks"
  ON ai_writing_suggestions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN lists ON tasks.list_id = lists.id
      JOIN boards ON lists.board_id = boards.id
      JOIN workspace_members ON boards.workspace_id = workspace_members.workspace_id
      WHERE tasks.id = ai_writing_suggestions.task_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update writing suggestions for accessible tasks"
  ON ai_writing_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN lists ON tasks.list_id = lists.id
      JOIN boards ON lists.board_id = boards.id
      JOIN workspace_members ON boards.workspace_id = workspace_members.workspace_id
      WHERE tasks.id = ai_writing_suggestions.task_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_workflow_analyses
CREATE POLICY "Users can view workflow analyses for their workspaces"
  ON ai_workflow_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_workflow_analyses.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create workflow analyses for their workspaces"
  ON ai_workflow_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_workflow_analyses.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update workflow analyses for their workspaces"
  ON ai_workflow_analyses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_workflow_analyses.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for ai_duplicate_tasks
CREATE POLICY "Users can view duplicate tasks for accessible tasks"
  ON ai_duplicate_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN lists l1 ON t1.list_id = l1.id
      JOIN boards b1 ON l1.board_id = b1.id
      JOIN workspace_members wm1 ON b1.workspace_id = wm1.workspace_id
      JOIN tasks t2 ON t2.id = ai_duplicate_tasks.duplicate_task_id
      JOIN lists l2 ON t2.list_id = l2.id
      JOIN boards b2 ON l2.board_id = b2.id
      JOIN workspace_members wm2 ON b2.workspace_id = wm2.workspace_id
      WHERE t1.id = ai_duplicate_tasks.task_id
      AND wm1.user_id = auth.uid()
      AND wm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create duplicate task records for accessible tasks"
  ON ai_duplicate_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN lists l1 ON t1.list_id = l1.id
      JOIN boards b1 ON l1.board_id = b1.id
      JOIN workspace_members wm1 ON b1.workspace_id = wm1.workspace_id
      JOIN tasks t2 ON t2.id = ai_duplicate_tasks.duplicate_task_id
      JOIN lists l2 ON t2.list_id = l2.id
      JOIN boards b2 ON l2.board_id = b2.id
      JOIN workspace_members wm2 ON b2.workspace_id = wm2.workspace_id
      WHERE t1.id = ai_duplicate_tasks.task_id
      AND wm1.user_id = auth.uid()
      AND wm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update duplicate task records for accessible tasks"
  ON ai_duplicate_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN lists l1 ON t1.list_id = l1.id
      JOIN boards b1 ON l1.board_id = b1.id
      JOIN workspace_members wm1 ON b1.workspace_id = wm1.workspace_id
      JOIN tasks t2 ON t2.id = ai_duplicate_tasks.duplicate_task_id
      JOIN lists l2 ON t2.list_id = l2.id
      JOIN boards b2 ON l2.board_id = b2.id
      JOIN workspace_members wm2 ON b2.workspace_id = wm2.workspace_id
      WHERE t1.id = ai_duplicate_tasks.task_id
      AND wm1.user_id = auth.uid()
      AND wm2.user_id = auth.uid()
    )
  );
