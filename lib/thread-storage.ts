/**
 * 线程存储管理
 * 使用 localStorage 保存线程历史
 */

export interface ThreadData {
  id: string;
  title: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
  modelId?: string; // 当前使用的模型
  folderId?: string; // 所属文件夹 ID
}

const STORAGE_KEY = "structify-threads";
const CURRENT_THREAD_KEY = "structify-current-thread-id";

export function getThreads(): ThreadData[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as ThreadData[];
  } catch (error) {
    console.error("Failed to load threads:", error);
    return [];
  }
}

export function saveThreads(threads: ThreadData[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch (error) {
    console.error("Failed to save threads:", error);
    // 如果存储空间不足，删除最旧的线程
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      const sorted = threads.sort((a, b) => a.updatedAt - b.updatedAt);
      const reduced = sorted.slice(-50); // 只保留最近50个
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
      } catch (e) {
        console.error("Failed to save reduced threads:", e);
      }
    }
  }
}

export function getThread(id: string): ThreadData | null {
  const threads = getThreads();
  return threads.find((t) => t.id === id) || null;
}

export function saveThread(thread: ThreadData): void {
  const threads = getThreads();
  const index = threads.findIndex((t) => t.id === thread.id);
  
  if (index === -1) {
    threads.push(thread);
  } else {
    threads[index] = thread;
  }
  
  saveThreads(threads);
}

export function deleteThread(id: string): void {
  const threads = getThreads();
  const filtered = threads.filter((t) => t.id !== id);
  saveThreads(filtered);
  
  if (getCurrentThreadId() === id) {
    const nextId = filtered.length > 0 ? filtered[0].id : null;
    setCurrentThreadId(nextId);
  }
}

export function getCurrentThreadId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(CURRENT_THREAD_KEY);
}

export function setCurrentThreadId(id: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (id === null) {
    localStorage.removeItem(CURRENT_THREAD_KEY);
  } else {
    localStorage.setItem(CURRENT_THREAD_KEY, id);
  }
}

export function createThread(title: string = "New Chat"): ThreadData {
  const now = Date.now();
  return {
    id: `thread-${now}`,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function extractThreadTitle(messages: any[]): string {
  if (messages.length === 0) {
    return "New Chat";
  }
  
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) {
    return "New Chat";
  }
  
  const text = Array.isArray(firstUserMessage.content)
    ? firstUserMessage.content.find((c: any) => c.type === "text")?.text || ""
    : firstUserMessage.content || "";
  
  // 移除 @mention 部分
  const cleaned = text.replace(/^@[a-z0-9-]+(?:\.[a-z0-9-]+)*\s*/, "").trim();
  
  return cleaned.substring(0, 50) || "New Chat";
}

