"use client";

import { useState, useEffect, useCallback } from "react";
import { useAssistantApi, useAssistantState } from "@assistant-ui/react";
import { Plus, ChevronDown, Check, Download, Upload, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODEL_REGISTRY, getDefaultModel, type ModelConfig } from "@/lib/models/registry";
import { parseModelFromMessage } from "@/lib/models/message-parser";
import { createThread, setCurrentThreadId, getCurrentThreadId, getThread, saveThread } from "@/lib/thread-storage";
import { Pencil } from "lucide-react";
import {
  exportCollection,
  exportAllCollections,
  importCollection,
  importAllCollections,
  getCollections,
  getCurrentCollectionId,
  addCollection,
} from "@/lib/prompt-storage";

export function ThreadHeader() {
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  const [currentModel, setCurrentModel] = useState<ModelConfig>(getDefaultModel());
  const composerValue = useAssistantState((state) => state.composer.value);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [threadTitle, setThreadTitle] = useState("New Chat");

  // 从 composer 值中解析当前模型
  useEffect(() => {
    const parsed = parseModelFromMessage(composerValue || "");
    setCurrentModel(parsed.model);
  }, [composerValue]);

  // 获取当前线程标题（从 thread-storage）
  useEffect(() => {
    const currentThreadId = getCurrentThreadId();
    if (currentThreadId) {
      const thread = getThread(currentThreadId);
      if (thread) {
        setThreadTitle(thread.title || "New Chat");
      } else {
        setThreadTitle("New Chat");
      }
    } else {
      setThreadTitle("New Chat");
    }
  }, []);

  // 监听线程切换和更新事件
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleThreadSwitch = () => {
      const currentThreadId = getCurrentThreadId();
      if (currentThreadId) {
        const thread = getThread(currentThreadId);
        if (thread) {
          setThreadTitle(thread.title || "New Chat");
        }
      }
    };
    
    const handleThreadUpdate = () => {
      const currentThreadId = getCurrentThreadId();
      if (currentThreadId) {
        const thread = getThread(currentThreadId);
        if (thread) {
          setThreadTitle(thread.title || "New Chat");
        }
      }
    };
    
    window.addEventListener("thread-switch", handleThreadSwitch);
    window.addEventListener("thread-updated", handleThreadUpdate);
    
    return () => {
      window.removeEventListener("thread-switch", handleThreadSwitch);
      window.removeEventListener("thread-updated", handleThreadUpdate);
    };
  }, []);

  const handleStartEdit = () => {
    setEditTitle(threadTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    const currentThreadId = getCurrentThreadId();
    if (currentThreadId && editTitle.trim()) {
      const thread = getThread(currentThreadId);
      if (thread) {
        const updated = {
          ...thread,
          title: editTitle.trim(),
          updatedAt: Date.now(),
        };
        saveThread(updated);
        setThreadTitle(editTitle.trim());
        
        // 触发更新事件
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("thread-updated"));
        }
      }
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditTitle("");
  };

  const handleModelSelect = (model: ModelConfig) => {
    const currentValue = composerValue || "";
    const parsed = parseModelFromMessage(currentValue);
    
    // 如果当前消息已经有 @mention，替换它
    if (parsed.hasModelMention) {
      const newValue = `@${model.id} ${parsed.cleanedContent}`;
      threadRuntime.composer.setText(newValue);
    } else {
      // 否则在消息开头添加 @mention
      const newValue = currentValue.trim() 
        ? `@${model.id} ${currentValue}`
        : `@${model.id} `;
      threadRuntime.composer.setText(newValue);
    }
    setCurrentModel(model);
  };

  const handleNewChat = useCallback(() => {
    try {
      const runtime = api.runtime as any;
      const adapter = runtime?.threadListAdapter;
      
      if (adapter && typeof adapter.createThread === "function") {
        // 使用 adapter 创建新线程
        adapter.createThread().then((newThread: any) => {
          if (newThread && adapter.switchThread) {
            adapter.switchThread(newThread.id);
          }
        }).catch((error: Error) => {
          console.error("Failed to create thread via adapter:", error);
          // 降级方案：直接创建并切换
          fallbackNewChat();
        });
      } else {
        // 降级方案：直接创建新线程
        fallbackNewChat();
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
      // 降级方案
      fallbackNewChat();
    }
  }, [api]);

  const fallbackNewChat = () => {
    try {
      const newThread = createThread("New Chat");
      setCurrentThreadId(newThread.id);
      
      // 清空当前消息
      threadRuntime.composer.setText("");
      
      // 尝试通过 runtime 切换线程
      const runtime = api.runtime as any;
      if (runtime?.threadListAdapter?.switchThread) {
        runtime.threadListAdapter.switchThread(newThread.id);
      }
      
      // 刷新页面以加载新线程（简单但有效）
      window.location.reload();
    } catch (error) {
      console.error("Fallback new chat failed:", error);
    }
  };

  const handleExportCollection = () => {
    const currentCollectionId = getCurrentCollectionId();
    if (!currentCollectionId) {
      alert("No collection selected.");
      return;
    }
    const collections = getCollections();
    const currentCollection = collections.find(c => c.id === currentCollectionId);
    if (!currentCollection) {
      alert("Collection not found.");
      return;
    }
    const json = exportCollection(currentCollection);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentCollection.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const json = exportAllCollections();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `structify_collections_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCollection = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const imported = importCollection(text);
        if (imported) {
          addCollection(imported);
          alert("Collection imported successfully!");
          window.location.reload();
        } else {
          alert("Failed to import collection. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleImportAll = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const imported = importAllCollections(text);
        if (imported && imported.length > 0) {
          alert(`Successfully imported ${imported.length} collection(s)!`);
          window.location.reload();
        } else {
          alert("Failed to import collections. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-background p-2">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleExportCollection}>
              <Download className="size-4 mr-2" />
              Export Current
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportAll}>
              <Download className="size-4 mr-2" />
              Export All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportCollection}>
              <Upload className="size-4 mr-2" />
              Import Collection
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportAll}>
              <Upload className="size-4 mr-2" />
              Import All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0">
            <span className="text-lg">{currentModel.icon || "🤖"}</span>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveTitle();
                    } else if (e.key === "Escape") {
                      handleCancelEdit();
                    }
                  }}
                  className="flex-1 px-1 text-sm font-semibold border rounded bg-background"
                  autoFocus
                />
              </div>
            ) : (
              <div 
                className="font-semibold text-sm truncate cursor-pointer hover:bg-muted rounded px-1 py-0.5 -mx-1 flex items-center gap-1 group"
                onClick={handleStartEdit}
                title="Click to edit"
              >
                <span className="truncate">{threadTitle}</span>
                <Pencil className="size-3 opacity-0 group-hover:opacity-50 text-muted-foreground shrink-0" />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-left">
                  <span>{currentModel.displayName}</span>
                  <ChevronDown className="size-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Switch Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {MODEL_REGISTRY.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    className={currentModel.id === model.id ? "bg-accent" : ""}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-base">{model.icon || "🤖"}</span>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium">{model.displayName}</span>
                        {model.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {model.description}
                          </span>
                        )}
                      </div>
                      {currentModel.id === model.id && (
                        <Check className="size-4 shrink-0 text-primary" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* 模型选择器已移动到左侧边栏 */}
      </div>
    </div>
  );
}

