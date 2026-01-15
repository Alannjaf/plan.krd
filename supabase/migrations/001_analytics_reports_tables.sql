-- Create custom_reports table
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_config JSONB NOT NULL,
  schedule JSONB NOT NULL, -- {frequency: 'daily'|'weekly'|'monthly', dayOfWeek?, dayOfMonth?, time?}
  recipients TEXT[] NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_reports_workspace_id ON custom_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_board_id ON custom_reports(board_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON custom_reports(created_by);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_workspace_id ON scheduled_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_board_id ON scheduled_reports(board_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_enabled ON scheduled_reports(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);

-- Enable RLS
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_reports
-- Users can view reports for workspaces they're members of
CREATE POLICY "Users can view custom reports in their workspaces"
  ON custom_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = custom_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can create reports in workspaces they're members of
CREATE POLICY "Users can create custom reports in their workspaces"
  ON custom_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = custom_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update reports they created (or workspace admins)
CREATE POLICY "Users can update their own custom reports"
  ON custom_reports FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = custom_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Users can delete reports they created (or workspace admins)
CREATE POLICY "Users can delete their own custom reports"
  ON custom_reports FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = custom_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for scheduled_reports
-- Users can view scheduled reports for workspaces they're members of
CREATE POLICY "Users can view scheduled reports in their workspaces"
  ON scheduled_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = scheduled_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Users can create scheduled reports in workspaces they're members of
CREATE POLICY "Users can create scheduled reports in their workspaces"
  ON scheduled_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = scheduled_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update scheduled reports they created (or workspace admins)
CREATE POLICY "Users can update their own scheduled reports"
  ON scheduled_reports FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = scheduled_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Users can delete scheduled reports they created (or workspace admins)
CREATE POLICY "Users can delete their own scheduled reports"
  ON scheduled_reports FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = scheduled_reports.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
