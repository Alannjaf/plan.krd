"use client";

import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function SearchButton() {
  const handleClick = () => {
    // Trigger command palette via keyboard event
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-muted-foreground w-64 justify-start"
      onClick={handleClick}
    >
      <Search className="w-4 h-4" />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
}
