"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, ArrowLeft, Loader2, BookOpen, Download, Upload, Trash2, ChevronDown, Pencil } from "lucide-react";
import { PromptCard } from "./prompt-card";
import type { SummarySnapshot } from "./prompt-card";
import { NotionStylePromptArea } from "./notion-style-prompt-area";
import { useAssistantApi, useAssistantState } from "@assistant-ui/react";
import { Button } from "../ui/button";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import {
  Panel,
  PanelTrigger,
  PanelExpandTrigger,
  PanelResizer,
} from "../ui/panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { PROMPT_COLLECT_EVENT, type PromptCollectDetail } from "@/lib/prompt-collector";
import { useIsMobile } from "@/hooks/use-mobile";
import initialPrompts from "@/data/initial.json";
import {
  type PromptItem,
  type PromptCollection,
  getCollections,
  getCurrentCollectionId,
  setCurrentCollectionId,
  createCollection,
  getCollection,
  updateCollection,
  addCollection,
  deleteCollection,
  exportCollection,
  importCollection,
  exportAllCollections,
  importAllCollections,
} from "@/lib/prompt-storage";
import { getThread, getCurrentThreadId, setCurrentThreadId, getThreads } from "@/lib/thread-storage";
import {
  addUndoAction,
  canUndo,
  canRedo,
  popUndoAction,
  popRedoAction,
  pushRedoAction,
  pushUndoAction,
  clearUndoRedoHistory,
  type UndoRedoAction,
} from "@/lib/undo-redo-storage";

interface PromptPanelProps {
  onWidthChange?: (width: number) => void;
}

const PANEL_FLOATING = true;
const PANEL_DEFAULT_WIDTH = 320;
const PANEL_MIN_WIDTH = 260;
const PANEL_MAX_WIDTH_RATIO = 2 / 3;
const PANEL_MAX_WIDTH_FALLBACK = 500;

const getPanelMaxWidth = (isMobile: boolean) => {
  if (typeof window === "undefined") {
    return PANEL_MAX_WIDTH_FALLBACK;
  }

  const viewportWidth = window.innerWidth;
  return isMobile
    ? viewportWidth
    : Math.round(viewportWidth * PANEL_MAX_WIDTH_RATIO);
};

const clampPanelWidth = (value: number, maxWidth: number) =>
  Math.min(Math.max(value, PANEL_MIN_WIDTH), maxWidth);

export function PromptPanel(props: PromptPanelProps = {}) {
  const { onWidthChange } = props;
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [panelMaxWidth, setPanelMaxWidth] = useState(() => getPanelMaxWidth(isMobile));
  const [panelWidth, setPanelWidth] = useState(() => {
    const maxWidth = getPanelMaxWidth(isMobile);
    return isMobile ? maxWidth : clampPanelWidth(PANEL_DEFAULT_WIDTH, maxWidth);
  });
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  
  // 处理跳转到来源消息
  // 等待消息元素出现的辅助函数（使用轮询机制）
  const waitForMessageElement = useCallback((messageId: string, expectedThreadId: string | null, maxWait: number = 5000): Promise<Element | null> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const selector = `[data-message-id="${messageId}"]`;
      let checkCount = 0;
      
      const check = () => {
        checkCount++;
        const element = document.querySelector(selector);
        const elapsed = Date.now() - startTime;
        const currentThreadId = getCurrentThreadId();
        
        // 如果找到了元素，还要验证当前线程是否正确
        if (element) {
          // 如果指定了期望的线程 ID，验证当前线程是否匹配
          if (expectedThreadId && currentThreadId !== expectedThreadId) {
            // 线程还没切换完成，继续等待
            if (elapsed < maxWait) {
              if (checkCount % 10 === 0) {
                console.log("[Link] [PromptPanel] Element found but thread not switched yet:", {
                  messageId,
                  expectedThreadId,
                  currentThreadId,
                  elapsedMs: elapsed,
                  checkCount,
                });
              }
              requestAnimationFrame(check);
              return;
            }
          }
          
          console.log("[Link] [PromptPanel] Message element found after waiting:", {
            messageId,
            elapsedMs: elapsed,
            checkCount,
            expectedThreadId,
            currentThreadId,
            threadMatches: !expectedThreadId || currentThreadId === expectedThreadId,
          });
          resolve(element);
        } else if (elapsed > maxWait) {
          console.warn("[Link] [PromptPanel] Message element not found after timeout:", {
            messageId,
            elapsedMs: elapsed,
            maxWait,
            checkCount,
            expectedThreadId,
            currentThreadId,
            allMessageElements: document.querySelectorAll("[data-message-id]").length,
            availableMessageIds: Array.from(document.querySelectorAll("[data-message-id]"))
              .map(el => el.getAttribute("data-message-id"))
              .slice(0, 10),
          });
          resolve(null);
        } else {
          // 继续等待，使用 requestAnimationFrame 以获得更好的性能
          // 每 10 次检查输出一次日志，避免日志过多
          if (checkCount % 10 === 0) {
            console.log("[Link] [PromptPanel] Still waiting for message element:", {
              messageId,
              elapsedMs: elapsed,
              checkCount,
              expectedThreadId,
              currentThreadId,
              allMessageElements: document.querySelectorAll("[data-message-id]").length,
            });
          }
          requestAnimationFrame(check);
        }
      };
      
      // 开始检查
      check();
    });
  }, []);

  // 滚动到消息元素的辅助函数
  const scrollToMessageElement = useCallback((messageId: string) => {
    console.log("[Link] [PromptPanel] scrollToMessageElement called:", { messageId });
    const selector = `[data-message-id="${messageId}"]`;
    console.log("[Link] [PromptPanel] Searching for element with selector:", selector);
    const messageElement = document.querySelector(selector);
    if (messageElement) {
      console.log("[Link] [PromptPanel] Message element found, scrolling into view:", {
        messageId,
        elementTag: messageElement.tagName,
        elementClasses: messageElement.className,
      });
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // 可选：高亮显示消息
      messageElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
      console.log("[Link] [PromptPanel] Added highlight classes to message element");
      setTimeout(() => {
        messageElement.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
        console.log("[Link] [PromptPanel] Removed highlight classes from message element");
      }, 3000);
    } else {
      console.warn("[Link] [PromptPanel] Message element not found in DOM:", {
        messageId,
        selector,
        allMessageElements: document.querySelectorAll("[data-message-id]").length,
        availableMessageIds: Array.from(document.querySelectorAll("[data-message-id]")).map(el => el.getAttribute("data-message-id")).slice(0, 10),
      });
    }
  }, []);

  const handleScrollToMessage = useCallback((messageId: string, threadId: string) => {
    console.log("[Link] [PromptPanel] handleScrollToMessage called:", { messageId, threadId });
    
    // 检查线程是否存在
    console.log("[Link] [PromptPanel] Checking if thread exists:", threadId);
    const thread = getThread(threadId);
    if (!thread) {
      console.warn("[Link] [PromptPanel] Thread not found:", {
        threadId,
        availableThreads: getThreads().map((t: any) => ({ id: t.id, title: t.title })),
      });
      // 可以显示一个提示，告诉用户线程已删除
      alert("The source thread has been deleted.");
      return;
    }
    console.log("[Link] [PromptPanel] Thread found:", {
      threadId: thread.id,
      title: thread.title,
      messageCount: thread.messages?.length || 0,
    });
    
    // 检查消息是否存在
    const messages = thread.messages || [];
    console.log("[Link] [PromptPanel] Searching for message in thread:", {
      messageId,
      totalMessages: messages.length,
      messageIds: messages.map((m: any) => m.id).slice(0, 5),
    });
    const message = messages.find((m: any) => m.id === messageId);
    
    if (!message) {
      console.warn("[Link] [PromptPanel] Message not found:", {
        messageId,
        threadId,
        availableMessageIds: messages.map((m: any) => m.id),
      });
      // 可以显示一个提示，告诉用户消息已删除
      alert("The source message has been deleted.");
      return;
    }
    console.log("[Link] [PromptPanel] Message found:", {
      messageId: message.id,
      role: message.role,
      hasContent: !!message.content,
    });
    
    // 如果线程不同，需要切换线程
    const currentThreadId = getCurrentThreadId();
    console.log("[Link] [PromptPanel] Current thread vs target thread:", {
      currentThreadId,
      targetThreadId: threadId,
      needsSwitch: currentThreadId !== threadId,
    });
    
    if (currentThreadId !== threadId) {
      console.log("[Link] [PromptPanel] Switching thread:", { from: currentThreadId, to: threadId });
      // 使用 setCurrentThreadId 切换线程，然后触发自定义事件
      setCurrentThreadId(threadId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("thread-switch", {
            detail: { threadId },
          })
        );
        console.log("[Link] [PromptPanel] Thread switch event dispatched");
      }
      
      // 等待线程切换完成后再滚动
      // 先等待一小段时间，让 thread-switch 事件处理开始
      console.log("[Link] [PromptPanel] Waiting for thread switch to start (300ms delay)");
      setTimeout(() => {
        console.log("[Link] [PromptPanel] Starting to wait for message element after thread switch");
        // 使用轮询机制等待消息元素出现，增加等待时间到 10 秒
        // 传入期望的线程 ID，确保在正确的线程中查找
        waitForMessageElement(messageId, threadId, 10000).then((element) => {
          if (element) {
            console.log("[Link] [PromptPanel] Message element found, scrolling into view");
            // 再等待一小段时间，确保元素完全渲染和布局完成
            // 使用 requestAnimationFrame 确保在下一帧渲染时滚动
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // 双重 requestAnimationFrame 确保 DOM 完全更新
                const htmlElement = element as HTMLElement;
                const rect = htmlElement.getBoundingClientRect();
                const scrollContainer = document.documentElement || document.body;
                
                console.log("[Link] [PromptPanel] Scrolling to message element:", {
                  messageId,
                  elementOffsetTop: htmlElement.offsetTop,
                  elementRect: rect,
                  scrollContainer: scrollContainer,
                  windowScrollY: window.scrollY,
                });
                
                // 方法1: 使用 scrollIntoView（主要方法）
                element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                
                // 方法2: 备用方案 - 强制滚动，确保元素在视口中
                // 立即检查并滚动，不等待
                const initialRect = htmlElement.getBoundingClientRect();
                const isInitiallyVisible = initialRect.top >= 0 && initialRect.top < window.innerHeight && 
                                          initialRect.bottom > 0 && initialRect.bottom <= window.innerHeight;
                
                if (!isInitiallyVisible) {
                  console.log("[Link] [PromptPanel] Element not in viewport (cross thread), using immediate manual scroll:", {
                    messageId,
                    initialRect,
                    windowInnerHeight: window.innerHeight,
                    currentScrollY: window.scrollY,
                  });
                  
                  // 计算需要滚动的距离，使元素居中
                  const elementTop = htmlElement.offsetTop;
                  const elementHeight = htmlElement.offsetHeight;
                  const viewportHeight = window.innerHeight;
                  const targetY = elementTop + elementHeight / 2 - viewportHeight / 2;
                  
                  console.log("[Link] [PromptPanel] Manual scroll calculation (cross thread):", {
                    elementTop,
                    elementHeight,
                    viewportHeight,
                    targetY,
                    finalScrollY: Math.max(0, targetY),
                  });
                  
                  // 使用 window.scrollTo 强制滚动
                  window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
                }
                
                // 方法3: 延迟多次检查和重试，对抗可能的自动滚动
                [100, 300, 600].forEach(delay => {
                  setTimeout(() => {
                    const newRect = htmlElement.getBoundingClientRect();
                    // 检查是否在视口中且大概居中（允许 200px 误差）
                    const viewportCenter = window.innerHeight / 2;
                    const elementCenter = newRect.top + newRect.height / 2;
                    const distance = Math.abs(viewportCenter - elementCenter);
                    const isCentered = distance < 200;
                    
                    const isVisible = newRect.top >= 0 && newRect.top < window.innerHeight && 
                                    newRect.bottom > 0 && newRect.bottom <= window.innerHeight;
                    
                    // 如果不可见，或者虽然可见但严重偏离中心（且不是因为页面到了边缘无法滚动），则重试
                    // 判断页面是否到了边缘：
                    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
                    const isAtTop = window.scrollY <= 0;
                    const isAtBottom = Math.abs(window.scrollY - maxScrollY) < 10;
                    
                    // 如果无法居中是因为到了边缘，则忽略
                    const canScrollToCenter = !((isAtTop && elementCenter < viewportCenter) || (isAtBottom && elementCenter > viewportCenter));
                    
                    if (!isVisible || (canScrollToCenter && !isCentered)) {
                      console.log(`[Link] [PromptPanel] Retrying scroll at ${delay}ms (cross thread):`, {
                        messageId,
                        newRect,
                        currentScrollY: window.scrollY,
                        distance,
                        isCentered,
                        isVisible
                      });
                      // 再次尝试滚动
                      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                    }
                  }, delay);
                });
                
                // 高亮显示消息
                htmlElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
                setTimeout(() => {
                  htmlElement.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
                }, 3000);
              });
            });
          } else {
            console.warn("[Link] [PromptPanel] Message element not found after thread switch, message may not be loaded yet");
            // 可以显示一个提示给用户
            alert("The message is not available yet. Please try again in a moment.");
          }
        });
      }, 300);
    } else {
      // 同一线程，直接滚动（但也使用轮询机制，以防消息还未渲染）
      console.log("[Link] [PromptPanel] Same thread, waiting for message element");
      waitForMessageElement(messageId, null, 2000).then((element) => {
        if (element) {
          console.log("[Link] [PromptPanel] Message element found, scrolling into view");
          
          // 使用 requestAnimationFrame 确保 DOM 完全更新
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const htmlElement = element as HTMLElement;
              const rect = htmlElement.getBoundingClientRect();
              
              console.log("[Link] [PromptPanel] Scrolling to message element (same thread):", {
                messageId,
                elementOffsetTop: htmlElement.offsetTop,
                elementRect: rect,
                windowScrollY: window.scrollY,
                isInViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
              });
              
              // 方法1: 使用 scrollIntoView（主要方法）
              element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
              
              // 方法2: 备用方案 - 强制滚动，确保元素在视口中
              // 立即检查并滚动，不等待
              const initialRect = htmlElement.getBoundingClientRect();
              const isInitiallyVisible = initialRect.top >= 0 && initialRect.top < window.innerHeight && 
                                        initialRect.bottom > 0 && initialRect.bottom <= window.innerHeight;
              
              if (!isInitiallyVisible) {
                console.log("[Link] [PromptPanel] Element not in viewport (same thread), using immediate manual scroll:", {
                  messageId,
                  initialRect,
                  windowInnerHeight: window.innerHeight,
                  currentScrollY: window.scrollY,
                });
                
                // 计算需要滚动的距离，使元素居中
                const elementTop = htmlElement.offsetTop;
                const elementHeight = htmlElement.offsetHeight;
                const viewportHeight = window.innerHeight;
                const targetY = elementTop + elementHeight / 2 - viewportHeight / 2;
                
                console.log("[Link] [PromptPanel] Manual scroll calculation (same thread):", {
                  elementTop,
                  elementHeight,
                  viewportHeight,
                  targetY,
                  finalScrollY: Math.max(0, targetY),
                });
                
                // 使用 window.scrollTo 强制滚动
                window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
              }
              
              // 方法3: 延迟多次检查和重试
              [100, 300, 600].forEach(delay => {
                setTimeout(() => {
                  const newRect = htmlElement.getBoundingClientRect();
                  // 检查是否在视口中且大概居中
                  const viewportCenter = window.innerHeight / 2;
                  const elementCenter = newRect.top + newRect.height / 2;
                  const distance = Math.abs(viewportCenter - elementCenter);
                  const isCentered = distance < 200;
                  
                  const isVisible = newRect.top >= 0 && newRect.top < window.innerHeight && 
                                  newRect.bottom > 0 && newRect.bottom <= window.innerHeight;
                  
                  const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
                  const isAtTop = window.scrollY <= 0;
                  const isAtBottom = Math.abs(window.scrollY - maxScrollY) < 10;
                  const canScrollToCenter = !((isAtTop && elementCenter < viewportCenter) || (isAtBottom && elementCenter > viewportCenter));
                  
                  if (!isVisible || (canScrollToCenter && !isCentered)) {
                    console.log(`[Link] [PromptPanel] Retrying scroll at ${delay}ms (same thread):`, {
                      messageId,
                      newRect,
                      currentScrollY: window.scrollY,
                      distance,
                      isCentered,
                      isVisible
                    });
                    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                  }
                }, delay);
              });
              
              // 高亮显示消息
              htmlElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
              setTimeout(() => {
                htmlElement.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
              }, 3000);
            });
          });
        } else {
          // 如果同一线程也找不到，可能是消息还未渲染，尝试直接滚动
          console.warn("[Link] [PromptPanel] Message element not found in same thread, trying direct scroll");
          scrollToMessageElement(messageId);
        }
      });
    }
  }, [waitForMessageElement, scrollToMessageElement]);
  
  const [collections, setCollections] = useState<PromptCollection[]>(() => {
    const stored = getCollections();
    if (stored.length === 0) {
      const defaultCollection = createCollection("Default", initialPrompts as PromptItem[]);
      addCollection(defaultCollection);
      setCurrentCollectionId(defaultCollection.id);
      return [defaultCollection];
    }
    return stored;
  });
  
  const [currentCollectionId, setCurrentCollectionIdState] = useState<string | null>(() => {
    const storedId = getCurrentCollectionId();
    if (storedId && getCollection(storedId)) {
      return storedId;
    }
    const firstId = collections.length > 0 ? collections[0].id : null;
    if (firstId) {
      setCurrentCollectionId(firstId);
    }
    return firstId;
  });
  
  const currentCollection = currentCollectionId ? getCollection(currentCollectionId) : null;
  const [prompts, setPrompts] = useState<PromptItem[]>(() => {
    const initialPromptsList = currentCollection?.prompts ?? (initialPrompts as PromptItem[]);
    // 去重：确保初始 prompts 中没有重复的 id，并过滤掉无效的 prompt
    const seenIds = new Set<string>();
    return initialPromptsList.filter((prompt) => {
      // 过滤掉 undefined 或 null
      if (!prompt) {
        console.warn("[PromptPanel] Invalid prompt detected in initial state (null/undefined)");
        return false;
      }
      // 确保有 isIncluded 属性
      if (prompt.isIncluded === undefined) {
        prompt.isIncluded = true;
      }
      if (seenIds.has(prompt.id)) {
        console.warn("[PromptPanel] Duplicate prompt id detected in initial state:", prompt.id);
        return false;
      }
      seenIds.add(prompt.id);
      return true;
    });
  });
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveCurrentCollection = useCallback(() => {
    if (!currentCollectionId) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      updateCollection(currentCollectionId, { prompts });
      setCollections(getCollections());
    }, 300);
  }, [currentCollectionId, prompts]);

  useEffect(() => {
    saveCurrentCollection();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [prompts, saveCurrentCollection]);

  useEffect(() => {
    if (currentCollectionId && currentCollection) {
      // 去重：确保 prompts 中没有重复的 id，并过滤掉无效的 prompt
      const seenIds = new Set<string>();
      const uniquePrompts = currentCollection.prompts.filter((prompt, index) => {
        // 过滤掉 undefined 或 null
        if (!prompt) {
          console.warn("[PromptPanel] Invalid prompt detected when loading collection at index", index);
          return false;
        }
        // 确保有 isIncluded 属性
        if (prompt.isIncluded === undefined) {
          prompt.isIncluded = true;
        }
        if (seenIds.has(prompt.id)) {
          console.warn("[PromptPanel] Duplicate prompt id detected when loading collection:", prompt.id, "at index", index);
          return false;
        }
        seenIds.add(prompt.id);
        return true;
      });
      setPrompts(uniquePrompts);
      // 切换 collection 时清空历史记录
      clearUndoRedoHistory();
    }
  }, [currentCollectionId]);

  // Undo/Redo 功能
  const handleUndo = useCallback(() => {
    const action = popUndoAction();
    if (!action) return;

    console.log("[PromptPanel] Undo action:", action);

    setPrompts(prevPrompts => {
      let newPrompts = [...prevPrompts];
      let redoAction: UndoRedoAction | null = null;

      switch (action.type) {
        case "add":
          // 撤销添加：删除该 prompt
          newPrompts = newPrompts.filter((_, index) => index !== action.index);
          redoAction = { type: "add", prompt: action.prompt, index: action.index };
          break;
        case "delete":
          // 撤销删除：恢复该 prompt
          newPrompts.splice(action.index, 0, action.prompt);
          redoAction = { type: "delete", prompt: action.prompt, index: action.index };
          break;
        case "update":
          // 撤销更新：恢复旧值
          newPrompts[action.index] = action.oldPrompt;
          redoAction = { type: "update", oldPrompt: action.newPrompt, newPrompt: action.oldPrompt, index: action.index };
          break;
        case "reorder":
          // 撤销重排序：恢复原来的顺序
          const [moved] = newPrompts.splice(action.newIndex, 1);
          newPrompts.splice(action.oldIndex, 0, moved);
          redoAction = { type: "reorder", oldIndex: action.newIndex, newIndex: action.oldIndex };
          break;
        case "batch":
          // 撤销批量操作：按相反顺序执行所有操作
          const reversedActions = [...action.actions].reverse();
          reversedActions.forEach(subAction => {
            switch (subAction.type) {
              case "add":
                newPrompts = newPrompts.filter((_, index) => index !== subAction.index);
                break;
              case "delete":
                newPrompts.splice(subAction.index, 0, subAction.prompt);
                break;
              case "update":
                newPrompts[subAction.index] = subAction.oldPrompt;
                break;
              case "reorder":
                const [movedItem] = newPrompts.splice(subAction.newIndex, 1);
                newPrompts.splice(subAction.oldIndex, 0, movedItem);
                break;
            }
          });
          // 创建反向的批量操作作为 redo
          const reverseBatchActions: UndoRedoAction[] = action.actions.map(subAction => {
            switch (subAction.type) {
              case "add":
                return { type: "delete", prompt: subAction.prompt, index: subAction.index };
              case "delete":
                return { type: "add", prompt: subAction.prompt, index: subAction.index };
              case "update":
                return { type: "update", oldPrompt: subAction.newPrompt, newPrompt: subAction.oldPrompt, index: subAction.index };
              case "reorder":
                return { type: "reorder", oldIndex: subAction.newIndex, newIndex: subAction.oldIndex };
              default:
                return subAction;
            }
          });
          redoAction = { type: "batch", actions: reverseBatchActions };
          break;
      }

      if (redoAction) {
        pushRedoAction(redoAction);
      }

      return newPrompts;
    });
  }, []);

  const handleRedo = useCallback(() => {
    if (!canRedo()) return;

    const action = popRedoAction();
    if (!action) return;

    console.log("[PromptPanel] Redo action:", action);

    setPrompts(prevPrompts => {
      let newPrompts = [...prevPrompts];
      let undoAction: UndoRedoAction | null = null;

      switch (action.type) {
        case "add":
          // 重做添加：添加该 prompt
          newPrompts.splice(action.index, 0, action.prompt);
          undoAction = { type: "delete", prompt: action.prompt, index: action.index };
          break;
        case "delete":
          // 重做删除：删除该 prompt
          newPrompts = newPrompts.filter((_, index) => index !== action.index);
          undoAction = { type: "add", prompt: action.prompt, index: action.index };
          break;
        case "update":
          // 重做更新：应用新值
          newPrompts[action.index] = action.newPrompt;
          undoAction = { type: "update", oldPrompt: action.oldPrompt, newPrompt: action.newPrompt, index: action.index };
          break;
        case "reorder":
          // 重做重排序：应用新的顺序
          const [moved] = newPrompts.splice(action.oldIndex, 1);
          newPrompts.splice(action.newIndex, 0, moved);
          undoAction = { type: "reorder", oldIndex: action.newIndex, newIndex: action.oldIndex };
          break;
        case "batch":
          // 重做批量操作：按顺序执行所有操作
          action.actions.forEach(subAction => {
            switch (subAction.type) {
              case "add":
                newPrompts.splice(subAction.index, 0, subAction.prompt);
                break;
              case "delete":
                newPrompts = newPrompts.filter((_, index) => index !== subAction.index);
                break;
              case "update":
                newPrompts[subAction.index] = subAction.newPrompt;
                break;
              case "reorder":
                const [movedItem] = newPrompts.splice(subAction.oldIndex, 1);
                newPrompts.splice(subAction.newIndex, 0, movedItem);
                break;
            }
          });
          // 创建反向的批量操作作为 undo
          const reverseBatchActions: UndoRedoAction[] = action.actions.map(subAction => {
            switch (subAction.type) {
              case "add":
                return { type: "delete", prompt: subAction.prompt, index: subAction.index };
              case "delete":
                return { type: "add", prompt: subAction.prompt, index: subAction.index };
              case "update":
                return { type: "update", oldPrompt: subAction.newPrompt, newPrompt: subAction.oldPrompt, index: subAction.index };
              case "reorder":
                return { type: "reorder", oldIndex: subAction.newIndex, newIndex: subAction.oldIndex };
              default:
                return subAction;
            }
          });
          undoAction = { type: "batch", actions: reverseBatchActions };
          break;
      }

      if (undoAction) {
        pushUndoAction(undoAction);
      }

      return newPrompts;
    });
  }, []);

  // 处理批量删除和更新
  useEffect(() => {
    const handleBatchDeleteUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{
        deletes: Array<{ id: string; prompt: PromptItem; index: number }>;
        updates: Array<{ id: string; oldPrompt: PromptItem; newPrompt: PromptItem; index: number }>;
        batchAction: UndoRedoAction;
      }>).detail;
      
      console.log("[NotionPromptArea] [PromptPanel] Batch delete/update event received:", {
        deleteCount: detail?.deletes?.length || 0,
        updateCount: detail?.updates?.length || 0,
        hasBatchAction: !!detail?.batchAction,
      });
      
      if (!detail || (!detail.deletes || detail.deletes.length === 0) && (!detail.updates || detail.updates.length === 0)) {
        console.warn("[NotionPromptArea] [PromptPanel] Invalid batch delete/update event:", detail);
        return;
      }
      
      // 记录批量操作到 undo 栈（只记录一次）
      if (detail.batchAction) {
        console.log("[NotionPromptArea] [PromptPanel] Adding batch action to undo stack");
        addUndoAction(detail.batchAction);
      }
      
      // 执行批量删除和更新（按索引倒序，从后往前删除）
      setPrompts(prevPrompts => {
        console.log("[NotionPromptArea] [PromptPanel] Current prompts before batch operation:", prevPrompts.length);
        let newPrompts = [...prevPrompts];
        
        // 先执行删除（按索引倒序，从后往前删除，避免索引变化）
        const sortedDeletes = [...detail.deletes].sort((a, b) => b.index - a.index);
        console.log("[NotionPromptArea] [PromptPanel] Deleting prompts:", sortedDeletes.map(d => ({ id: d.id, index: d.index })));
        sortedDeletes.forEach(({ id }) => {
          const beforeLength = newPrompts.length;
          newPrompts = newPrompts.filter(p => p.id !== id);
          const afterLength = newPrompts.length;
          if (beforeLength === afterLength) {
            console.warn("[NotionPromptArea] [PromptPanel] Prompt not found for deletion:", id);
          } else {
            console.log("[NotionPromptArea] [PromptPanel] Deleted prompt:", id);
          }
        });
        
        // 然后执行更新（需要重新计算索引，因为删除后索引会变化）
        console.log("[NotionPromptArea] [PromptPanel] Updating prompts:", detail.updates.map(u => ({ id: u.id })));
        detail.updates.forEach(({ id, newPrompt }) => {
          const index = newPrompts.findIndex(p => p.id === id);
          if (index !== -1) {
            console.log("[NotionPromptArea] [PromptPanel] Updating prompt at index:", index, id);
            newPrompts[index] = newPrompt;
          } else {
            console.warn("[NotionPromptArea] [PromptPanel] Prompt not found for update:", id);
          }
        });
        
        console.log("[NotionPromptArea] [PromptPanel] Final prompts after batch operation:", newPrompts.length);
        return newPrompts;
      });
    };
    
    window.addEventListener("batch-delete-update", handleBatchDeleteUpdate);
    return () => {
      window.removeEventListener("batch-delete-update", handleBatchDeleteUpdate);
    };
  }, []);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z 或 Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z 或 Cmd+Shift+Z: Redo
      else if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  const addPrompt = () => {
    // 确保新 prompt 的 ID 唯一
    const existingIds = new Set(prompts.map(p => p?.id).filter(Boolean));
    let newId = Date.now().toString();
    let counter = 0;
    while (existingIds.has(newId)) {
      newId = `${Date.now()}-${counter}`;
      counter++;
    }
    
    const newPrompt: PromptItem = {
      id: newId,
      title: "", // 空标题
      content: [], // 空内容
      isEditing: false,
      isIncluded: true,
    };
    const index = prompts.length;
    // 记录 undo 操作
    addUndoAction({ type: "add", prompt: newPrompt, index });
    setPrompts(prevPrompts => {
      // 确保没有 undefined 值
      const validPrompts = prevPrompts.filter(p => p != null);
      return [...validPrompts, newPrompt];
    });
  };

  const deletePrompt = (id: string) => {
    setPrompts(prevPrompts => {
      const index = prevPrompts.findIndex(p => p.id === id);
      if (index === -1) return prevPrompts;
      const prompt = prevPrompts[index];
      // 记录 undo 操作
      addUndoAction({ type: "delete", prompt, index });
      return prevPrompts.filter(p => p.id !== id);
    });
  };

  const updatePrompt = useCallback((id: string, data: { title: string; content: string[] }) => {
    setPrompts(prevPrompts => {
      const index = prevPrompts.findIndex(p => p.id === id);
      if (index === -1) {
        // 如果 prompt 不存在，创建新的 prompt
        const newPrompt: PromptItem = {
          id,
          title: data.title,
          content: data.content,
          isEditing: false,
          isIncluded: true,
        };
        const newIndex = prevPrompts.length;
        // 记录 undo 操作（创建新 prompt）
        addUndoAction({ type: "add", prompt: newPrompt, index: newIndex });
        return [...prevPrompts, newPrompt];
      }
      const oldPrompt = prevPrompts[index];
      const newPrompt = { ...oldPrompt, ...data };
      // 记录 undo 操作（只在内容真正改变时）
      if (oldPrompt.title !== newPrompt.title || 
          JSON.stringify(oldPrompt.content) !== JSON.stringify(newPrompt.content)) {
        addUndoAction({ type: "update", oldPrompt, newPrompt, index });
      }
      return prevPrompts.map(p => p.id === id ? newPrompt : p);
    });
  }, []);

  const updateSummarySnapshot = useCallback((id: string, snapshot?: SummarySnapshot) => {
    setPrompts(prevPrompts =>
      prevPrompts.map(p => (
        p.id === id
          ? { ...p, summarySnapshot: snapshot === null ? undefined : snapshot }
          : p
      )),
    );
  }, []);

  const sendAllPrompts = async () => {
    setPrompts(prompts.map(p => ({ ...p, isEditing: false })));

    let message = `You will now receive a unified set of structured instructions.
They are organized into titled sections. Each section contains
bullet points that define requirements, constraints, or examples.

Interpret every section as part of one cohesive prompt.
Titles are for organization only — not separate tasks.

After reading all sections, follow the FINAL INSTRUCTION section.
Do not repeat or restate the instructions unless explicitly asked.

`;
    prompts.forEach((prompt) => {
      // Only include included prompts
      if (!prompt || !prompt.isIncluded) {
        return;
      }
      message += "[" + (prompt.title || "") + "]\n";
      if (prompt.content.length > 0) {
        prompt.content.forEach(item => {
          message += "  - " + item + "\n";
        });
      }
      message += "\n";
    });

    message += `[FINAL INSTRUCTION]
Generate your response and follow all instructions above.`;

    setIsSending(true);
    try {
      threadRuntime.composer.setText(message);
      await threadRuntime.composer.send();
    } finally {
      setIsSending(false);
      if (isMobile) {
        setIsOpen(false);
      }
    }
  };

  const updateEditingState = (id: string, isEditing: boolean) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, isEditing } : p));
  };

  const updateIncludeState = (id: string, isIncluded: boolean) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, isIncluded } : p));
  };

  const handleTogglePrompt = (id: string) => {
    // Toggle handled by NotionPromptArea
  };

  const handleEditPrompt = (id: string) => {
    updateEditingState(id, true);
  };

  const handleReorder = (oldIndex: number, newIndex: number) => {
    // 记录 undo 操作
    addUndoAction({ type: "reorder", oldIndex, newIndex });
    setPrompts(prevPrompts => {
      const newPrompts = [...prevPrompts];
      const [removed] = newPrompts.splice(oldIndex, 1);
      newPrompts.splice(newIndex, 0, removed);
      return newPrompts;
    });
  };

  const handleDropMessage = useCallback((
    messageId: string, 
    messageContent: string, 
    role: "user" | "assistant", 
    threadId?: string,
    messageTimestamp?: number,
    overId?: string, 
    insertPosition?: "before" | "after"
  ) => {
    console.log("[Link] [PromptPanel] handleDropMessage called:", { 
      messageId, 
      messageContentLength: messageContent.length, 
      role, 
      threadId,
      messageTimestamp,
      overId, 
      insertPosition,
    });
    
    // Use provided messageContent or create placeholder
    let textContent = messageContent.trim();
    
    if (!textContent) {
      // If no content provided, create a placeholder
      textContent = `Message from ${role}`;
    }

    // Create new prompt from message
    const lines = textContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    // console.log("[PromptPanel] Parsed lines:", lines);

    if (lines.length === 0) {
      // console.log("[PromptPanel] No lines after parsing, returning");
      return;
    }

    // 创建 toggle block，标题为 "New Message"，内容为 message 的内容
    // 记录来源消息信息
    const newPrompt: PromptItem = {
      id: `${messageId}-${Date.now()}`,
      title: "New Message",
      content: lines, // 使用所有行作为 content
      isEditing: false,
      isIncluded: true,
      // 记录来源消息信息
      sourceMessageId: messageId,
      sourceThreadId: threadId,
      sourceMessageRole: role,
      sourceMessageTimestamp: messageTimestamp,
    };

    console.log("[Link] [PromptPanel] Creating new prompt with source info:", {
      promptId: newPrompt.id,
      sourceMessageId: newPrompt.sourceMessageId,
      sourceThreadId: newPrompt.sourceThreadId,
      sourceMessageRole: newPrompt.sourceMessageRole,
      sourceMessageTimestamp: newPrompt.sourceMessageTimestamp,
      contentLines: newPrompt.content.length,
    });
    
    // 计算插入位置 - 优先使用传递的 insertPosition
    setPrompts(prev => {
      let insertIndex = prev.length; // 默认插入到末尾
      
      if (overId && overId.startsWith("block-")) {
        const blockId = overId.replace("block-", "");
        // console.log("[PromptPanel] Looking for prompt with id:", blockId, "in prompts:", prev.map(p => p.id));
        // 找到对应的 prompt index
        const targetIndex = prev.findIndex(p => p.id === blockId);
        if (targetIndex !== -1) {
          // 使用传递的 insertPosition，如果没有则使用 lastInsertPositionRef
          const finalPosition = insertPosition || lastInsertPositionRef.current;
          insertIndex = finalPosition === "before" ? targetIndex : targetIndex + 1;
          // console.log("[PromptPanel] Inserting at index:", insertIndex, "for blockId:", blockId, "position:", finalPosition);
        } else {
          // console.log("[PromptPanel] Block not found, inserting at end. BlockId:", blockId, "Available IDs:", prev.map(p => p.id));
        }
      } else if (overId === "prompt-area") {
        insertIndex = prev.length; // 插入到末尾
        // console.log("[PromptPanel] Inserting at end (prompt-area)");
      }
      
      const updated = [
        ...prev.slice(0, insertIndex),
        newPrompt,
        ...prev.slice(insertIndex)
      ];
      // console.log("[PromptPanel] Updated prompts (inserted at", insertIndex, "):", updated);
      // 记录 undo 操作
      addUndoAction({ type: "add", prompt: newPrompt, index: insertIndex });
      return updated;
    });
  }, []);

  const handleCreateCollection = () => {
    const name = prompt("Enter collection name:", "New Collection");
    if (!name || !name.trim()) return;
    
    const newCollection = createCollection(name.trim());
    addCollection(newCollection);
    setCollections(getCollections());
    setCurrentCollectionId(newCollection.id);
    setCurrentCollectionIdState(newCollection.id);
    setPrompts([]);
  };

  const handleSwitchCollection = (id: string) => {
    setCurrentCollectionId(id);
    setCurrentCollectionIdState(id);
    const collection = getCollection(id);
    if (collection) {
      setPrompts(collection.prompts);
    }
  };

  const handleRenameCollection = (id: string) => {
    const collection = getCollection(id);
    if (!collection) return;
    
    const newName = prompt("Enter new collection name:", collection.name);
    if (!newName || !newName.trim() || newName === collection.name) return;
    
    updateCollection(id, { name: newName.trim() });
    setCollections(getCollections());
    if (id === currentCollectionId) {
      setCurrentCollectionIdState(id);
    }
  };

  const handleDeleteCollection = (id: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return;
    deleteCollection(id);
    setCollections(getCollections());
    const remaining = getCollections();
    if (remaining.length > 0) {
      handleSwitchCollection(remaining[0].id);
    } else {
      const defaultCollection = createCollection("Default", []);
      addCollection(defaultCollection);
      setCollections([defaultCollection]);
      setCurrentCollectionId(defaultCollection.id);
      setCurrentCollectionIdState(defaultCollection.id);
      setPrompts([]);
    }
  };

  const handleExportCollection = () => {
    if (!currentCollection) return;
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
          setCollections(getCollections());
          handleSwitchCollection(imported.id);
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
        if (importAllCollections(text)) {
          setCollections(getCollections());
          alert("Collections imported successfully!");
        } else {
          alert("Failed to import collections. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      const nextMaxWidth = getPanelMaxWidth(isMobile);
      setPanelMaxWidth(nextMaxWidth);
      setPanelWidth((prevWidth) =>
        isMobile ? nextMaxWidth : clampPanelWidth(prevWidth, nextMaxWidth),
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobile]);

  // 保存最后一次 dragOver 的 insertPosition
  const lastInsertPositionRef = useRef<"before" | "after">("after");

  useEffect(() => {
    const handleCollect = (event: Event) => {
      const detail = (event as CustomEvent<PromptCollectDetail>).detail;
      if (!detail || detail.content.length === 0) {
        return;
      }

      setPrompts(prevPrompts => [
        ...prevPrompts,
        {
          id: `${detail.messageId}-${Date.now()}`,
          title: detail.title,
          content: detail.content,
          isEditing: false,
          isIncluded: true,
        },
      ]);
      setIsOpen(true);
    };

    const handleDropMessageEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ 
        messageId: string; 
        messageContent: string; 
        role: "user" | "assistant";
        threadId?: string;
        messageTimestamp?: number;
        overId?: string;
        insertPosition?: "before" | "after";
      }>).detail;
      console.log("[Link] [PromptPanel] Received drop-message-to-prompts event:", {
        messageId: detail?.messageId,
        messageContentLength: detail?.messageContent?.length,
        role: detail?.role,
        threadId: detail?.threadId,
        messageTimestamp: detail?.messageTimestamp,
        overId: detail?.overId,
        insertPosition: detail?.insertPosition,
      });
      if (!detail || !detail.messageContent) {
        console.warn("[Link] [PromptPanel] Invalid detail or no messageContent:", {
          hasDetail: !!detail,
          hasMessageContent: !!detail?.messageContent,
        });
        return;
      }

      console.log("[Link] [PromptPanel] Calling handleDropMessage with source info");
      handleDropMessage(
        detail.messageId, 
        detail.messageContent, 
        detail.role,
        detail.threadId,
        detail.messageTimestamp,
        detail.overId,
        detail.insertPosition
      );
      setIsOpen(true);
    };
    
    const handleDragOverForPosition = (event: Event) => {
      const detail = (event as CustomEvent<{ 
        overId?: string | null; 
        activeType?: string;
        insertPosition?: "before" | "after";
      }>).detail;
      if (detail?.insertPosition) {
        lastInsertPositionRef.current = detail.insertPosition;
        // console.log("[PromptPanel] Last insert position updated:", lastInsertPositionRef.current);
      }
    };

    const handleReorderEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ activeId: string; overId: string }>).detail;
      if (!detail) return;

      const activeId = detail.activeId.replace("prompt-", "");
      const overId = detail.overId.replace("prompt-", "");
      
      const oldIndex = prompts.findIndex((p) => p.id === activeId);
      const newIndex = prompts.findIndex((p) => p.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        handleReorder(oldIndex, newIndex);
      }
    };

    window.addEventListener(PROMPT_COLLECT_EVENT, handleCollect);
    window.addEventListener("drop-message-to-prompts", handleDropMessageEvent);
    window.addEventListener("reorder-prompts", handleReorderEvent);
    window.addEventListener("dnd-drag-over", handleDragOverForPosition);
    return () => {
      window.removeEventListener(PROMPT_COLLECT_EVENT, handleCollect);
      window.removeEventListener("drop-message-to-prompts", handleDropMessageEvent);
      window.removeEventListener("reorder-prompts", handleReorderEvent);
      window.removeEventListener("dnd-drag-over", handleDragOverForPosition);
    };
  }, [prompts, handleDropMessage, handleReorder]);

  useEffect(() => {
    onWidthChange?.(isOpen ? panelWidth : 0);
  }, [isOpen, panelWidth, onWidthChange]);

  useEffect(() => {
    return () => {
      onWidthChange?.(0);
    };
  }, [onWidthChange]);

  return (
    <>
      <PanelExpandTrigger
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
      />
      <Panel open={isOpen} floating={PANEL_FLOATING} width={panelWidth}>
        <PanelResizer
          open={isOpen}
          width={panelWidth}
          minWidth={PANEL_MIN_WIDTH}
          maxWidth={panelMaxWidth}
          onResize={(nextWidth) =>
            setPanelWidth(clampPanelWidth(nextWidth, panelMaxWidth))
          }
        />
        <div className="flex h-full flex-col px-4 pb-4 pt-2">
          <SidebarHeader className="flex items-center gap-2 px-0 pb-4">
            <SidebarMenu className="flex-row items-center gap-2 w-full">
              <SidebarMenuItem className="w-auto">
                <PanelTrigger
                  onClick={() => setIsOpen(false)}
                  srLabel="Close prompt panel"
                />
              </SidebarMenuItem>
              <SidebarMenuItem className="flex-1 min-w-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="w-full justify-between px-3 font-semibold"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <BookOpen className="size-4 shrink-0" />
                        <span className="truncate text-xl">
                          {currentCollection?.name || "Structured Prompts"}
                        </span>
                      </div>
                      <ChevronDown className="size-4 shrink-0" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Collections</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {collections.map((collection) => (
                      <div key={collection.id} className="flex items-center gap-1">
                        <DropdownMenuItem
                          onClick={() => handleSwitchCollection(collection.id)}
                          className={currentCollectionId === collection.id ? "bg-accent flex-1" : "flex-1"}
                        >
                          <span className="truncate">{collection.name}</span>
                        </DropdownMenuItem>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameCollection(collection.id);
                          }}
                          title="Rename collection"
                        >
                          <Pencil className="size-3" />
                        </button>
                        {collections.length > 1 && (
                          <button
                            type="button"
                            className="mr-2 flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(collection.id);
                            }}
                            title="Delete collection"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCreateCollection}>
                      <Plus className="size-4 mr-2" />
                      New Collection
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <div className="flex-1 overflow-y-auto px-4">
            <NotionStylePromptArea
              prompts={prompts}
              onAddPrompt={addPrompt}
              onUpdatePrompt={updatePrompt}
              onDeletePrompt={deletePrompt}
              onIncludeChange={(id, isIncluded) => updateIncludeState(id, isIncluded)}
              onReorder={handleReorder}
              onDropMessage={handleDropMessage}
              onScrollToMessage={handleScrollToMessage}
            />
          </div>


          <Button
            onClick={sendAllPrompts}
            disabled={isSending || prompts.filter(p => p && p.isIncluded).length === 0}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-yellow-500 p-3 text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowLeft className="size-5" />
            )}
            <span>{isSending ? "Sending…" : "Send all selected"}</span>
          </Button>
        </div>
      </Panel>
    </>
  );
}

