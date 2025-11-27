import type { SummarySnapshot } from "@/components/assistant-ui/prompt-card";

export interface PromptItem {
  id: string;
  title: string;
  content: string[];
  isEditing?: boolean;
  isIncluded: boolean;
  summarySnapshot?: SummarySnapshot;
  // 来源消息信息（当从对话拖入时记录）
  sourceMessageId?: string;        // 来源消息的 ID
  sourceThreadId?: string;         // 来源线程的 ID（支持跨线程）
  sourceMessageRole?: "user" | "assistant";  // 来源消息的角色
  sourceMessageTimestamp?: number;  // 来源消息的时间戳（用于显示）
}

export interface PromptCollection {
  id: string;
  name: string;
  prompts: PromptItem[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "structify-prompt-collections";
const CURRENT_COLLECTION_KEY = "structify-current-collection-id";

export const getCollections = (): PromptCollection[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as PromptCollection[];
  } catch (error) {
    console.error("Failed to load collections:", error);
    return [];
  }
};

export const saveCollections = (collections: PromptCollection[]): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch (error) {
    console.error("Failed to save collections:", error);
  }
};

export const getCurrentCollectionId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(CURRENT_COLLECTION_KEY);
};

export const setCurrentCollectionId = (id: string | null): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (id === null) {
    localStorage.removeItem(CURRENT_COLLECTION_KEY);
  } else {
    localStorage.setItem(CURRENT_COLLECTION_KEY, id);
  }
};

export const createCollection = (name: string, prompts: PromptItem[] = []): PromptCollection => {
  const now = Date.now();
  return {
    id: `collection-${now}`,
    name,
    prompts,
    createdAt: now,
    updatedAt: now,
  };
};

export const getCollection = (id: string): PromptCollection | null => {
  const collections = getCollections();
  return collections.find((c) => c.id === id) ?? null;
};

export const addCollection = (collection: PromptCollection): void => {
  const collections = getCollections();
  collections.push(collection);
  saveCollections(collections);
};

export const updateCollection = (id: string, updates: Partial<PromptCollection>): void => {
  const collections = getCollections();
  const index = collections.findIndex((c) => c.id === id);
  if (index === -1) {
    return;
  }

  collections[index] = {
    ...collections[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveCollections(collections);
};

export const deleteCollection = (id: string): void => {
  const collections = getCollections();
  const filtered = collections.filter((c) => c.id !== id);
  saveCollections(filtered);

  if (getCurrentCollectionId() === id) {
    const nextId = filtered.length > 0 ? filtered[0].id : null;
    setCurrentCollectionId(nextId);
  }
};

export const exportCollection = (collection: PromptCollection): string => {
  return JSON.stringify(collection, null, 2);
};

export const importCollection = (json: string): PromptCollection | null => {
  try {
    const parsed = JSON.parse(json) as PromptCollection;
    if (!parsed.id || !parsed.name || !Array.isArray(parsed.prompts)) {
      return null;
    }
    parsed.id = `collection-${Date.now()}`;
    parsed.createdAt = Date.now();
    parsed.updatedAt = Date.now();
    return parsed;
  } catch (error) {
    console.error("Failed to import collection:", error);
    return null;
  }
};

export const exportAllCollections = (): string => {
  const collections = getCollections();
  return JSON.stringify(collections, null, 2);
};

export const importAllCollections = (json: string): boolean => {
  try {
    const parsed = JSON.parse(json) as PromptCollection[];
    if (!Array.isArray(parsed)) {
      return false;
    }

    const now = Date.now();
    const imported = parsed.map((c, index) => ({
      ...c,
      id: `collection-${now}-${index}`,
      createdAt: c.createdAt || now,
      updatedAt: now,
    }));

    const existing = getCollections();
    saveCollections([...existing, ...imported]);
    return true;
  } catch (error) {
    console.error("Failed to import collections:", error);
    return false;
  }
};

