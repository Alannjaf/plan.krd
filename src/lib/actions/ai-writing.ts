"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";
import {
  improveDescription,
  generateMeetingNotes,
  createTemplateFromTasks,
  generateUserStory,
  type ImprovedDescription,
  type MeetingNotes,
  type TaskTemplate,
  type UserStory,
} from "@/lib/ai/writing";
import { updateTask } from "./tasks";

/**
 * Convert markdown to HTML (fallback if AI returns markdown)
 */
function convertMarkdownToHtml(text: string): string {
  if (!text) return "";
  
  // If it's already HTML (contains tags), return as-is
  if (text.includes("<") && text.includes(">") && !text.includes("###") && !text.includes("**")) {
    return text;
  }
  
  // Split into lines for processing
  const lines = text.split("\n");
  const result: string[] = [];
  let inList = false;
  let inParagraph = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      continue;
    }
    
    // Headers
    if (line.startsWith("### ")) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(`<h3>${line.substring(4)}</h3>`);
      continue;
    }
    
    if (line.startsWith("## ")) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(`<h2>${line.substring(3)}</h2>`);
      continue;
    }
    
    if (line.startsWith("# ")) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(`<h1>${line.substring(2)}</h1>`);
      continue;
    }
    
    // List items
    if (line.match(/^[\*\-]\s+/)) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      const listContent = line.replace(/^[\*\-]\s+/, "");
      // Process bold/italic in list items
      const processedContent = listContent
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      result.push(`<li>${processedContent}</li>`);
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      result.push("</ul>");
      inList = false;
    }
    
    if (!inParagraph) {
      result.push("<p>");
      inParagraph = true;
    } else {
      result.push("<br/>");
    }
    
    // Process bold and italic
    let processedLine = line
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.*?)__/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/_(.*?)_/g, "<em>$1</em>");
    
    result.push(processedLine);
  }
  
  // Close any open tags
  if (inParagraph) {
    result.push("</p>");
  }
  if (inList) {
    result.push("</ul>");
  }
  
  let html = result.join("");
  
  // Clean up
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>\s*<\/p>/g, "");
  
  // If no HTML tags at all, wrap in paragraph
  if (!html.includes("<")) {
    html = `<p>${html}</p>`;
  }
  
  return html;
}

/**
 * Improve task description and optionally store suggestion
 */
export async function improveAndStoreDescription(
  taskId: string,
  fieldType: "description" | "comment" | "title" = "description",
  apply: boolean = false,
  taskTitle?: string
): Promise<{ success: boolean; improved?: ImprovedDescription; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    let originalText =
      fieldType === "description"
        ? task.description || ""
        : fieldType === "title"
          ? task.title
          : "";

    if (!originalText) {
      return { success: false, error: "No text to improve" };
    }

    // Remove "Task:" prefix from description if present before processing
    if (fieldType === "description") {
      originalText = originalText.replace(/^Task:\s*/i, "").trim();
      // Also remove from HTML content
      originalText = originalText.replace(/<p>Task:\s*/i, "<p>").replace(/<p>\s*Task:\s*/i, "<p>");
    }

    // Generate improvement
    const result = await improveDescription(originalText, {
      task_title: taskTitle || task.title,
      field_type: fieldType,
    });

    if (!result.success || !result.improved) {
      return result;
    }

    // Store suggestion if not applying immediately
    if (!apply) {
      const { error: insertError } = await supabase.from("ai_writing_suggestions").insert({
        task_id: taskId,
        field_type: fieldType,
        original_text: originalText,
        suggested_text: result.improved.improved_text,
        reasoning: result.improved.reasoning,
        status: "pending",
      });

      if (insertError) {
        logger.error("Error storing writing suggestion", insertError);
      }
    } else {
      // Convert markdown to HTML if needed (fallback)
      let cleanedText = result.improved.improved_text;
      
      // If text contains markdown symbols but no HTML tags, convert it
      if ((cleanedText.includes("###") || cleanedText.includes("**") || cleanedText.includes("* ")) 
          && !cleanedText.includes("<")) {
        cleanedText = convertMarkdownToHtml(cleanedText);
      }
      
      // Apply the improvement
      if (fieldType === "description") {
        // Remove any "Task:" prefixes that might have been added
        cleanedText = cleanedText.replace(/^Task:\s*/i, "").trim();
        // Also remove from HTML content
        cleanedText = cleanedText.replace(/<p>Task:\s*/i, "<p>").replace(/<p>\s*Task:\s*/i, "<p>");
        
        const updateResult = await updateTask(taskId, {
          description: cleanedText,
        });
        if (!updateResult.success) {
          return { success: false, error: updateResult.error || "Failed to update task" };
        }
      } else if (fieldType === "title") {
        // For title, strip HTML tags and ensure it's very short
        let plainTitle = cleanedText.replace(/<[^>]*>/g, "").trim();
        // Remove any "Task:" prefixes
        plainTitle = plainTitle.replace(/^Task:\s*/i, "").trim();
        // Limit title length to ensure it's short (max 100 characters as a safety)
        if (plainTitle.length > 100) {
          plainTitle = plainTitle.substring(0, 97) + "...";
        }
        
        const updateResult = await updateTask(taskId, {
          title: plainTitle,
        });
        if (!updateResult.success) {
          return { success: false, error: updateResult.error || "Failed to update task" };
        }
      }

      // Mark suggestion as accepted
      await supabase
        .from("ai_writing_suggestions")
        .update({ status: "accepted" })
        .eq("task_id", taskId)
        .eq("field_type", fieldType)
        .eq("status", "pending");
      
      // Update the improved text in the result
      result.improved.improved_text = cleanedText;
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true, improved: result.improved };
  } catch (error) {
    logger.error("Error improving description", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored writing suggestions for a task
 */
export async function getWritingSuggestions(
  taskId: string
): Promise<{
  success: boolean;
  suggestions?: Array<{
    id: string;
    field_type: string;
    original_text: string;
    suggested_text: string;
    reasoning: string | null;
    status: string;
    created_at: string;
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data: suggestions, error } = await supabase
      .from("ai_writing_suggestions")
      .select("*")
      .eq("task_id", taskId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching writing suggestions", error);
      return { success: false, error: "Failed to fetch suggestions" };
    }

    return { success: true, suggestions: suggestions || [] };
  } catch (error) {
    logger.error("Error getting writing suggestions", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Accept or reject a writing suggestion
 */
export async function respondToWritingSuggestion(
  suggestionId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from("ai_writing_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (fetchError || !suggestion) {
      return { success: false, error: "Suggestion not found" };
    }

    if (accept) {
      // Apply the suggestion
      if (suggestion.field_type === "description") {
        await updateTask(suggestion.task_id, {
          description: suggestion.suggested_text,
        });
      } else if (suggestion.field_type === "title") {
        await updateTask(suggestion.task_id, {
          title: suggestion.suggested_text,
        });
      }
    }

    // Update suggestion status
    const { error: updateError } = await supabase
      .from("ai_writing_suggestions")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", suggestionId);

    if (updateError) {
      logger.error("Error updating suggestion status", updateError);
      return { success: false, error: "Failed to update suggestion" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true };
  } catch (error) {
    logger.error("Error responding to writing suggestion", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate meeting notes from task comments
 */
export async function generateNotesFromComments(
  taskId: string
): Promise<{ success: boolean; notes?: MeetingNotes; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task comments
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles:profiles!comments_user_id_fkey(full_name, email)
      `)
      .eq("task_id", taskId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });

    if (commentsError) {
      return { success: false, error: "Failed to fetch comments" };
    }

    // Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, description")
      .eq("id", taskId)
      .single();

    const commentsWithAuthors =
      comments?.map((c) => {
        const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          content: c.content,
          author: profile?.full_name || profile?.email || "Unknown",
          created_at: c.created_at,
        };
      }) || [];

    const result = await generateMeetingNotes(commentsWithAuthors, {
      task_title: task?.title,
      task_description: task?.description || undefined,
    });

    return result;
  } catch (error) {
    logger.error("Error generating meeting notes", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create task template from existing tasks
 */
export async function createTaskTemplate(
  boardId: string,
  taskIds: string[]
): Promise<{ success: boolean; template?: TaskTemplate; error?: string }> {
  const supabase = await createClient();

  try {
    // Get tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        priority,
        task_labels(label_id, labels(name)),
        task_assignees(user_id)
      `)
      .in("id", taskIds)
      .limit(20);

    if (tasksError || !tasks) {
      return { success: false, error: "Failed to fetch tasks" };
    }

    const tasksData = tasks.map((t) => {
      const labels = Array.isArray(t.task_labels)
        ? t.task_labels.map((tl: any) => {
            const label = Array.isArray(tl.labels) ? tl.labels[0] : tl.labels;
            return label?.name || "";
          })
        : [];
      const assignees = Array.isArray(t.task_assignees)
        ? t.task_assignees.map((ta: any) => ta.user_id)
        : [];

      return {
        title: t.title,
        description: t.description || "",
        priority: t.priority || "medium",
        labels: labels.filter((l) => l),
        assignees,
      };
    });

    const result = await createTemplateFromTasks(tasksData);
    return result;
  } catch (error) {
    logger.error("Error creating task template", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate user story from task description
 */
export async function generateTaskUserStory(
  taskId: string
): Promise<{ success: boolean; user_story?: UserStory; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    const description = task.description || task.title;

    const result = await generateUserStory(description, {
      task_title: task.title,
    });

    return result;
  } catch (error) {
    logger.error("Error generating user story", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
