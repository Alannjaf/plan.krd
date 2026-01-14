# Database Query Optimization Guide

## Current Optimizations

### 1. Task Queries
- ✅ **getTask()**: Uses `count` queries for attachments/comments instead of fetching all data
- ✅ **getTasksWithRelations()**: Now supports pagination to limit data fetched
- ✅ Uses nested selects efficiently for related data

### 2. Count Queries
- ✅ Uses `count: "exact"` with `head: true` for efficient counting
- ✅ Parallel execution of count queries using `Promise.all()`

### 3. Pagination
- ✅ Added pagination support to `getTasksWithRelations()`
- ✅ Infinite query hooks available for large datasets

## Recommended Optimizations

### 1. Add Database Indexes
Ensure these indexes exist in Supabase:

```sql
-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(list_id) INCLUDE (board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- Task Assignees
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);

-- Task Labels
CREATE INDEX IF NOT EXISTS idx_task_labels_task_id ON task_labels(task_id);
CREATE INDEX IF NOT EXISTS idx_task_labels_label_id ON task_labels(label_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Attachments
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
```

### 2. Query Optimization Patterns

#### Avoid Over-fetching
- ✅ Only select needed fields
- ✅ Use `head: true` for count-only queries
- ✅ Use pagination for large result sets

#### Use Efficient Joins
- ✅ Prefer nested selects over separate queries when possible
- ✅ Use `inner` joins when filtering by related table

#### Cache Frequently Accessed Data
- ✅ React Query provides automatic caching
- ✅ Consider adding Redis for frequently accessed workspace/board metadata

### 3. Query Review Checklist

When reviewing queries, check:
- [ ] Are we fetching more fields than needed?
- [ ] Can we use pagination instead of fetching all records?
- [ ] Are count queries using `head: true`?
- [ ] Are related queries executed in parallel?
- [ ] Do we have appropriate indexes?

## Performance Monitoring

Consider adding query performance logging:

```typescript
const startTime = Date.now();
const { data, error } = await query;
const duration = Date.now() - startTime;
if (duration > 1000) {
  logger.warn("Slow query detected", { duration, query: "getTasksWithRelations" });
}
```
