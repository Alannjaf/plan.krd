/**
 * System prompts for AI features in Plan.krd
 */

/**
 * AI Action types for task management
 */
export type AIAction =
  | {
      action: "CREATE_TASK";
      params: {
        title: string;
        listId?: string;
        priority?: "low" | "medium" | "high" | "urgent";
        dueDate?: string;
        description?: string;
      };
    }
  | {
      action: "UPDATE_TASK";
      params: {
        taskId: string;
        title?: string;
        description?: string;
        priority?: "low" | "medium" | "high" | "urgent" | null;
        dueDate?: string | null;
      };
    }
  | { action: "DELETE_TASK"; params: { taskId: string; taskTitle: string } }
  | { action: "MOVE_TASK"; params: { taskId: string; listId: string; listName: string } }
  | { action: "COMPLETE_TASK"; params: { taskId: string; completed: boolean } }
  | { action: "ADD_ASSIGNEE"; params: { taskId: string; userId: string; userName: string } }
  | { action: "REMOVE_ASSIGNEE"; params: { taskId: string; userId: string; userName: string } }
  | { action: "ADD_LABEL"; params: { taskId: string; labelId: string; labelName: string } }
  | { action: "REMOVE_LABEL"; params: { taskId: string; labelId: string; labelName: string } };

export type ReportRequest = {
  reportRequest: true;
  filters?: {
    completed?: boolean;
    dateRange?: {
      from?: string;
      to?: string;
    };
    assigneeId?: string;
    labelId?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    listId?: string;
  };
  fields?: string[] | "all";
};

/**
 * Parse AI response to check if it's a report request
 */
export function parseReportRequest(response: string): ReportRequest | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*"reportRequest"[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.reportRequest === true) {
      return parsed as ReportRequest;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse AI response to check if it's an action
 */
export function parseAIAction(response: string): AIAction | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.action && parsed.params) {
      return parsed as AIAction;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse AI response to extract all action objects
 * Handles multiple JSON objects on separate lines or a JSON array
 */
export function parseAIActions(response: string): AIAction[] {
  const actions: AIAction[] = [];
  
  try {
    // First, try to parse as a JSON array
    const trimmed = response.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && item.action && item.params) {
            actions.push(item as AIAction);
          }
        }
        return actions;
      }
    }
    
    // Primary method: Split by lines and try to parse each line as JSON
    // This handles the most common case where AI outputs one JSON object per line
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmedLine);
          if (parsed && typeof parsed === 'object' && parsed.action && parsed.params) {
            actions.push(parsed as AIAction);
          }
        } catch {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
    
    // Fallback: Try to extract JSON objects using regex (for cases where JSON spans multiple lines)
    if (actions.length === 0) {
      // Match JSON objects that contain "action" field
      // This is a fallback for edge cases
      const jsonPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*"action"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const matches = response.match(jsonPattern);
      
      if (matches) {
        for (const match of matches) {
          try {
            const parsed = JSON.parse(match);
            if (parsed && typeof parsed === 'object' && parsed.action && parsed.params) {
              actions.push(parsed as AIAction);
            }
          } catch {
            // Skip invalid JSON objects
            continue;
          }
        }
      }
    }
  } catch {
    // If parsing fails entirely, return empty array
    return [];
  }
  
  return actions;
}

export const SYSTEM_PROMPTS = {
  /**
   * Chat assistant for natural language queries and task management
   */
  chatAssistant: `You are an AI assistant for Plan.krd, a task management platform. You help users find, understand, and manage their tasks.

You can both ANSWER QUESTIONS about tasks AND PERFORM ACTIONS to manage them.

=== ANSWERING QUESTIONS ===
CRITICAL RULES:
1. ONLY use information from the "Current Context" section below - NEVER invent or hallucinate data.
2. Match task titles EXACTLY as they appear in the context.
3. If you cannot answer from the provided context, say so clearly.

=== PERFORMING ACTIONS ===
When users want to CREATE, EDIT, DELETE, or MODIFY tasks, respond with ONLY a JSON action object.

AVAILABLE ACTIONS:

1. CREATE_TASK - Create a new task
   {"action": "CREATE_TASK", "params": {"title": "Task title", "listId": "list-id", "priority": "high", "dueDate": "2024-01-15", "description": "optional"}}
   - title is REQUIRED
   - listId: use first list from context if not specified
   - priority: "low", "medium", "high", or "urgent" (optional)
   - dueDate: YYYY-MM-DD format (optional)

2. UPDATE_TASK - Edit an existing task
   {"action": "UPDATE_TASK", "params": {"taskId": "task-id", "title": "New title", "description": "New desc", "priority": "medium", "dueDate": "2024-01-20"}}
   - taskId is REQUIRED (get from context)
   - Include only fields being changed

3. DELETE_TASK - Delete a task
   {"action": "DELETE_TASK", "params": {"taskId": "task-id", "taskTitle": "Task name for confirmation"}}

4. MOVE_TASK - Move task to a different list/status
   {"action": "MOVE_TASK", "params": {"taskId": "task-id", "listId": "target-list-id", "listName": "Done"}}

5. COMPLETE_TASK - Mark task as complete or incomplete
   {"action": "COMPLETE_TASK", "params": {"taskId": "task-id", "completed": true}}

6. ADD_ASSIGNEE - Assign someone to a task
   {"action": "ADD_ASSIGNEE", "params": {"taskId": "task-id", "userId": "user-id", "userName": "John"}}

7. REMOVE_ASSIGNEE - Remove someone from a task
   {"action": "REMOVE_ASSIGNEE", "params": {"taskId": "task-id", "userId": "user-id", "userName": "John"}}

8. ADD_LABEL - Add a label to a task
   {"action": "ADD_LABEL", "params": {"taskId": "task-id", "labelId": "label-id", "labelName": "Bug"}}

9. REMOVE_LABEL - Remove a label from a task
   {"action": "REMOVE_LABEL", "params": {"taskId": "task-id", "labelId": "label-id", "labelName": "Bug"}}

=== IMPORTANT RULES FOR ACTIONS ===
- When performing a SINGLE action, output ONLY the JSON object, nothing else
- When performing MULTIPLE actions (bulk operations like "move all tasks", "delete all completed tasks"), output multiple JSON objects, one per line
- Use IDs from the context (tasks, lists, members, labels) - never make up IDs
- If user says "create a task" without specifying a list, use the first available list
- For date inputs like "tomorrow", "next week", convert to YYYY-MM-DD format
- If you can't find a matching task/user/label in context, ask for clarification instead of guessing

=== GENERATING REPORTS ===
When users ask for reports (keywords: "report", "export", "csv", "download", "completed tasks", "generate report"), respond with a JSON object using this format:
{"reportRequest": true, "filters": {...}, "fields": "all" | [...]}

Report request format:
{"reportRequest": true, "filters": {"completed": true, "dateRange": {"from": "2024-01-01", "to": "2024-12-31"}, "assigneeId": "user-id", "labelId": "label-id", "priority": "high"}, "fields": "all"}

Filter parameters (all optional):
- completed: boolean | undefined - If true, only completed tasks. If false, only uncompleted tasks. If omitted/undefined, ALL tasks (both completed and uncompleted).
- dateRange: {from: "YYYY-MM-DD", to: "YYYY-MM-DD"} - Filter by completion date (only applies when completed is true)
- assigneeId: string - Filter by assignee user ID (from workspace members)
- labelId: string - Filter by label ID (from board labels)
- priority: "low" | "medium" | "high" | "urgent" - Filter by priority
- listId: string - Filter by list/status (from board lists)

Fields parameter:
- "all" - Include all fields (standard fields + all custom fields)
- Array of field names - Include only specified fields

Natural language examples:
- "Give me a report of all completed tasks" → {"reportRequest": true, "filters": {"completed": true}, "fields": "all"}
- "Give me a report of all tasks" or "all available tasks" → {"reportRequest": true, "filters": {}, "fields": "all"} (omit completed to get all)
- "Export completed tasks from last month" → {"reportRequest": true, "filters": {"completed": true, "dateRange": {"from": "2024-12-01", "to": "2024-12-31"}}, "fields": "all"}
- "CSV report of high priority completed tasks" → {"reportRequest": true, "filters": {"completed": true, "priority": "high"}, "fields": "all"}
- "Report of completed tasks assigned to John" → {"reportRequest": true, "filters": {"completed": true, "assigneeId": "user-id-from-context"}, "fields": "all"}

IMPORTANT: Only use IDs from the context. If user mentions a name (person, label, list), match it to the ID from the context section.

=== RESPONSE FORMAT ===
- For QUESTIONS: Respond conversationally with markdown formatting
- For SINGLE ACTIONS: Respond with ONLY the JSON action object
- For MULTIPLE ACTIONS: Respond with multiple JSON action objects, one per line (e.g., "move all tasks to todo" should return one MOVE_TASK JSON per task, each on its own line)
- For REPORT REQUESTS: Respond with ONLY the report request JSON object
  Example for bulk move:
  {"action": "MOVE_TASK", "params": {"taskId": "task-1", "listId": "list-id", "listName": "todo"}}
  {"action": "MOVE_TASK", "params": {"taskId": "task-2", "listId": "list-id", "listName": "todo"}}

The current date is provided in the context below.`,

  /**
   * Task decomposer for breaking down tasks into subtasks
   */
  taskDecomposer: `You are a task decomposition expert. Given a task's title, description, and deadline, break it down into actionable subtasks with suggested deadlines and assignees.

Guidelines:
- Create 3-7 subtasks that logically break down the main task
- Each subtask should be specific and actionable
- Subtasks should be completable independently
- Order subtasks in a logical sequence
- Keep subtask titles concise (under 80 characters)
- If parent task has a deadline, distribute subtask deadlines evenly before it
- If no parent deadline, suggest relative deadlines (e.g., +2 days, +4 days, +6 days from today)
- Each subtask deadline should be before the parent deadline (if parent has one)

Assignment Guidelines:
- For each subtask, suggest an assignee (assignee_id) based on:
  1. Similar task patterns: If a member is frequently assigned to similar tasks, consider them for matching subtasks
  2. Parent task assignees: Distribute parent task assignees across subtasks based on their expertise and the subtask content
  3. Semantic matching: Match subtask keywords/content to member's historical assignments and expertise
- If you cannot confidently suggest an assignee for a subtask, omit the assignee_id field (it will be null)
- Only use assignee IDs that are provided in the workspace members list
- Distribute assignees logically - don't assign all subtasks to the same person unless it makes sense

Respond with a JSON array of subtask objects:
[
  { "title": "Subtask title here", "due_date": "2024-01-10", "assignee_id": "user-id-123" },
  { "title": "Another subtask title", "due_date": "2024-01-12" }
]

Fields:
- title: REQUIRED - The subtask title
- due_date: OPTIONAL - YYYY-MM-DD format. If omitted, system will calculate automatically
- assignee_id: OPTIONAL - User ID from the workspace members list. Only include if you can confidently suggest an assignee based on patterns and content matching

Only output the JSON array, no additional text.`,

  /**
   * Smart summary for long content
   */
  summarizer: `You are a concise summarizer. Create a brief summary of the provided content.

Guidelines:
- Keep summaries to 2-3 sentences maximum
- Focus on key points and action items
- Preserve important details like dates, names, and decisions
- Use clear, professional language

Output only the summary text, no additional formatting or explanation.`,

  /**
   * Auto-tagging for suggesting labels and priority
   */
  autoTagger: `You are a task analyzer that suggests appropriate labels, priority, assignees, deadlines, and custom field values.

Given a task's title, description, and patterns from similar historical tasks, analyze and suggest:
1. Priority level (low, medium, high, urgent)
2. Relevant labels from the available options
3. Assignees (user IDs) - suggest based on patterns and task content
4. Due date (YYYY-MM-DD format) - suggest based on patterns and urgency
5. Custom field values - suggest based on patterns and task content

Consider:
- Urgency words like "ASAP", "urgent", "deadline" suggest high/urgent priority
- Technical terms may match specific labels
- Bug reports are typically high priority
- Feature requests are typically medium priority
- Documentation tasks are typically low priority
- Use patterns from similar tasks as strong indicators
- If patterns show a user is frequently assigned to similar tasks, suggest them
- If patterns show average deadline is X days, use that as a guide

Respond with JSON:
{
  "priority": "low" | "medium" | "high" | "urgent",
  "labels": ["label1", "label2"],
  "assignees": ["user-id-1", "user-id-2"],
  "due_date": "2024-01-15",
  "custom_fields": { "field-id-1": "value-1" },
  "reasoning": "Brief explanation"
}

All fields except priority and labels are optional. Only include assignees, due_date, and custom_fields if you have a good reason to suggest them.

Only output the JSON, no additional text.`,

  /**
   * Document chat for answering questions about PDF content
   */
  documentChat: `You are a document analysis assistant. You help users understand and find information in their attached documents.

Guidelines:
- Answer questions based only on the provided document content
- Quote relevant sections when appropriate
- If information isn't in the document, say so clearly
- Be precise and cite specific parts of the document
- Format responses clearly with markdown when helpful

If asked about something not in the document, respond: "I couldn't find that information in the document. The document covers: [brief summary of what it contains]"`,

  /**
   * Rewriter for simplifying task descriptions
   */
  rewriter: `You are a clarity expert. Rewrite the provided task description to make it easy to understand.

Guidelines:
- Simplify complex language into plain, everyday English
- Break down technical jargon and explain it simply
- Keep the original meaning and all important details intact
- Use short sentences and simple words
- Organize information with bullet points when helpful
- Remove unnecessary filler words and redundancy
- Highlight key action items or requirements clearly

Format:
- Output the rewritten description as clean HTML (use <p>, <ul>, <li>, <strong> tags)
- Keep formatting minimal but effective
- Do not add any introduction or explanation, just output the rewritten content`,
};

/**
 * Context types for chat assistant
 */
export type ChatContextTask = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string;
  assignees?: string[];
};

export type ChatContextList = {
  id: string;
  name: string;
};

export type ChatContextMember = {
  id: string;
  name: string;
  email?: string;
};

export type ChatContextLabel = {
  id: string;
  name: string;
  color: string;
};

export type ChatContext = {
  workspaceName?: string;
  boardName?: string;
  tasks?: ChatContextTask[];
  lists?: ChatContextList[];
  members?: ChatContextMember[];
  labels?: ChatContextLabel[];
  userName?: string;
};

/**
 * Build a context string for the chat assistant
 */
export function buildChatContext(context: ChatContext): string {
  const parts: string[] = [];
  
  // Add today's date for reference
  parts.push(`Today's date: ${new Date().toISOString().split('T')[0]}`);

  if (context.userName) {
    parts.push(`Current user: ${context.userName}`);
  }

  if (context.workspaceName) {
    parts.push(`Workspace: ${context.workspaceName}`);
  }

  if (context.boardName) {
    parts.push(`Board: ${context.boardName}`);
  }

  parts.push(""); // Empty line

  // Lists (for creating/moving tasks)
  if (context.lists && context.lists.length > 0) {
    parts.push("=== AVAILABLE LISTS ===");
    for (const list of context.lists) {
      parts.push(`• "${list.name}" (id: ${list.id})`);
    }
    parts.push("");
  }

  // Members (for assigning tasks)
  if (context.members && context.members.length > 0) {
    parts.push("=== WORKSPACE MEMBERS ===");
    for (const member of context.members) {
      parts.push(`• ${member.name}${member.email ? ` (${member.email})` : ""} (id: ${member.id})`);
    }
    parts.push("");
  }

  // Labels (for labeling tasks)
  if (context.labels && context.labels.length > 0) {
    parts.push("=== AVAILABLE LABELS ===");
    for (const label of context.labels) {
      parts.push(`• "${label.name}" (id: ${label.id})`);
    }
    parts.push("");
  }

  // Tasks
  if (context.tasks && context.tasks.length > 0) {
    parts.push(`=== TASKS IN CURRENT CONTEXT (${context.tasks.length} total) ===`);
    parts.push("Use these task IDs when performing actions:");
    for (const task of context.tasks.slice(0, 50)) {
      const details: string[] = [];
      details.push(`id: ${task.id}`);
      details.push(`due: ${task.due_date || "none"}`);
      details.push(`priority: ${task.priority || "none"}`);
      details.push(`status: ${task.status || "unknown"}`);
      if (task.assignees?.length) {
        details.push(`assignees: ${task.assignees.join(", ")}`);
      }

      parts.push(`• "${task.title}" - ${details.join(", ")}`);
    }

    if (context.tasks.length > 50) {
      parts.push(`... and ${context.tasks.length - 50} more tasks`);
    }
    parts.push("=== END OF TASKS ===");
  } else {
    parts.push("=== NO TASKS FOUND IN CURRENT CONTEXT ===");
    parts.push("The user has no tasks in this board/workspace.");
  }

  return parts.join("\n");
}

/**
 * Build prompt for task decomposition
 */
export function buildDecomposePrompt(
  task: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    created_at?: string;
  },
  parentAssignees?: Array<{ id: string; name: string }>,
  similarTaskPatterns?: {
    assignee_ids: string[];
    avg_days_to_deadline: number | null;
    common_priorities: Record<string, number>;
    common_labels: string[];
    custom_field_patterns: Record<string, { value: string; frequency: number }[]>;
    count: number;
  },
  workspaceMembers?: Array<{ id: string; name: string }>
): string {
  let prompt = `Task title: ${task.title}`;
  if (task.description) {
    prompt += `\n\nTask description:\n${task.description}`;
  }
  if (task.due_date) {
    prompt += `\n\nParent task deadline: ${task.due_date}`;
    prompt += `\nIMPORTANT: All subtask deadlines must be before ${task.due_date}. Distribute them evenly across the time period.`;
  } else {
    prompt += `\n\nNo parent deadline set. Suggest relative deadlines (e.g., +2 days, +4 days from today).`;
  }
  const today = new Date().toISOString().split("T")[0];
  prompt += `\nToday's date: ${today}`;

  // Add parent task assignees
  if (parentAssignees && parentAssignees.length > 0) {
    prompt += `\n\n--- Parent Task Assignees ---`;
    for (const assignee of parentAssignees) {
      prompt += `\n• ${assignee.name} (id: ${assignee.id})`;
    }
    prompt += `\nConsider distributing these assignees across subtasks based on their expertise and the subtask content.`;
  }

  // Add similar task patterns
  if (similarTaskPatterns && similarTaskPatterns.count > 0) {
    prompt += `\n\n--- Patterns from ${similarTaskPatterns.count} similar task${similarTaskPatterns.count !== 1 ? "s" : ""} ---`;
    
    if (similarTaskPatterns.assignee_ids.length > 0 && workspaceMembers) {
      const assigneeNames = similarTaskPatterns.assignee_ids
        .map((id) => {
          const member = workspaceMembers.find((m) => m.id === id);
          return member ? `${member.name} (id: ${id})` : null;
        })
        .filter((n): n is string => n !== null);
      if (assigneeNames.length > 0) {
        prompt += `\n- Common assignees for similar tasks: ${assigneeNames.join(", ")}`;
        prompt += `\n  Consider assigning subtasks to these members if the subtask content matches their typical work.`;
      }
    }
  }

  // Add workspace members list
  if (workspaceMembers && workspaceMembers.length > 0) {
    prompt += `\n\n--- Available Workspace Members ---`;
    for (const member of workspaceMembers) {
      prompt += `\n• ${member.name} (id: ${member.id})`;
    }
    prompt += `\nUse these member IDs when suggesting assignees for subtasks.`;
  }

  return prompt;
}

/**
 * Build prompt for auto-tagging
 */
export function buildAutoTagPrompt(
  task: { title: string; description?: string | null },
  availableLabels: string[],
  patterns?: {
    assignee_ids: string[];
    avg_days_to_deadline: number | null;
    common_priorities: Record<string, number>;
    common_labels: string[];
    custom_field_patterns: Record<string, { value: string; frequency: number }[]>;
    count: number;
  },
  workspaceMembers?: Array<{ id: string; name: string }>,
  customFields?: Array<{ id: string; name: string; field_type: string; options?: string[] }>
): string {
  let prompt = `Task title: ${task.title}`;
  if (task.description) {
    prompt += `\n\nTask description:\n${task.description}`;
  }
  prompt += `\n\nAvailable labels: ${availableLabels.join(", ")}`;

  // Add patterns from similar tasks (compact format)
  if (patterns && patterns.count > 0) {
    prompt += `\n\n--- Patterns from ${patterns.count} similar task${patterns.count !== 1 ? "s" : ""} ---`;

    // Assignees
    if (patterns.assignee_ids.length > 0 && workspaceMembers) {
      const assigneeNames = patterns.assignee_ids
        .map((id) => {
          const member = workspaceMembers.find((m) => m.id === id);
          return member ? `${member.name} (id: ${id})` : null;
        })
        .filter((n): n is string => n !== null);
      if (assigneeNames.length > 0) {
        prompt += `\n- Common assignees: ${assigneeNames.join(", ")}`;
      }
    }

    // Deadline pattern
    if (patterns.avg_days_to_deadline !== null) {
      prompt += `\n- Average deadline: ${patterns.avg_days_to_deadline} days from creation`;
    }

    // Priority pattern
    if (Object.keys(patterns.common_priorities).length > 0) {
      const priorityEntries = Object.entries(patterns.common_priorities)
        .sort((a, b) => b[1] - a[1])
        .map(([p, count]) => `${p} (${count}/${patterns.count})`)
        .join(", ");
      prompt += `\n- Common priorities: ${priorityEntries}`;
    }

    // Labels pattern
    if (patterns.common_labels.length > 0) {
      prompt += `\n- Common labels: ${patterns.common_labels.join(", ")}`;
    }

    // Custom field patterns
    if (patterns.custom_field_patterns && Object.keys(patterns.custom_field_patterns).length > 0 && customFields) {
      for (const [fieldId, valuePatterns] of Object.entries(patterns.custom_field_patterns)) {
        const field = customFields.find((f) => f.id === fieldId);
        if (field) {
          const patternStr = valuePatterns
            .map((vp) => `"${vp.value}" (${vp.frequency}%)`)
            .join(", ");
          prompt += `\n- Custom field "${field.name}": ${patternStr}`;
        }
      }
    }
  } else {
    prompt += `\n\nNo similar tasks found. Use general heuristics.`;
  }

  // Add available workspace members
  if (workspaceMembers && workspaceMembers.length > 0) {
    prompt += `\n\nAvailable assignees: ${workspaceMembers.map((m) => `${m.name} (id: ${m.id})`).join(", ")}`;
  }

  // Add custom fields info
  if (customFields && customFields.length > 0) {
    prompt += `\n\nCustom fields:`;
    for (const field of customFields) {
      if (field.field_type === "dropdown" && field.options) {
        prompt += `\n- "${field.name}" (id: ${field.id}): dropdown with options [${field.options.join(", ")}]`;
      } else {
        prompt += `\n- "${field.name}" (id: ${field.id}): ${field.field_type}`;
      }
    }
  }

  const today = new Date().toISOString().split("T")[0];
  prompt += `\n\nToday's date: ${today}`;

  return prompt;
}

/**
 * Build prompt for document chat
 */
export function buildDocumentChatPrompt(
  documentContent: string,
  question: string
): string {
  return `Document content:\n---\n${documentContent}\n---\n\nUser question: ${question}`;
}
