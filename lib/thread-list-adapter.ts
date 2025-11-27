/**
 * ThreadListAdapter 实现
 * 支持线程列表管理功能
 */

import {
  getThreads,
  saveThread,
  getThread,
  deleteThread,
  createThread,
  extractThreadTitle,
  setCurrentThreadId,
  getCurrentThreadId,
  type ThreadData,
} from "./thread-storage";

// ThreadListAdapter 接口定义
interface ThreadListAdapter {
  initialize(): Promise<{ threads: ThreadData[]; currentThreadId: string | null }>;
  createThread(): Promise<ThreadData>;
  switchThread(threadId: string): Promise<ThreadData>;
  updateThread(threadId: string, updates: Partial<ThreadData>): Promise<ThreadData | void>;
  deleteThread(threadId: string): Promise<void>;
  archiveThread?(threadId: string): Promise<void>;
}

export function createThreadListAdapter(): ThreadListAdapter {
  return {
    // 初始化：加载线程列表
    async initialize() {
      try {
        const threads = getThreads();
        const currentId = getCurrentThreadId();
        
        // 如果没有线程，创建一个默认的
        if (threads.length === 0) {
          const defaultThread = createThread("New Chat");
          saveThread(defaultThread);
          setCurrentThreadId(defaultThread.id);
          return {
            threads: [defaultThread],
            currentThreadId: defaultThread.id,
          };
        }
        
        // 如果当前线程不存在，使用第一个
        const currentThread = currentId ? getThread(currentId) : null;
        const finalCurrentId = currentThread ? currentId : threads[0].id;
        
        if (!currentId || !currentThread) {
          setCurrentThreadId(finalCurrentId);
        }
        
        return {
          threads,
          currentThreadId: finalCurrentId,
        };
      } catch (error) {
        console.error("Failed to initialize thread list:", error);
        // 返回空列表，避免崩溃
        return {
          threads: [],
          currentThreadId: null,
        };
      }
    },

    // 创建新线程
    async createThread() {
      try {
        const newThread = createThread("New Chat");
        saveThread(newThread);
        setCurrentThreadId(newThread.id);
        return newThread;
      } catch (error) {
        console.error("Failed to create thread:", error);
        throw error;
      }
    },

    // 切换线程
    async switchThread(threadId: string) {
      try {
        const thread = getThread(threadId);
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`);
        }
        setCurrentThreadId(threadId);
        return thread;
      } catch (error) {
        console.error("Failed to switch thread:", error);
        throw error;
      }
    },

    // 更新线程（当消息变化时）
    async updateThread(threadId: string, updates: Partial<ThreadData>) {
      try {
        const thread = getThread(threadId);
        if (!thread) {
          return;
        }
        
        const updated: ThreadData = {
          ...thread,
          ...updates,
          updatedAt: Date.now(),
        };
        
        // 如果消息更新了，且标题还是默认值，自动更新标题
        // 如果用户已经手动编辑过标题，则保持用户编辑的标题不变
        if (updates.messages && updates.messages.length > 0) {
          const currentTitle = thread.title || "New Chat";
          // 只有当标题是默认值 "New Chat" 时，才自动提取标题
          if (currentTitle === "New Chat") {
            const extractedTitle = extractThreadTitle(updates.messages);
            // 只有当提取的标题不是 "New Chat" 时，才更新
            if (extractedTitle && extractedTitle !== "New Chat") {
              updated.title = extractedTitle;
            }
          }
        }
        
        saveThread(updated);
        return updated;
      } catch (error) {
        console.error("Failed to update thread:", error);
        // 不抛出错误，避免影响用户体验
      }
    },

    // 删除线程
    async deleteThread(threadId: string) {
      try {
        deleteThread(threadId);
      } catch (error) {
        console.error("Failed to delete thread:", error);
        throw error;
      }
    },

    // 归档线程（可选功能）
    async archiveThread(threadId: string) {
      try {
        const thread = getThread(threadId);
        if (!thread) {
          return;
        }
        // 这里可以实现归档逻辑，暂时直接删除
        deleteThread(threadId);
      } catch (error) {
        console.error("Failed to archive thread:", error);
        throw error;
      }
    },
  };
}

