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
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="https://www.assistant-ui.com/docs/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Build Your Own ChatGPT UX
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Starter Template</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
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
