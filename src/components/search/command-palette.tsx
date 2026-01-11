"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { globalSearch, type SearchResult } from "@/lib/actions/search";
import { Search, Loader2, LayoutDashboard, FolderKanban, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Listen for keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const data = await globalSearch(query);
      setResults(data);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery("");

    if (result.type === "workspace") {
      router.push(`/${result.workspaceId}`);
    } else if (result.type === "board") {
      router.push(`/${result.workspaceId}/${result.boardId}`);
    } else if (result.type === "task") {
      // Navigate to board and open task modal (via URL param)
      router.push(`/${result.workspaceId}/${result.boardId}?task=${result.id}`);
    }
  }, [router]);

  const getIcon = (type: string) => {
    switch (type) {
      case "workspace":
        return <FolderKanban className="h-4 w-4" />;
      case "board":
        return <LayoutDashboard className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "workspace":
        return "Workspace";
      case "board":
        return "Board";
      case "task":
        return "Task";
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-2xl" showCloseButton={false}>
        <VisuallyHidden>
          <DialogTitle>Search</DialogTitle>
        </VisuallyHidden>
        <Command className="rounded-lg border-0" shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search workspaces, boards, and tasks..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {query.length >= 2 && !isLoading && results.length === 0 && (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </Command.Empty>
            )}

            {query.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
              </div>
            )}

            {results.length > 0 && (
              <>
                {/* Group by type */}
                {["workspace", "board", "task"].map((type) => {
                  const typeResults = results.filter((r) => r.type === type);
                  if (typeResults.length === 0) return null;

                  return (
                    <Command.Group key={type} heading={getTypeLabel(type) + "s"} className="mb-2">
                      {typeResults.map((result) => (
                        <Command.Item
                          key={`${result.type}-${result.id}`}
                          onSelect={() => handleSelect(result)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer",
                            "aria-selected:bg-accent aria-selected:text-accent-foreground",
                            "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            {getIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {result.type === "task" && result.boardName && (
                                <span>{result.boardName} • </span>
                              )}
                              {result.workspaceName}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 capitalize">
                            {result.type}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </>
            )}
          </Command.List>

          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
              <span>to select</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd>
              <span>to navigate</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
