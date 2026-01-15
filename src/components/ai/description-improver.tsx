"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { improveAndStoreDescription } from "@/lib/actions/ai-writing";
import { toast } from "sonner";

interface DescriptionImproverProps {
  taskId: string;
  currentText: string;
  fieldType?: "description" | "comment" | "title";
  taskTitle?: string; // Task title to improve along with description
  onImproved?: (improvedText: string) => void;
  onTitleImproved?: (improvedTitle: string) => void; // Callback for title improvements
  improveBoth?: boolean; // If true, improve both title and description
}

export function DescriptionImprover({
  taskId,
  currentText,
  fieldType = "description",
  taskTitle,
  onImproved,
  onTitleImproved,
  improveBoth = false,
}: DescriptionImproverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [improvedText, setImprovedText] = useState("");
  const [improvedTitle, setImprovedTitle] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [titleChanges, setTitleChanges] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [titleReasoning, setTitleReasoning] = useState("");

  // Helper to convert markdown to HTML if needed
  const convertMarkdownToHtml = (text: string): string => {
    if (!text) return "";
    
    // If it's already HTML (contains tags), return as-is
    if (text.includes("<") && text.includes(">") && !text.includes("###") && !text.includes("**")) {
      return text;
    }
    
    // Convert markdown to HTML
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      // Bold
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.*?)__/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/_(.*?)_/g, "<em>$1</em>")
      // Line breaks
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
    
    // Handle lists
    const lines = html.split("</p><p>");
    let inList = false;
    let result: string[] = [];
    
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[\*\-]\s+/)) {
        if (!inList) {
          result.push("<ul>");
          inList = true;
        }
        const listContent = trimmed.replace(/^[\*\-]\s+/, "");
        result.push(`<li>${listContent}</li>`);
      } else {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        result.push(trimmed);
      }
    }
    
    if (inList) {
      result.push("</ul>");
    }
    
    html = result.join("");
    
    // Wrap in paragraph if not already wrapped
    if (!html.startsWith("<")) {
      html = "<p>" + html + "</p>";
    }
    
    // Clean up
    html = html.replace(/<p><\/p>/g, "");
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/<li>(.*?)<br\/><\/li>/g, "<li>$1</li>");
    
    return html;
  };

  // Get the HTML version of improved text for display
  // Remove "Task:" prefix if present
  const cleanedImprovedText = improvedText 
    ? improvedText.replace(/^Task:\s*/i, "").replace(/<p>Task:\s*/i, "<p>").replace(/<p>\s*Task:\s*/i, "<p>").trim()
    : "";
  const improvedTextHtml = cleanedImprovedText ? convertMarkdownToHtml(cleanedImprovedText) : "";
  
  // Also clean the current text for display
  const cleanedCurrentText = currentText 
    ? currentText.replace(/^Task:\s*/i, "").replace(/<p>Task:\s*/i, "<p>").replace(/<p>\s*Task:\s*/i, "<p>").trim()
    : "";

  const handleImprove = async () => {
    const minLength = fieldType === "title" ? 3 : 10;
    const plainTextLength = currentText.replace(/<[^>]*>/g, "").trim().length;
    
    if (plainTextLength < minLength) {
      toast.error(`Text is too short. Minimum ${minLength} characters required.`);
      return;
    }
    
    setIsImproving(true);
    try {
      // If improveBoth is true and we have a title, improve both
      if (improveBoth && taskTitle && taskTitle.length >= 3) {
        const [descriptionResult, titleResult] = await Promise.all([
          improveAndStoreDescription(taskId, "description", false, taskTitle),
          improveAndStoreDescription(taskId, "title", false, taskTitle),
        ]);
        
        if (descriptionResult.success && descriptionResult.improved) {
          setImprovedText(descriptionResult.improved.improved_text);
          setChanges(descriptionResult.improved.changes_made || []);
          setReasoning(descriptionResult.improved.reasoning || "");
        }
        
        if (titleResult.success && titleResult.improved) {
          setImprovedTitle(titleResult.improved.improved_text);
          setTitleChanges(titleResult.improved.changes_made || []);
          setTitleReasoning(titleResult.improved.reasoning || "");
        }
        
        if (descriptionResult.success || titleResult.success) {
          setIsOpen(true);
        } else {
          toast.error(descriptionResult.error || titleResult.error || "Failed to improve text");
        }
      } else {
        // Improve only the current field
        const result = await improveAndStoreDescription(
          taskId, 
          fieldType, 
          false,
          taskTitle
        );
        if (result.success && result.improved) {
          setImprovedText(result.improved.improved_text);
          setChanges(result.improved.changes_made || []);
          setReasoning(result.improved.reasoning || "");
          setIsOpen(true);
        } else {
          toast.error(result.error || "Failed to improve text");
        }
      }
    } catch (error) {
      toast.error("Failed to improve text");
    } finally {
      setIsImproving(false);
    }
  };

  const handleApply = () => {
    if (!improvedText && !improvedTitle) return;
    
    // Optimistically update UI immediately
    if (improveBoth && improvedTitle) {
      // Apply both improvements optimistically
      if (improvedText && onImproved) {
        // Remove "Task:" prefix before applying
        const cleaned = cleanedImprovedText || improvedText.replace(/^Task:\s*/i, "").replace(/<p>Task:\s*/i, "<p>").trim();
        onImproved(cleaned);
      }
      
      if (improvedTitle && onTitleImproved) {
        const plainTitle = improvedTitle.replace(/<[^>]*>/g, "").replace(/^Task:\s*/i, "").trim();
        onTitleImproved(plainTitle);
      }
      
      // Close dialog immediately
      setIsOpen(false);
      
      // Save to server in background (fire and forget)
      Promise.all([
        improvedText ? improveAndStoreDescription(taskId, "description", true, taskTitle) : Promise.resolve({ success: true }),
        improvedTitle ? improveAndStoreDescription(taskId, "title", true, taskTitle) : Promise.resolve({ success: true }),
      ]).catch((error) => {
        console.error("Failed to save improvements:", error);
        toast.error("Failed to save improvements. Please refresh the page.");
      });
    } else {
      // Apply single improvement optimistically
      let improved = improvedText;
      
      // Remove "Task:" prefix if present
      if (fieldType === "description") {
        improved = cleanedImprovedText || improvedText.replace(/^Task:\s*/i, "").replace(/<p>Task:\s*/i, "<p>").trim();
      }
      
      if (fieldType === "title" && onTitleImproved) {
        const plainTitle = improved.replace(/<[^>]*>/g, "").replace(/^Task:\s*/i, "").trim();
        onTitleImproved(plainTitle);
      } else if (onImproved && improved) {
        onImproved(improved);
      }
      
      // Close dialog immediately
      setIsOpen(false);
      
      // Save to server in background (fire and forget)
      improveAndStoreDescription(taskId, fieldType, true, taskTitle).catch((error) => {
        console.error("Failed to save improvement:", error);
        toast.error("Failed to save improvement. Please refresh the page.");
      });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleImprove}
        disabled={isImproving || !currentText || currentText.replace(/<[^>]*>/g, "").trim().length < (fieldType === "title" ? 3 : 10)}
      >
        {isImproving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="ml-2">Improve</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {improveBoth && improvedTitle ? "Improved Title & Description" : `Improved ${fieldType === "title" ? "Title" : "Description"}`}
            </DialogTitle>
            <DialogDescription>
              Review the AI-suggested improvements below
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 flex-1 overflow-y-auto pr-2 min-h-0">
            {/* Title improvement section */}
            {improveBoth && improvedTitle && taskTitle && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-sm font-semibold">Title</h3>
                {titleReasoning && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">Reasoning:</p>
                    <p className="text-sm text-muted-foreground">{titleReasoning}</p>
                  </div>
                )}
                {titleChanges.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Changes made:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      {titleChanges.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Original:</p>
                  <div className="p-3 border rounded-md bg-muted/30 min-h-[60px] max-h-[150px] overflow-y-auto">
                    <p className="text-sm">{taskTitle}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Improved:</p>
                  <div className="p-3 border rounded-md bg-primary/5 min-h-[60px] max-h-[150px] overflow-y-auto">
                    <p className="text-sm">{improvedTitle.replace(/<[^>]*>/g, "").trim()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Description improvement section */}
            {improvedText && (
              <div className="space-y-4">
                {improveBoth && improvedTitle && <h3 className="text-sm font-semibold">Description</h3>}
                {reasoning && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">Reasoning:</p>
                    <p className="text-sm text-muted-foreground">{reasoning}</p>
                  </div>
                )}
                {changes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Changes made:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      {changes.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Original:</p>
                  <div className="p-3 border rounded-md bg-muted/30 min-h-[100px] max-h-[200px] overflow-y-auto">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: cleanedCurrentText || currentText || "" }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Improved:</p>
                  <div className="p-3 border rounded-md bg-primary/5 min-h-[100px] max-h-[200px] overflow-y-auto">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: improvedTextHtml }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleApply}>
              <Check className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
