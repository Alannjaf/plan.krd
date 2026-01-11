"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";
import type { Board } from "@/lib/actions/boards";

interface BoardCardProps {
  board: Board;
  workspaceId: string;
}

export function BoardCard({ board, workspaceId }: BoardCardProps) {
  return (
    <Link href={`/${workspaceId}/${board.id}`}>
      <Card className="h-full bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer group">
        <CardHeader>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg group-hover:text-primary transition-colors">
            {board.name}
          </CardTitle>
          {board.description && (
            <CardDescription className="line-clamp-2">
              {board.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}
