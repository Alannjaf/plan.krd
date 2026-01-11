import type { TaskActivity } from "@/lib/actions/activities";

export function getActivityMessage(
  activity: TaskActivity,
  userName: string
): string {
  const changes = activity.changes;

  switch (activity.action) {
    case "created":
      return `${userName} created this task`;
    case "updated":
      return `${userName} updated the task`;
    case "moved":
      return `${userName} moved the task from "${changes.from}" to "${changes.to}"`;
    case "assigned":
      return `${userName} assigned ${changes.assignee} to this task`;
    case "unassigned":
      return `${userName} removed ${changes.assignee} from this task`;
    case "label_added":
      return `${userName} added label "${changes.label}"`;
    case "label_removed":
      return `${userName} removed label "${changes.label}"`;
    case "subtask_added":
      return `${userName} added subtask "${changes.title}"`;
    case "subtask_completed":
      return `${userName} completed subtask "${changes.title}"`;
    case "subtask_deleted":
      return `${userName} deleted subtask "${changes.title}"`;
    case "attachment_added":
      return `${userName} attached "${changes.fileName}"`;
    case "attachment_deleted":
      return `${userName} removed attachment "${changes.fileName}"`;
    case "comment_added":
      return `${userName} added a comment`;
    case "due_date_changed":
      if (changes.from && changes.to) {
        return `${userName} changed due date from ${changes.from} to ${changes.to}`;
      } else if (changes.to) {
        return `${userName} set due date to ${changes.to}`;
      } else {
        return `${userName} removed due date`;
      }
    case "priority_changed":
      return `${userName} changed priority from "${changes.from}" to "${changes.to}"`;
    case "description_changed":
      return `${userName} updated the description`;
    default:
      return `${userName} made changes`;
  }
}
