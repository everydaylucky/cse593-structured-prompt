"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
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
import { PANEL_SLIDE_DURATION_MS } from "@/components/ui/panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { createThreadListAdapter } from "@/lib/thread-list-adapter";
import { saveThread, getCurrentThreadId, extractThreadTitle, createThread, setCurrentThreadId, getThread } from "@/lib/thread-storage";

type AssistantThreadMessage = UIMessage & {
  content: string;
};

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
      
      // 加载线程消息
      if (id) {
        const thread = getThread(id);
        if (thread && thread.messages.length > 0) {
          setThreadMessages(thread.messages as AssistantThreadMessage[]);
        } else {
          setThreadMessages([]);
        }
      } else {
        setThreadMessages([]);
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
        setThreadMessages(thread.messages as AssistantThreadMessage[]);
      }
    };
    
    window.addEventListener("thread-switch", handleThreadSwitch as EventListener);
    return () => window.removeEventListener("thread-switch", handleThreadSwitch as EventListener);
  }, []);

  const chat = useChat<AssistantThreadMessage>({
    transport,
    initialMessages: threadMessages, // 使用线程消息作为初始消息
  });

  // 3. Runtime creation
  const runtime = useAISDKRuntime(chat);
  
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
    if (!isMounted || !currentThreadId) return;
    
    const messages = chat.messages;
    if (messages.length === 0) return;

    // 防抖：延迟保存，避免频繁写入
    const timeoutId = setTimeout(() => {
      try {
        const title = extractThreadTitle(messages);
        saveThread({
          id: currentThreadId,
          title,
          messages: messages as any[],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        
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
  }, [chat.messages, isMounted, currentThreadId]);

  // 当线程切换时，重新加载线程消息并重置 runtime
  useEffect(() => {
    if (!isMounted || !runtime) return;
    
    try {
      if (currentThreadId) {
        const thread = getThread(currentThreadId);
        if (thread && thread.messages.length > 0) {
          const messages = thread.messages as AssistantThreadMessage[];
          setThreadMessages(messages);
          // 使用 runtime 的 reset 方法重置消息
          try {
            (runtime as any).thread?.reset?.(messages);
          } catch (e) {
            console.warn("Failed to reset runtime messages:", e);
          }
        } else {
          setThreadMessages([]);
          try {
            (runtime as any).thread?.reset?.([]);
          } catch (e) {
            console.warn("Failed to reset runtime messages:", e);
          }
        }
      } else {
        setThreadMessages([]);
        try {
          (runtime as any).thread?.reset?.([]);
        } catch (e) {
          console.warn("Failed to reset runtime messages:", e);
        }
      }
    } catch (error) {
      console.error("Failed to load thread messages:", error);
      setThreadMessages([]);
    }
  }, [currentThreadId, isMounted, runtime]);

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

  if (!isMounted) {
    return null;
  }

  return (
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
  );
};
