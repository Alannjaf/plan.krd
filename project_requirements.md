# Project: Plan.krd - Advanced AI Task Management System

## 1. Core Architecture

- **Database:** Supabase (PostgreSQL).
- **Auth:** Supabase Auth (Google OAuth + Email/Password).
- **Hierarchy:** User > Workspace > Board > List (Column) > Task.
- **Roles:**
  - Workspace Owner/Admin (Can manage billing, members).
  - Board Admin (Can edit board settings, columns).
  - Member (Can create/edit tasks).
  - Viewer (Read-only).
  - Commenter (Read + Comment only).

## 2. Feature Requirements

### Phase 1: Authentication & Workspace Foundation

- Landing page with pricing (Free, Basic, Pro).
- Google Login via Supabase.
- User Dashboard: Create/Delete/Edit Workspaces.
- Workspace Settings: Invite members (email invitation).

### Phase 2: Boards & Kanban

- Create/Edit/Delete Boards within a Workspace.
- Kanban View: Drag & Drop Columns and Cards (use `@hello-pangea/dnd` or similar).
- Column Filtering: Sort by date, name, priority.

### Phase 3: The "Super Task" Detail View

- **Fields:** Title, Description, Start/Due Date, Assignees (Multi), Priority, Labels.
- **Custom Fields:** Admin defines fields (Dropdown, Text, Number) per board.
- **Subtasks:** Nested tasks with their own due dates/assignees.
- **Attachments:** Supabase Storage. Max 50MB. Preview for images/PDFs.
- **Activity Log:** Audit trail (Who changed what) - Collapsible.
- **Comments:** Threaded comments, mentions (@user), edit/delete support.

### Phase 4: Advanced Views & Features

- **Views:** List, Calendar (Month/Week), Gantt Chart, Workload (User capacity).
- **Archives:** Archive Tasks/Boards (Soft delete).
- **Search:** Global search (Workspaces/Tasks) + Board-level filter.
- **Notifications:** In-app inbox for mentions and assignments.

### Phase 5: Regional & Enterprise

- **RTL Support:** Full UI mirroring for Kurdish/Arabic.
- **Offline Mode:** Local optimistic updates using TanStack Query.
- **Public Boards:** Generate read-only links for external sharing.

### Phase 6: AI Integration (OpenRouter / Gemini 3 Flash)

- **Chat Assistant:** Sidebar chat to "Show me tasks due this week" (converts NL to DB query).
- **Task Decomposer:** Button to "Break down this task" -> AI generates subtasks.
- **Smart Summaries:** Summarize long task descriptions/comments.
- **Auto-Tagging:** AI analyzes text to suggest Labels/Priority.
- **Document RAG:** Chat with attached PDFs.

## 3. Data Security (Critical)

- **RLS:** Users must NEVER see data from workspaces they are not invited to.
- **Storage Policies:** Only board members can view/upload files.
