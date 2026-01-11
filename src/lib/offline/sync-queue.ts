"use client";

import { useState, useEffect, useCallback } from "react";
import { useOnlineStatus } from "./detector";
import {
  addToQueue,
  getQueue,
  removeFromQueue,
  updateMutationRetries,
  type QueuedMutation,
} from "./queue-storage";

const MAX_RETRIES = 3;

/**
 * Hook to manage the sync queue
 */
export function useSyncQueue() {
  const isOnline = useOnlineStatus();
  const [queueLength, setQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update queue length when online status changes
  useEffect(() => {
    const updateQueueLength = async () => {
      const queue = await getQueue();
      setQueueLength(queue.length);
    };

    updateQueueLength();
    const interval = setInterval(updateQueueLength, 1000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueLength > 0 && !isSyncing) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  /**
   * Process all queued mutations
   */
  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      const queue = await getQueue();

      for (const mutation of queue) {
        try {
          // Execute the mutation
          await mutation.mutationFn();

          // Remove from queue on success
          await removeFromQueue(mutation.id);
        } catch (error) {
          console.error("Failed to sync mutation:", error);

          // Increment retry count
          const newRetries = mutation.retries + 1;

          if (newRetries >= MAX_RETRIES) {
            // Remove from queue after max retries
            console.error("Mutation exceeded max retries, removing from queue:", mutation);
            await removeFromQueue(mutation.id);
          } else {
            // Update retry count
            await updateMutationRetries(mutation.id, newRetries);
          }
        }
      }

      // Update queue length
      const updatedQueue = await getQueue();
      setQueueLength(updatedQueue.length);
    } catch (error) {
      console.error("Error syncing queue:", error);
    } finally {
      setIsSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isSyncing]);

  /**
   * Queue a mutation for later execution
   */
  const queueMutation = useCallback(
    async (
      mutationKey: string[],
      mutationFn: () => Promise<unknown>,
      variables: unknown
    ) => {
      if (isOnline) {
        // Try to execute immediately
        try {
          await mutationFn();
          return;
        } catch (error) {
          // If it fails and we're online, it might be a server error
          // Queue it anyway for retry
          console.warn("Mutation failed, queuing for retry:", error);
        }
      }

      // Queue the mutation
      await addToQueue({
        mutationKey,
        mutationFn,
        variables,
        retries: 0,
      });

      const queue = await getQueue();
      setQueueLength(queue.length);
    },
    [isOnline]
  );

  return {
    queueLength,
    isSyncing,
    syncQueue,
    queueMutation,
  };
}
