"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { DndContext, closestCenter, DragEndEvent, DragOverlay, useDndMonitor } from "@dnd-kit/core";
import cinematicScript from "@/data/cinematic.json";
import { CinematicProvider } from "@/context/cinematic-context";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarExpandTrigger,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { PromptPanel } from "@/components/assistant-ui/prompt-panel";
import { DragMessagePreview } from "@/components/assistant-ui/drag-message-preview";
import { PANEL_SLIDE_DURATION_MS } from "@/components/ui/panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { createThreadListAdapter } from "@/lib/thread-list-adapter";
import { saveThread, getCurrentThreadId, extractThreadTitle, createThread, setCurrentThreadId, getThread, getThreads } from "@/lib/thread-storage";

type AssistantThreadMessage = UIMessage;

const ensureMessageParts = (message: any) => {
  // assistant-ui 支持的消息 part 类型
  const supportedPartTypes = ['text', 'reasoning', 'file', 'source', 'image', 'tool-call'];
  
  if (Array.isArray(message?.parts) && message.parts.length > 0) {
    return message.parts
      .filter((part: any) => {
        // 过滤掉不支持的 part 类型（如 step-start）
        if (!part || typeof part !== "object") return true;
        if (part.type && !supportedPartTypes.includes(part.type)) {
          console.warn(`[Assistant] Filtering out unsupported part type: ${part.type}`);
          return false;
        }
        return true;
      })
      .map((part: any) => {
        if (!part || typeof part !== "object") {
          return { type: "text", text: String(part ?? "") };
        }
        if ((part.type === "text" || part.type === "reasoning") && typeof part.text !== "string") {
          return { ...part, text: String(part.text ?? "") };
        }
        return part;
      })
      .filter(Boolean);
  }

  const legacyContent = (message as any)?.content;
  if (typeof legacyContent === "string") {
    return [{ type: "text", text: legacyContent }];
  }
  if (Array.isArray(legacyContent)) {
    // 过滤掉不支持的 part 类型
    return legacyContent
      .filter((part: any) => {
        if (typeof part === "string") return true;
        if (typeof part === "object" && part.type) {
          if (!supportedPartTypes.includes(part.type)) {
            console.warn(`[Assistant] Filtering out unsupported part type: ${part.type}`);
            return false;
          }
          return true;
        }
        return false;
      })
      .map((part: any) => {
        // 确保 part 格式正确
        if (typeof part === "string") {
          return { type: "text", text: part };
        }
        return part;
      });
  }
  return [{ type: "text", text: "" }];
};

const sanitizeMessageForStorage = (message: AssistantThreadMessage): AssistantThreadMessage => ({
  ...message,
  parts: ensureMessageParts(message),
});

const convertMessagesForRuntime = (messages: AssistantThreadMessage[]) =>
  messages.map((msg, index) => ({
    id: msg.id || `msg-${index}-${Date.now()}`,
    role: msg.role,
    content: ensureMessageParts(msg),
    attachments: (msg as any)?.attachments,
    metadata: msg.metadata,
  }));

const cinematicPrompts = Array.isArray(cinematicScript)
  ? (cinematicScript as unknown[])
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0)
  : [];
const CINEMATIC_LABEL_DESKTOP_LENGTH = 48;
const CINEMATIC_LABEL_MOBILE_LENGTH = 28;

export const Assistant = () => {
  const [isUserStudyMode, setIsUserStudyMode] = useState(true);
  const userStudyModeRef = useRef(isUserStudyMode);
  userStudyModeRef.current = isUserStudyMode;
  
  // Wait for client-side mount to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantThreadMessage>({
        api: "/api/chat",
        body: () => ({
          userStudyMode: userStudyModeRef.current,
        }),
      }),
    [userStudyModeRef],
  );

  // 获取当前线程 ID（仅在客户端）
  const [currentThreadId, setCurrentThreadIdState] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<AssistantThreadMessage[]>([]);
  
  useEffect(() => {
    if (isMounted) {
      const id = getCurrentThreadId();
      setCurrentThreadIdState(id);
      
      console.log("[Assistant] Initial load:", { threadId: id });
      
      // 加载线程消息
      if (id) {
        const thread = getThread(id);
        console.log("[Assistant] Loading thread:", { 
          threadId: id, 
          hasThread: !!thread,
          messageCount: thread?.messages?.length || 0
        });
        
        if (thread && thread.messages && thread.messages.length > 0) {
          // 确保消息格式正确
          const messages = thread.messages.map((msg: any) => {
            const withId = msg.id
              ? msg
              : { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
            return sanitizeMessageForStorage(withId as AssistantThreadMessage);
          });
          console.log("[Assistant] Loaded messages:", { count: messages.length });
          setThreadMessages(messages as AssistantThreadMessage[]);
          // 重置同步状态，确保初始加载时能触发同步
          lastSyncedThreadIdRef.current = null;
        } else {
          console.log("[Assistant] No messages in thread");
          setThreadMessages([]);
        }
      } else {
        // 如果没有当前线程，尝试创建或加载第一个线程
        const threads = getThreads();
        console.log("[Assistant] No current thread, available threads:", threads.length);
        
        if (threads.length > 0) {
          const firstThread = threads[0];
          setCurrentThreadId(firstThread.id);
          setCurrentThreadIdState(firstThread.id);
          if (firstThread.messages && firstThread.messages.length > 0) {
            const firstMessages = firstThread.messages.map((msg: any) =>
              sanitizeMessageForStorage(
                msg.id
                  ? (msg as AssistantThreadMessage)
                  : { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }
              )
            );
            console.log("[Assistant] Loaded first thread messages:", { count: firstMessages.length });
            setThreadMessages(firstMessages as AssistantThreadMessage[]);
            // 重置同步状态，确保初始加载时能触发同步
            lastSyncedThreadIdRef.current = null;
          } else {
            console.log("[Assistant] First thread has no messages");
            setThreadMessages([]);
          }
        } else {
          console.log("[Assistant] No threads available");
          setThreadMessages([]);
        }
      }
    }
  }, [isMounted]);

  // 监听线程切换事件
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleThreadSwitch = (e: CustomEvent<{ threadId: string }>) => {
      const thread = getThread(e.detail.threadId);
      if (thread) {
        setCurrentThreadIdState(thread.id);
        setCurrentThreadId(thread.id);
        const sanitized = (thread.messages || []).map((msg: any) =>
          sanitizeMessageForStorage(
            msg.id
              ? (msg as AssistantThreadMessage)
              : { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }
          )
        );
        console.log("[Assistant] Switching thread:", { 
          threadId: thread.id, 
          messageCount: sanitized.length 
        });
        setThreadMessages(sanitized as AssistantThreadMessage[]);
        // 重置同步状态，以便加载新线程的消息
        lastSyncedThreadIdRef.current = null;
      }
    };
    
    window.addEventListener("thread-switch", handleThreadSwitch as EventListener);
    return () => window.removeEventListener("thread-switch", handleThreadSwitch as EventListener);
  }, []);

  // 确保在消息加载完成后再初始化 chat
  const chat = useChat<AssistantThreadMessage>({
    transport,
  });

  // 3. Runtime creation
  const runtime = useAISDKRuntime(chat);
  
  // 用 ref 来跟踪同步状态，避免循环更新
  const isSyncingRef = useRef(false);
  const lastSyncedThreadIdRef = useRef<string | null>(null);
  const lastSyncedMessageIdsRef = useRef<string>("");
  
  // 当 threadMessages 变化时，同步 runtime 和 chat 消息
  useEffect(() => {
    if (!isMounted || !runtime || isSyncingRef.current) return;
    
    // 如果没有 threadMessages，不需要同步
    if (threadMessages.length === 0) return;
    
    // 检查是否是线程切换（包括初始加载，此时 lastSyncedThreadIdRef.current 为 null）
    const isThreadSwitch = lastSyncedThreadIdRef.current !== currentThreadId;
    
    // 检查是否需要同步：
    // 1. 线程切换（包括初始加载）
    // 2. chat.messages 为空但 threadMessages 有内容
    const shouldSync = isThreadSwitch || 
      (threadMessages.length > 0 && chat.messages.length === 0);
    
    if (!shouldSync) return;
    
    // 检查消息 ID 是否真的变化了（初始加载时跳过这个检查）
    const currentMessageIds = threadMessages.map((m) => m.id).join(",");
    if (!isThreadSwitch && currentMessageIds === lastSyncedMessageIdsRef.current) {
      return; // 消息没有变化，不需要同步
    }
    
    isSyncingRef.current = true;
    
    try {
      const runtimeMessages = convertMessagesForRuntime(threadMessages);
      
      console.log("[Assistant] Syncing messages:", {
        count: runtimeMessages.length,
        threadId: currentThreadId,
        isThreadSwitch,
        isInitialLoad: lastSyncedThreadIdRef.current === null,
        chatMessagesCount: chat.messages.length,
        threadMessagesCount: threadMessages.length,
      });
      
      // 先同步 runtime
      (runtime as any).thread?.reset?.(runtimeMessages);
      
      // 再同步 chat.messages（只在需要时）
      if (isThreadSwitch || chat.messages.length === 0) {
        chat.setMessages(threadMessages as AssistantThreadMessage[]);
      }
      
      // 更新跟踪状态
      lastSyncedThreadIdRef.current = currentThreadId;
      lastSyncedMessageIdsRef.current = currentMessageIds;
    } catch (e) {
      console.error("Failed to sync messages:", e);
    } finally {
      // 使用 setTimeout 确保状态更新完成后再重置标志
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    }
  }, [threadMessages, isMounted, runtime, currentThreadId, chat]);
  
  // 注册 ThreadListAdapter 以支持线程管理
  useEffect(() => {
    if (!isMounted) return;
    
    if (runtime && typeof runtime === "object") {
      try {
        const adapter = createThreadListAdapter();
        (runtime as any).threadListAdapter = adapter;
        
        // 初始化线程列表
        adapter.initialize().then((result) => {
          if (result.currentThreadId && result.threads.length > 0) {
            const currentThread = result.threads.find(t => t.id === result.currentThreadId);
            if (currentThread && currentThread.messages.length > 0) {
              // 加载当前线程的消息
              try {
                // 注意：这里不能直接修改 chat.messages，需要通过其他方式
                // assistant-ui 会自动处理消息加载
              } catch (error) {
                console.error("Failed to load thread messages:", error);
              }
            }
          }
        }).catch((error) => {
          console.error("Failed to initialize thread list:", error);
        });
      } catch (error) {
        console.error("Failed to register thread list adapter:", error);
      }
    }
  }, [runtime, isMounted]);

  // 自动保存线程（当消息变化时，使用防抖）
  useEffect(() => {
    if (!isMounted || !currentThreadId || isSyncingRef.current) return;
    
    const messages = chat.messages;
    
    // 只有在消息数量大于0时才保存
    if (messages.length === 0) {
      return;
    }
    
    // 检查消息是否真的变化了（避免在同步后立即保存）
    const currentMessageIds = messages.map((m) => m.id).join(",");
    if (currentMessageIds === lastSyncedMessageIdsRef.current && 
        messages.length === threadMessages.length) {
      return; // 消息没有变化，不需要保存
    }
    
    // 防抖：延迟保存，避免频繁写入
    const timeoutId = setTimeout(() => {
      // 再次检查是否正在同步
      if (isSyncingRef.current) {
        return;
      }
      
      try {
        const title = extractThreadTitle(messages);
        const existingThread = getThread(currentThreadId);
        
        // 确保消息格式正确（包含 id 和 parts）
        const formattedMessages = messages.map((msg: any) =>
          sanitizeMessageForStorage(
            msg.id
              ? (msg as AssistantThreadMessage)
              : { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }
          )
        );
        
        console.log("[Assistant] Auto-saving thread:", {
          threadId: currentThreadId,
          messageCount: formattedMessages.length,
          title,
        });
        
        saveThread({
          id: currentThreadId,
          title,
          messages: formattedMessages as any[],
          createdAt: existingThread?.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        
        // 只在消息真的变化时才更新 threadMessages（避免循环）
        const formattedIds = formattedMessages.map((m) => m.id).join(",");
        if (formattedIds !== lastSyncedMessageIdsRef.current) {
          setThreadMessages(formattedMessages as AssistantThreadMessage[]);
          lastSyncedMessageIdsRef.current = formattedIds;
        }
        
        // 通知线程列表更新
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("thread-updated"));
        }
      } catch (error) {
        console.error("Failed to auto-save thread:", error);
        // 不抛出错误，避免影响用户体验
      }
    }, 500); // 500ms 防抖

    return () => clearTimeout(timeoutId);
  }, [chat.messages, isMounted, currentThreadId, threadMessages.length]);

  // 当线程切换时，重新加载线程消息
  useEffect(() => {
    if (!isMounted) return;
    
    try {
      if (currentThreadId) {
        const thread = getThread(currentThreadId);
        if (thread && thread.messages && thread.messages.length > 0) {
          const messages = (thread.messages as any[]).map((msg: any) =>
            sanitizeMessageForStorage(
              msg.id
                ? (msg as AssistantThreadMessage)
                : { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }
            )
          );
          setThreadMessages(messages as AssistantThreadMessage[]);
        } else {
          setThreadMessages([]);
        }
      } else {
        setThreadMessages([]);
      }
    } catch (error) {
      console.error("Failed to load thread messages:", error);
      setThreadMessages([]);
    }
  }, [currentThreadId, isMounted]);

  const [cinematicIndex, setCinematicIndex] = useState(0);
  const [isSendingCinematic, setIsSendingCinematic] = useState(false);
  const [structifyFeature, setStructifyFeature] = useState(false);
  const [promptPanelWidth, setPromptPanelWidth] = useState(0);
  const toggleUserStudyMode = useCallback(() => {
    setIsUserStudyMode((prev) => !prev);
  }, []);

  const isMobileViewport = useIsMobile();
  const shouldHideSidebarTrigger = isMobileViewport && promptPanelWidth > 0;


  const nextPrompt = cinematicPrompts[cinematicIndex] ?? null;
  const nextPromptLabel = useMemo(() => {
    if (nextPrompt === null) {
      return null;
    }

    const maxLength = isMobileViewport
      ? CINEMATIC_LABEL_MOBILE_LENGTH
      : CINEMATIC_LABEL_DESKTOP_LENGTH;

    return nextPrompt.length > maxLength
      ? `${nextPrompt.slice(0, maxLength)}…`
      : nextPrompt;
  }, [isMobileViewport, nextPrompt]);
  const hasNextPrompt = Boolean(nextPrompt);

  const sendNextPrompt = useCallback(async () => {
    if (
      !hasNextPrompt ||
      isSendingCinematic ||
      !nextPrompt ||
      chat.status !== "ready"
    ) {
      return;
    }

    try {
      setIsSendingCinematic(true);
      await chat.sendMessage({ text: nextPrompt });
      setCinematicIndex((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to send cinematic prompt:", error);
    } finally {
      setIsSendingCinematic(false);
    }
  }, [chat, hasNextPrompt, isSendingCinematic, nextPrompt]);

  const cinematicContextValue = useMemo(
    () => ({
      hasNextPrompt,
      isSendingPrompt: isSendingCinematic || chat.status !== "ready",
      nextPromptLabel,
      sendNextPrompt,
    }),
    [
      chat.status,
      hasNextPrompt,
      isSendingCinematic,
      nextPromptLabel,
      sendNextPrompt,
    ],
  );

  const toggleStructifyFeature = useCallback(() => {
    setStructifyFeature((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isUserStudyMode) {
      setStructifyFeature(true);
      setCinematicIndex(cinematicPrompts.length);
    }
  }, [isUserStudyMode, setStructifyFeature, setCinematicIndex]);

  useEffect(() => {
    if (!structifyFeature) {
      setPromptPanelWidth(0);
    }
  }, [structifyFeature]);

  // 保存最新的鼠标位置
  const lastMouseYRef = useRef<number | null>(null);
  // 保存最后一次 dragOver 的位置信息
  const lastDragOverInfoRef = useRef<{
    overId: string | null;
    insertPosition: "before" | "after";
    mouseY: number | null;
  }>({ overId: null, insertPosition: "after", mouseY: null });
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseYRef.current = e.clientY;
    };
    
    const handleDragOverEvent = (event: Event) => {
      const detail = (event as CustomEvent<{
        overId?: string | null;
        insertPosition?: "before" | "after";
        mouseY?: number;
      }>).detail;
      if (detail) {
        lastDragOverInfoRef.current = {
          overId: detail.overId || null,
          insertPosition: detail.insertPosition || "after",
          mouseY: detail.mouseY || null,
        };
      }
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("dnd-drag-over", handleDragOverEvent);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("dnd-drag-over", handleDragOverEvent);
    };
  }, []);

  const [activeDragData, setActiveDragData] = useState<{
    messageId: string;
    role: "user" | "assistant";
    content: string;
  } | null>(null);

  const handleDragStart = useCallback((event: any) => {
    // console.log("[Drag] Drag start:", event.active.data.current);
    if (event.active.data.current?.type === "message") {
      // console.log("[Drag] Message drag started");
      const messageId = event.active.data.current.messageId as string;
      const role = event.active.data.current.role as "user" | "assistant";
      
      // 提取消息内容
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      let messageContent = "";
      
      if (messageElement) {
        const contentSelector = role === "user" 
          ? ".aui-user-message-content" 
          : ".aui-assistant-message-content";
        const contentElement = messageElement.querySelector(contentSelector);
        
        if (contentElement) {
          messageContent = contentElement.textContent || "";
        } else {
          messageContent = messageElement.textContent || "";
        }
        
        messageContent = messageContent
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .join("\n");
      }
      
      setActiveDragData({ messageId, role, content: messageContent });
      
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("dnd-drag-start", {
            detail: { type: "message" },
          })
        );
      }
    }
  }, []);

  const handleDragOver = useCallback((event: any) => {
    if (event.active.data.current?.type === "message") {
      // 使用全局保存的最新鼠标位置
      const currentMouseY = lastMouseYRef.current;
      
      const overId = event.over?.id?.toString() || null;
      
      // console.log("[Drag] Drag over:", {
      //   overId,
      //   activeType: event.active.data.current?.type,
      //   insertPosition: "before" | "after",
      //   mouseY: currentMouseY,
      //   originalOverId: event.over?.id?.toString(),
      // });
      
      // 计算鼠标相对于 block 的位置
      let insertPosition: "before" | "after" = "after";
      let targetOverId = overId;
      
      if (currentMouseY !== undefined && currentMouseY !== null) {
        // 获取所有 block 元素，根据鼠标 Y 坐标找到对应的行
        const blockElements = document.querySelectorAll('[data-block-id]');
        let targetBlockId: string | null = null;
        let targetPosition: "before" | "after" = "after";
        let minDistance = Infinity;
        
        // 遍历所有 block，找到鼠标位置对应的 block
        for (let i = 0; i < blockElements.length; i++) {
          const el = blockElements[i];
          const rect = el.getBoundingClientRect();
          
          // 如果鼠标在这个 block 的范围内
          if (currentMouseY >= rect.top && currentMouseY <= rect.bottom) {
            targetBlockId = el.getAttribute('data-block-id');
            // 如果鼠标在 block 的上半部分（前 40%），插入到前面
            // 如果鼠标在 block 的下半部分（后 60%），插入到后面
            const relativeY = currentMouseY - rect.top;
            const threshold = rect.height * 0.4;
            targetPosition = relativeY < threshold ? "before" : "after";
            break;
          } else {
            // 计算距离，找到最近的 block
            const blockCenter = rect.top + rect.height / 2;
            const distance = Math.abs(currentMouseY - blockCenter);
            if (distance < minDistance) {
              minDistance = distance;
              targetBlockId = el.getAttribute('data-block-id');
              targetPosition = currentMouseY < blockCenter ? "before" : "after";
            }
          }
        }
        
        // 如果找到了目标 block，使用它
        if (targetBlockId) {
          insertPosition = targetPosition;
          targetOverId = `block-${targetBlockId}`;
        } else if (overId?.startsWith("block-")) {
          // 如果没找到，但 overId 是 block，使用原来的逻辑
          const overRect = event.over?.rect;
          if (overRect) {
            const relativeY = currentMouseY - overRect.top;
            const threshold = overRect.height * 0.4;
            insertPosition = relativeY < threshold ? "before" : "after";
          }
        }
      } else if (overId?.startsWith("block-")) {
        // 如果没有鼠标位置，使用 over 元素的中间位置
        const overRect = event.over?.rect;
        if (overRect) {
          insertPosition = "after";
        }
      }
      
      // console.log("[Drag] Drag over:", { 
      //   overId: targetOverId, 
      //   activeType: "message",
      //   insertPosition,
      //   mouseY: currentMouseY,
      //   originalOverId: overId,
      // });
      
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("dnd-drag-over", {
            detail: { 
              activeType: "message",
              overId: targetOverId,
              insertPosition: insertPosition,
              mouseY: currentMouseY,
            },
          })
        );
      }
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    // console.log("[Drag] Drag end:", { 
    //   activeType: active.data.current?.type, 
    //   overId: over?.id?.toString(),
    //   activeId: active.id.toString()
    // });

    // 清除拖拽预览数据
    setActiveDragData(null);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dnd-drag-end"));
    }

    if (!over) {
      // console.log("[Drag] No over target, returning");
      return;
    }

    const overId = over.id.toString();
    
    // 处理 tree-node 拖拽（folder 和 page 的拖拽）
    if (active.data.current?.type === "tree-node") {
      const nodeId = active.data.current.nodeId as string;
      const nodeType = active.data.current.nodeType as "folder" | "page";
      
      // 如果拖拽到另一个 tree-drop 区域
      if (over.data.current?.type === "tree-drop") {
        const targetNodeId = over.data.current.nodeId as string;
        const targetNodeType = over.data.current.nodeType as "folder" | "page";
        
        // 不能将节点拖到自己或自己的子节点上
        if (nodeId === targetNodeId) {
          return;
        }
        
        // 导入 moveNode 函数
        const { moveNode } = require("@/lib/prompt-storage");
        
        // 如果目标是 folder，将节点移动到该 folder 下
        // 如果目标是 page，将节点移动到该 page 的父节点下（与 page 同级）
        if (targetNodeType === "folder") {
          moveNode(nodeId, targetNodeId);
        } else {
          // 如果目标是 page，需要获取该 page 的 parentId
          const { getNode } = require("@/lib/prompt-storage");
          const targetNode = getNode(targetNodeId);
          if (targetNode) {
            moveNode(nodeId, targetNode.parentId);
          }
        }
        
        // 触发刷新事件，让 collection-tree 重新渲染
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tree-node-moved", {
            detail: { nodeId, targetNodeId }
          }));
        }
        
        return;
      }
      
      // 如果拖拽到根区域（没有 over 或 over 不是 tree-drop）
      // 将节点移动到根目录
      if (!over.data.current || over.data.current.type !== "tree-drop") {
        const { moveNode } = require("@/lib/prompt-storage");
        moveNode(nodeId, null);
        
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tree-node-moved", {
            detail: { nodeId, targetNodeId: null }
          }));
        }
        
        return;
      }
    }
    
    // 处理从消息拖拽到 prompts 区域（包括 prompt-area 或任何 block）
    if (active.data.current?.type === "message" && 
        (overId === "prompt-area" || overId.startsWith("block-"))) {
      // console.log("[Drag] Message dropped to prompt area or block:", overId);
      const messageId = active.data.current.messageId as string;
      const role = active.data.current.role as "user" | "assistant";
      
      // 提取消息内容 - 从 DOM 元素中获取文本
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      let messageContent = "";
      
      if (messageElement) {
        // 尝试从消息内容区域提取文本（排除操作按钮等）
        const contentSelector = role === "user" 
          ? ".aui-user-message-content" 
          : ".aui-assistant-message-content";
        const contentElement = messageElement.querySelector(contentSelector);
        
        if (contentElement) {
          messageContent = contentElement.textContent || "";
        } else {
          // 如果没有找到特定内容区域，使用整个元素的文本
          messageContent = messageElement.textContent || "";
        }
        
        // 清理文本：移除多余空白
        messageContent = messageContent
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .join("\n");
      }
      
      // 使用最后一次 dragOver 的位置信息，而不是 over.id
      // 这样可以确保插入位置与蓝色指示线一致
      const finalOverId = lastDragOverInfoRef.current.overId || overId;
      const finalInsertPosition = lastDragOverInfoRef.current.insertPosition;
      
      // console.log("[Drag] Using final position:", {
      //   finalOverId,
      //   finalInsertPosition,
      //   originalOverId: overId,
      //   lastDragOverInfo: lastDragOverInfoRef.current
      // });

      // 获取当前线程 ID 和消息时间戳
      // 消息肯定属于当前显示的线程，所以使用 getCurrentThreadId() 获取
      // 如果还是 null，尝试从 threadMessages 或 chat.messages 中查找消息所属的线程
      console.log("[Link] [Drag] Starting to find thread ID for message:", {
        messageId,
        currentThreadId,
        getCurrentThreadId: getCurrentThreadId(),
        threadMessagesCount: threadMessages.length,
        chatMessagesCount: chat.messages.length,
      });
      
      let threadId = currentThreadId || getCurrentThreadId();
      console.log("[Link] [Drag] Initial thread ID:", { threadId, source: threadId === currentThreadId ? "currentThreadId" : "getCurrentThreadId()" });
      
      // 如果还是 null，尝试从消息本身查找（通过遍历所有线程）
      if (!threadId) {
        console.log("[Link] [Drag] Thread ID is null, searching through all threads...");
        const threads = getThreads();
        console.log("[Link] [Drag] Total threads available:", threads.length);
        for (const thread of threads) {
          if (thread.messages && thread.messages.some((m: any) => m.id === messageId)) {
            threadId = thread.id;
            console.log("[Link] [Drag] Found thread ID from message search:", {
              threadId,
              threadTitle: thread.title,
              messageCount: thread.messages.length,
            });
            break;
          }
        }
        if (!threadId) {
          console.warn("[Link] [Drag] Could not find thread ID for message:", messageId);
        }
      }
      
      // 如果仍然没有找到，使用当前线程状态（可能还在初始化）
      if (!threadId && currentThreadId) {
        threadId = currentThreadId;
        console.log("[Link] [Drag] Using currentThreadId as fallback:", threadId);
      }
      
      const messageTimestamp = Date.now();
      
      console.log("[Link] [Drag] Final thread ID for message:", {
        messageId,
        threadId,
        messageTimestamp,
        role,
        messageContentLength: messageContent.length,
      });
      
      // 触发自定义事件通知 prompt-panel
      if (typeof window !== "undefined" && messageContent) {
        // console.log("[Drag] Dispatching drop-message-to-prompts event:", {
        //   messageId,
        //   messageContentLength: messageContent.length,
        //   role,
        //   threadId,
        //   messageTimestamp,
        //   overId: finalOverId,
        //   insertPosition: finalInsertPosition
        // });
        
        window.dispatchEvent(
          new CustomEvent("drop-message-to-prompts", {
            detail: { 
              messageId, 
              messageContent, 
              role,
              threadId,
              messageTimestamp,
              overId: finalOverId, // 使用最后一次 dragOver 的 overId
              insertPosition: finalInsertPosition, // 传递 insertPosition
            },
          })
        );
      } else {
        console.log("[Drag] Not dispatching event - no messageContent or window");
      }
      return;
    }

    // 处理 prompts 内部排序（通过自定义事件）
    if (active.id !== over.id && active.id.toString().startsWith("prompt-")) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("reorder-prompts", {
            detail: { 
              activeId: active.id.toString(),
              overId: over.id.toString(),
            },
          })
        );
      }
    }
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <DndContext 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <CinematicProvider value={cinematicContextValue}>
          <SidebarProvider>
            <div className="flex h-dvh w-full pr-0.5">
              <ThreadListSidebar
                structifyFeature={structifyFeature}
                onToggleStructifyFeature={toggleStructifyFeature}
                userStudyMode={isUserStudyMode}
                onToggleUserStudyMode={toggleUserStudyMode}
              />
              <SidebarInset>
                <SidebarExpandTrigger hidden={shouldHideSidebarTrigger} />
                <div
                  className="flex-1 overflow-hidden"
                  style={{
                    paddingRight: structifyFeature && !isMobileViewport ? promptPanelWidth : 0,
                    transition: `padding-right ${PANEL_SLIDE_DURATION_MS}ms ease`,
                  }}
                >
                  <Thread
                    key={currentThreadId || "default"} // 当线程切换时，强制重新渲染以加载新消息
                    structifyFeature={structifyFeature}
                    userStudyMode={isUserStudyMode}
                  />
                </div>
              </SidebarInset>
              {structifyFeature && (
                <PromptPanel onWidthChange={setPromptPanelWidth} />
              )}
            </div>
          </SidebarProvider>
        </CinematicProvider>
      </AssistantRuntimeProvider>
      <DragOverlay>
        {activeDragData ? (
          <DragMessagePreview
            messageId={activeDragData.messageId}
            role={activeDragData.role}
            content={activeDragData.content}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
