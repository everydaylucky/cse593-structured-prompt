"use client";

import { useState, useEffect, useCallback } from "react";
import { useAssistantApi, useAssistantState } from "@assistant-ui/react";
import { Plus, ChevronDown, Check } from "lucide-react";
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
import { createThread, setCurrentThreadId, getCurrentThreadId } from "@/lib/thread-storage";

export function ThreadHeader() {
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  const [currentModel, setCurrentModel] = useState<ModelConfig>(getDefaultModel());
  const composerValue = useAssistantState((state) => state.composer.value);

  // 从 composer 值中解析当前模型
  useEffect(() => {
    const parsed = parseModelFromMessage(composerValue || "");
    setCurrentModel(parsed.model);
  }, [composerValue]);

  // 获取当前线程标题
  const threadTitle = useAssistantState(({ thread }) => {
    const messages = thread.messages;
    if (messages.length === 0) return "New Chat";
    const firstUserMessage = messages.find((m) => m.role === "user");
    if (firstUserMessage) {
      const text = Array.isArray(firstUserMessage.content)
        ? firstUserMessage.content.find((c: any) => c.type === "text")?.text || ""
        : firstUserMessage.content || "";
      return text.substring(0, 50) || "New Chat";
    }
    return "New Chat";
  });

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

  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0">
            <span className="text-lg">{currentModel.icon || "🤖"}</span>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{threadTitle}</div>
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

