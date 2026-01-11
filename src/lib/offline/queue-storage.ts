"use client";

const DB_NAME = "plan-krd-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "mutations";

export interface QueuedMutation {
  id: string;
  mutationKey: string[];
  mutationFn: () => Promise<unknown>;
  variables: unknown;
  timestamp: number;
  retries: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Add a mutation to the queue
 */
export async function addToQueue(mutation: Omit<QueuedMutation, "id" | "timestamp">): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(queuedMutation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to add mutation to queue:", error);
    throw error;
  }
}

/**
 * Get all queued mutations
 */
export async function getQueue(): Promise<QueuedMutation[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("timestamp");

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get queue:", error);
    return [];
  }
}

/**
 * Remove a mutation from the queue
 */
export async function removeFromQueue(id: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to remove mutation from queue:", error);
    throw error;
  }
}

/**
 * Clear all mutations from the queue
 */
export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear queue:", error);
    throw error;
  }
}

/**
 * Update mutation retry count
 */
export async function updateMutationRetries(id: string, retries: number): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const getRequest = store.get(id);
    await new Promise<void>((resolve, reject) => {
      getRequest.onsuccess = () => {
        const mutation = getRequest.result;
        if (mutation) {
          mutation.retries = retries;
          const putRequest = store.put(mutation);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.error("Failed to update mutation retries:", error);
    throw error;
  }
}
