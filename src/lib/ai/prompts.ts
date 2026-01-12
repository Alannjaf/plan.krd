/**
 * System prompts for AI features in Plan.krd
 */

export const SYSTEM_PROMPTS = {
  /**
   * Chat assistant for natural language queries about tasks
   */
  chatAssistant: `You are an AI assistant for Plan.krd, a task management platform. You help users find and understand their tasks, boards, and workspaces.

You have access to the user's workspace context including:
- Current workspace and boards
- Tasks with their details (title, description, due dates, priority, assignees, labels)
- Lists/columns in boards

When users ask questions like:
- "Show me tasks due this week" - List tasks with due dates in the current week
- "What's assigned to me?" - Show tasks assigned to the current user
- "High priority tasks" - Filter by priority
- "Tasks in [board name]" - Filter by board

Guidelines:
- Be concise and helpful
- Format task lists clearly with titles and key details
- If you can't find specific data, explain what you searched for
- Use markdown formatting for readability
- When listing tasks, include: title, due date (if set), priority (if set), and status

Always respond in a friendly, professional tone.`,

  /**
   * Task decomposer for breaking down tasks into subtasks
   */
  taskDecomposer: `You are a task decomposition expert. Given a task's title and description, break it down into actionable subtasks.

Guidelines:
- Create 3-7 subtasks that logically break down the main task
- Each subtask should be specific and actionable
- Subtasks should be completable independently
- Order subtasks in a logical sequence
- Keep subtask titles concise (under 80 characters)

Respond with a JSON array of subtask objects:
[
  { "title": "Subtask title here" },
  { "title": "Another subtask title" }
]

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
  autoTagger: `You are a task analyzer that suggests appropriate labels and priority levels.

Given a task's title and description, analyze it and suggest:
1. Priority level (low, medium, high, urgent)
2. Relevant labels from the available options

Consider:
- Urgency words like "ASAP", "urgent", "deadline" suggest high/urgent priority
- Technical terms may match specific labels
- Bug reports are typically high priority
- Feature requests are typically medium priority
- Documentation tasks are typically low priority

Respond with JSON:
{
  "priority": "low" | "medium" | "high" | "urgent",
  "labels": ["label1", "label2"],
  "reasoning": "Brief explanation"
}

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
};

/**
 * Build a context string for the chat assistant
 */
export function buildChatContext(context: {
  workspaceName?: string;
  boardName?: string;
  tasks?: Array<{
    id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority?: string | null;
    status?: string;
    assignees?: string[];
  }>;
  userName?: string;
}): string {
  const parts: string[] = [];

  if (context.userName) {
    parts.push(`Current user: ${context.userName}`);
  }

  if (context.workspaceName) {
    parts.push(`Workspace: ${context.workspaceName}`);
  }

  if (context.boardName) {
    parts.push(`Board: ${context.boardName}`);
  }

  if (context.tasks && context.tasks.length > 0) {
    parts.push(`\nTasks in current context (${context.tasks.length} total):`);
    for (const task of context.tasks.slice(0, 50)) {
      const details: string[] = [];
      if (task.due_date) details.push(`due: ${task.due_date}`);
      if (task.priority) details.push(`priority: ${task.priority}`);
      if (task.status) details.push(`status: ${task.status}`);
      if (task.assignees?.length) details.push(`assignees: ${task.assignees.join(", ")}`);

      const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";
      parts.push(`- [${task.id}] ${task.title}${detailStr}`);
    }

    if (context.tasks.length > 50) {
      parts.push(`... and ${context.tasks.length - 50} more tasks`);
    }
  }

  return parts.join("\n");
}

/**
 * Build prompt for task decomposition
 */
export function buildDecomposePrompt(task: {
  title: string;
  description?: string | null;
}): string {
  let prompt = `Task title: ${task.title}`;
  if (task.description) {
    prompt += `\n\nTask description:\n${task.description}`;
  }
  return prompt;
}

/**
 * Build prompt for auto-tagging
 */
export function buildAutoTagPrompt(
  task: { title: string; description?: string | null },
  availableLabels: string[]
): string {
  let prompt = `Task title: ${task.title}`;
  if (task.description) {
    prompt += `\n\nTask description:\n${task.description}`;
  }
  prompt += `\n\nAvailable labels: ${availableLabels.join(", ")}`;
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
