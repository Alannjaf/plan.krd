/**
 * AI Writing Assistant Core Logic
 * Enhances task descriptions and generates content
 */

import { chatCompletion, parseJsonResponse, type Message } from "@/lib/ai/openrouter";
import { logger } from "@/lib/utils/logger";

export type ImprovedDescription = {
  improved_text: string;
  changes_made: string[];
  reasoning: string;
};

export type MeetingNotes = {
  summary: string;
  action_items: Array<{
    item: string;
    assignee?: string;
    due_date?: string;
  }>;
  decisions: string[];
  next_steps: string[];
};

export type TaskTemplate = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  suggested_labels: string[];
  suggested_assignees?: string[];
  custom_fields?: Record<string, string>;
};

export type UserStory = {
  as_a: string;
  i_want: string;
  so_that: string;
  acceptance_criteria: string[];
};

/**
 * Improve task description for clarity, grammar, and structure
 */
export async function improveDescription(
  text: string,
  context?: {
    task_title?: string;
    field_type?: "description" | "comment" | "title";
  }
): Promise<{ success: boolean; improved?: ImprovedDescription; error?: string }> {
  try {
    const fieldType = context?.field_type || "description";
    
    // Strip HTML tags from input text for AI processing (but preserve content)
    const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    
    // Remove "Task:" prefix if present in description
    let cleanedText = plainText;
    if (fieldType === "description") {
      cleanedText = plainText.replace(/^Task:\s*/i, "").trim();
    }
    
    const prompt = `Improve and enhance this ${fieldType} for clarity, grammar, structure, and simplicity:

${cleanedText}

${context?.task_title ? `Task title: ${context.task_title}` : ""}

Your task is to comprehensively improve the text by:
1. **Grammar & Spelling**: Fix all errors
2. **Clarity & Readability**: Make it clear and easy to understand
3. **Simplification**: Simplify complex language, break down technical jargon into plain English
4. **Structure & Organization**: Improve flow and organization
5. **Remove Redundancy**: Eliminate unnecessary filler words
6. **Actionability**: Make it more actionable if applicable

CRITICAL RULES:
${fieldType === "title" 
  ? `- **Titles MUST be VERY SHORT**: Maximum 5-8 words, ideally 3-5 words
- Keep titles concise, clear, and action-oriented
- Remove any unnecessary words, articles, or filler
- Focus on the core action or subject
- Examples of good short titles: "Update OOH Designs", "Fix Login Bug", "Review Marketing Copy"
- Examples of BAD long titles: "Duhok Out-of-Home (OOH) Advertising Design Project Update" (too long!)
- Return ONLY the improved title text, no prefixes, no "Task:" label`
  : `- **Descriptions**: Use short sentences, organize with bullet points when helpful, highlight key action items
- **NEVER include "Task:" prefix or any task label in the description**
- Start directly with the content, no introductory labels
- Remove any existing "Task:" or similar prefixes if present`}

IMPORTANT: Return the improved text as clean HTML. Use proper HTML tags:
- Use <p> for paragraphs
- Use <strong> or <b> for bold text
- Use <em> or <i> for italic text
- Use <ul> and <li> for lists
- Use <h3>, <h4> for headings if needed
- Do NOT use Markdown syntax (no ###, **, *, etc.)
- Do NOT include raw markdown symbols
${fieldType === "title" ? "- For titles: Return plain text only (no HTML tags, will be stripped anyway)" : ""}

Return JSON:
{
  "improved_text": "${fieldType === "title" ? "Improved title text (plain text, no HTML)" : "<p>Improved text as HTML here</p>"}",
  "changes_made": ["change1", "change2"],
  "reasoning": "Brief explanation of improvements"
}`;

    const systemPrompt = fieldType === "title"
      ? `You are a writing expert specializing in creating very short, concise task titles. Your titles MUST be 3-8 words maximum, ideally 3-5 words. Focus on the core action or subject. Remove all unnecessary words, articles, and filler. Never include prefixes like "Task:" or labels. Return only the improved title as plain text.`
      : `You are a writing expert that comprehensively improves text by fixing grammar, enhancing clarity, simplifying complex language, improving structure, and making content more actionable - all while preserving the original meaning. NEVER include "Task:" prefixes or task labels in descriptions. Always return improved text as clean, valid HTML (not Markdown). Use proper HTML tags like <p>, <strong>, <ul>, <li>, etc.`;

    const messages: Message[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to improve description" };
    }

    const improved = parseJsonResponse<ImprovedDescription>(result.content);

    if (!improved || !improved.improved_text) {
      return { success: false, error: "Failed to parse AI response" };
    }

    return { success: true, improved };
  } catch (error) {
    logger.error("Error improving description", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate meeting notes from task comments
 */
export async function generateMeetingNotes(
  comments: Array<{
    content: string;
    author: string;
    created_at: string;
  }>,
  context?: {
    task_title?: string;
    task_description?: string;
  }
): Promise<{ success: boolean; notes?: MeetingNotes; error?: string }> {
  try {
    const commentsText = comments
      .map((c) => `[${c.author} at ${c.created_at}]: ${c.content}`)
      .join("\n\n");

    const prompt = `Generate structured meeting notes from these task comments:

Task: ${context?.task_title || "Unknown"}
${context?.task_description ? `Description: ${context.task_description}` : ""}

Comments:
${commentsText}

Extract:
1. Summary of discussion
2. Action items (with assignees and due dates if mentioned)
3. Decisions made
4. Next steps

Return JSON:
{
  "summary": "Brief summary of the discussion",
  "action_items": [
    {
      "item": "Action item description",
      "assignee": "Name if mentioned",
      "due_date": "YYYY-MM-DD if mentioned"
    }
  ],
  "decisions": ["decision1", "decision2"],
  "next_steps": ["step1", "step2"]
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a meeting notes expert. Extract structured information from discussions including action items, decisions, and next steps.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.4 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to generate meeting notes" };
    }

    const notes = parseJsonResponse<MeetingNotes>(result.content);

    if (!notes || !notes.summary) {
      return { success: false, error: "Failed to parse AI response" };
    }

    return { success: true, notes };
  } catch (error) {
    logger.error("Error generating meeting notes", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create task template from existing task patterns
 */
export async function createTemplateFromTasks(
  tasks: Array<{
    title: string;
    description?: string;
    priority?: string;
    labels?: string[];
    assignees?: string[];
    custom_fields?: Record<string, string>;
  }>
): Promise<{ success: boolean; template?: TaskTemplate; error?: string }> {
  try {
    const prompt = `Analyze these tasks and create a reusable template:

Tasks:
${JSON.stringify(tasks, null, 2)}

Identify common patterns:
- Title structure/format
- Description style
- Typical priority
- Common labels
- Typical assignees
- Custom field patterns

Create a template that captures the essence of these tasks.

Return JSON:
{
  "title": "Template title pattern (use placeholders like {feature}, {component})",
  "description": "Template description with placeholders",
  "priority": "low" | "medium" | "high" | "urgent",
  "suggested_labels": ["label1", "label2"],
  "suggested_assignees": ["user-id-1"],
  "custom_fields": {
    "field-id": "typical-value"
  }
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a task template expert. Create reusable templates from task patterns that capture common structures and requirements.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to create template" };
    }

    const template = parseJsonResponse<TaskTemplate>(result.content);

    if (!template || !template.title) {
      return { success: false, error: "Failed to parse AI response" };
    }

    return { success: true, template };
  } catch (error) {
    logger.error("Error creating template", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate user story from task description
 */
export async function generateUserStory(
  description: string,
  context?: {
    task_title?: string;
  }
): Promise<{ success: boolean; user_story?: UserStory; error?: string }> {
  try {
    const prompt = `Convert this task into a user story format:

Task: ${context?.task_title || "Unknown"}
Description: ${description}

Create a user story in the format:
"As a [user type], I want [goal], so that [benefit]"

Also include acceptance criteria.

Return JSON:
{
  "as_a": "user type (e.g., 'developer', 'product manager', 'end user')",
  "i_want": "what the user wants to accomplish",
  "so_that": "the benefit or reason",
  "acceptance_criteria": [
    "criterion 1",
    "criterion 2"
  ]
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a product management expert. Convert task descriptions into well-structured user stories with clear acceptance criteria.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.4 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to generate user story" };
    }

    const userStory = parseJsonResponse<UserStory>(result.content);

    if (!userStory || !userStory.as_a || !userStory.i_want || !userStory.so_that) {
      return { success: false, error: "Failed to parse AI response" };
    }

    return { success: true, user_story: userStory };
  } catch (error) {
    logger.error("Error generating user story", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
