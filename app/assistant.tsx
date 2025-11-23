"use client";

import { useMemo, useState, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChat } from "@ai-sdk/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import rawInitialHistory from "@/data/initial-history.json";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { PromptSidebar } from "@/components/prompt-sidebar/prompt-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Keep in sync with sidebar transition duration.
const SIDEBAR_SLIDE_ANIMATION_MS = 200;

// Show a sidebar trigger when the sidebar is collapsed or mobile and not open.
const SidebarExpandTrigger = () => {
  const { state, isMobile, openMobile } = useSidebar();
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    const shouldShow = state === "collapsed" || (isMobile && !openMobile);

    if (!shouldShow) {
      setCanShow(false);
      return;
    }

    setCanShow(false);

    const timer = window.setTimeout(() => {
      setCanShow(true);
    }, SIDEBAR_SLIDE_ANIMATION_MS); // Keep in sync with sidebar transition duration.

    return () => {
      window.clearTimeout(timer);
    };
  }, [state, isMobile, openMobile]);

  if (!canShow) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20">
      <SidebarTrigger className="pointer-events-auto shadow-md" />
    </div>
  );
};

export const Assistant = () => {
  // 1. Stable initial messages
  const initialMessages = useMemo(() => {
    return (rawInitialHistory.messages || []).map((msg, i) => {
      // Convert complex content to string for Vercel AI SDK
      const content = Array.isArray(msg.content)
        ? msg.content
            .map((c: any) => (c.type === "text" ? c.text : ""))
            .join("\n")
        : (msg.content as string);

      return {
        id: (msg as any).id || `init-${i}`,
        role: msg.role as "user" | "assistant" | "system",
        content,
        parts: [{ type: "text", text: content }],
      };
    });
  }, []);

  // 2. Separate hook call with stable configuration
  const chat = useChat({
    api: "/api/chat",
    messages: initialMessages as any,
  } as any);

  // 3. Runtime creation
  const runtime = useAISDKRuntime(chat);

  // 4. Wait for client-side mount to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <SidebarExpandTrigger />
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
          <PromptSidebar />
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
