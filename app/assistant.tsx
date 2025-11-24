"use client";

import { useMemo, useState, useEffect } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import rawInitialHistory from "@/data/initial-history.json";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarExpandTrigger,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { PromptPanel } from "@/components/assistant-ui/prompt-panel";

type InitialHistoryTextPart = {
  type: "text";
  text: string;
};

type InitialHistoryMessage = {
  id?: string;
  role: UIMessage["role"];
  content: string | InitialHistoryTextPart[];
};

type InitialHistory = {
  messages: InitialHistoryMessage[];
};

type AssistantThreadMessage = UIMessage & {
  content: string;
};

const initialHistory = rawInitialHistory as InitialHistory;

const flattenContentToText = (
  content: InitialHistoryMessage["content"],
): string => {
  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n");
  }

  return content;
};

export const Assistant = () => {
  // 1. Stable initial messages
  const initialMessages = useMemo<AssistantThreadMessage[]>(() => {
    return (initialHistory.messages || []).map((msg, i) => {
      // Convert complex content to string for Vercel AI SDK
      const content = flattenContentToText(msg.content);

      return {
        id: msg.id || `init-${i}`,
        role: msg.role,
        content,
        parts: [{ type: "text", text: content }],
      };
    });
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantThreadMessage>({
        api: "/api/chat",
      }),
    [],
  );

  // 2. Separate hook call with stable configuration
  const chat = useChat<AssistantThreadMessage>({
    transport,
    messages: initialMessages,
  });

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
          <PromptPanel />
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
