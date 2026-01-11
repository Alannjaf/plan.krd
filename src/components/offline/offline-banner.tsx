"use client";

import { useState, useEffect } from "react";
import { useOnlineStatus } from "@/lib/offline/detector";
import { useSyncQueue } from "@/lib/offline/sync-queue";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const isOnline = useOnlineStatus();
  const { queueLength, isSyncing } = useSyncQueue();

  // Ensure client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return null on server and initial client render to match server HTML
  if (!mounted || (isOnline && queueLength === 0)) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-14 left-0 right-0 z-50 border-b px-6 py-2 text-sm",
        isOnline
          ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
          : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
      )}
    >
      <div className="max-w-full mx-auto flex items-center gap-2">
        {isOnline ? (
          <>
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing {queueLength} pending change{queueLength !== 1 ? "s" : ""}...</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" />
                <span>Connection restored. All changes have been synced.</span>
              </>
            )}
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>
              You're offline. {queueLength > 0 && `${queueLength} change${queueLength !== 1 ? "s" : ""} queued for sync.`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
