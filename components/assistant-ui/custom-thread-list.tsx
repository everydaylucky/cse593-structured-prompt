"use client";

import { useState, useEffect, useCallback } from "react";
import { useAssistantApi } from "@assistant-ui/react";
import { Plus, Archive, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getThreads,
  getCurrentThreadId,
  setCurrentThreadId,
  createThread,
  deleteThread,
  saveThread,
  type ThreadData,
} from "@/lib/thread-storage";
import { extractThreadTitle } from "@/lib/thread-storage";

export function CustomThreadList() {
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [currentThreadId, setCurrentThreadIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  // 确保只在客户端渲染时间
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 加载线程列表
  const loadThreads = useCallback(() => {
    try {
      const loadedThreads = getThreads();
      const currentId = getCurrentThreadId();
      
      // 如果没有线程，创建一个默认的
      if (loadedThreads.length === 0) {
        const defaultThread = createThread("New Chat");
        saveThread(defaultThread); // 保存到 localStorage
        setThreads([defaultThread]);
        setCurrentThreadIdState(defaultThread.id);
        setCurrentThreadId(defaultThread.id);
        return;
      }
      
      setThreads(loadedThreads);
      setCurrentThreadIdState(currentId || loadedThreads[0].id);
      if (!currentId) {
        setCurrentThreadId(loadedThreads[0].id);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // 监听线程变化（通过 storage 事件和自定义事件）
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "structify-threads" || e.key === "structify-current-thread-id") {
        loadThreads();
      }
    };
    
    const handleThreadUpdate = () => {
      loadThreads();
    };
    
    // 监听 thread-switch 事件，更新当前线程高亮
    const handleThreadSwitch = (e: CustomEvent<{ threadId: string }>) => {
      const threadId = e.detail.threadId;
      console.log("[CustomThreadList] Thread switch event received:", threadId);
      setCurrentThreadIdState(threadId);
      // 同时更新 localStorage（如果还没有更新）
      const currentId = getCurrentThreadId();
      if (currentId !== threadId) {
        setCurrentThreadId(threadId);
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("thread-updated", handleThreadUpdate);
    window.addEventListener("thread-switch", handleThreadSwitch as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("thread-updated", handleThreadUpdate);
      window.removeEventListener("thread-switch", handleThreadSwitch as EventListener);
    };
  }, [loadThreads]);

  // 创建新线程
  const handleNewThread = useCallback(() => {
    try {
      const newThread = createThread("New Chat");
      saveThread(newThread); // 保存到 localStorage
      setThreads(prev => [newThread, ...prev]);
      setCurrentThreadIdState(newThread.id);
      setCurrentThreadId(newThread.id);
      
      // 清空 composer
      threadRuntime.composer.setText("");
      
      // 发送自定义事件通知线程切换和更新
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("thread-switch", {
            detail: { threadId: newThread.id },
          })
        );
        window.dispatchEvent(new CustomEvent("thread-updated"));
      }
    } catch (error) {
      console.error("Failed to create new thread:", error);
    }
  }, [threadRuntime]);

  // 切换线程
  const handleSwitchThread = useCallback((threadId: string) => {
    try {
      const thread = threads.find(t => t.id === threadId);
      if (!thread) {
        console.error("Thread not found:", threadId);
        return;
      }
      
      setCurrentThreadIdState(threadId);
      setCurrentThreadId(threadId);
      
      // 清空 composer
      threadRuntime.composer.setText("");
      
      // 发送自定义事件通知线程切换
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("thread-switch", {
            detail: { threadId },
          })
        );
      }
    } catch (error) {
      console.error("Failed to switch thread:", error);
    }
  }, [threads, threadRuntime]);

  // 编辑线程名称
  const handleEditThread = useCallback((threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      setEditingThreadId(threadId);
      setEditTitle(thread.title);
    }
  }, [threads]);

  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    if (!editingThreadId || !editTitle.trim()) {
      return;
    }
    
    try {
      const thread = threads.find(t => t.id === editingThreadId);
      if (thread) {
        const updated = {
          ...thread,
          title: editTitle.trim(),
          updatedAt: Date.now(),
        };
        saveThread(updated);
        setThreads(prev => prev.map(t => t.id === editingThreadId ? updated : t));
        
        // 通知更新
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("thread-updated"));
        }
      }
      setEditingThreadId(null);
      setEditTitle("");
    } catch (error) {
      console.error("Failed to save thread edit:", error);
    }
  }, [editingThreadId, editTitle, threads]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingThreadId(null);
    setEditTitle("");
  }, []);

  // 删除线程
  const handleDeleteThread = useCallback((threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this thread?")) {
      return;
    }
    
    try {
      deleteThread(threadId);
      const updatedThreads = threads.filter(t => t.id !== threadId);
      setThreads(updatedThreads);
      
      // 如果删除的是当前线程，切换到第一个
      if (threadId === currentThreadId) {
        const nextId = updatedThreads.length > 0 ? updatedThreads[0].id : null;
        setCurrentThreadIdState(nextId);
        setCurrentThreadId(nextId);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  }, [threads, currentThreadId]);

  // 格式化时间（仅在客户端执行，避免 hydration 错误）
  const formatTime = useCallback((timestamp: number) => {
    if (typeof window === "undefined") {
      return ""; // 服务器端返回空字符串
    }
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <Button
        onClick={handleNewThread}
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-8 text-xs"
      >
        <Plus className="size-4" />
        <span>New Chat</span>
      </Button>
      
      <div className="flex flex-col gap-1">
        {threads.map((thread) => (
          <div
            key={thread.id}
            onClick={() => handleSwitchThread(thread.id)}
            className={`
              group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer
              transition-colors hover:bg-muted
              ${currentThreadId === thread.id ? "bg-muted" : ""}
            `}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{thread.title}</div>
              <div className="text-xs text-muted-foreground">
                {isMounted ? formatTime(thread.updatedAt) : ""}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handleEditThread(thread.id, e)}
                className="p-1 hover:bg-muted rounded"
                title="Rename thread"
              >
                <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
              <button
                onClick={(e) => handleDeleteThread(thread.id, e)}
                className="p-1 hover:bg-destructive/10 rounded"
                title="Delete thread"
              >
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 编辑对话框 */}
      <Dialog open={editingThreadId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Thread</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation thread.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  handleCancelEdit();
                }
              }}
              placeholder="Thread name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

