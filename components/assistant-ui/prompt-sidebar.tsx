"use client";

import { useState, useEffect, useRef, type ComponentProps } from "react";
import { Plus, PanelRightClose, PanelRight, ArrowLeft, Loader2 } from "lucide-react";
import { PromptCard } from "./prompt-card";
import { cn } from "@/lib/utils";
import { useAssistantApi } from "@assistant-ui/react";
import { Button } from "../ui/button";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { PROMPT_COLLECT_EVENT, type PromptCollectDetail } from "@/lib/prompt-collector";

interface PromptItem {
  id: string;
  title: string;
  content: string[];
  isEditing?: boolean;
}

const PromptSidebarTrigger = ({
  onClick,
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    className={cn("size-7", className)}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
    {...props}
  >
    <PanelRightClose className="size-4" />
    <span className="sr-only">Close prompt sidebar</span>
  </Button>
);

const PROMPT_SIDEBAR_SLIDE_DURATION_MS = 300;

const PromptSidebarExpandTrigger = ({
  isOpen,
  onOpen,
}: {
  isOpen: boolean;
  onOpen: () => void;
}) => {
  const [canShow, setCanShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnimationFrame = useRef<number | null>(null);
  const delayTimer = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCanShow(false);
      setIsVisible(false);
      if (fadeAnimationFrame.current !== null) {
        window.cancelAnimationFrame(fadeAnimationFrame.current);
        fadeAnimationFrame.current = null;
      }
      if (delayTimer.current !== null) {
        window.clearTimeout(delayTimer.current);
        delayTimer.current = null;
      }
      return;
    }

    setCanShow(false);
    setIsVisible(false);
    delayTimer.current = window.setTimeout(() => {
      setCanShow(true);
      fadeAnimationFrame.current = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }, PROMPT_SIDEBAR_SLIDE_DURATION_MS);

    return () => {
      if (delayTimer.current !== null) {
        window.clearTimeout(delayTimer.current);
        delayTimer.current = null;
      }
      if (fadeAnimationFrame.current !== null) {
        window.cancelAnimationFrame(fadeAnimationFrame.current);
        fadeAnimationFrame.current = null;
      }
    };
  }, [isOpen]);

  if (isOpen || !canShow) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-5 right-9 z-50 opacity-0 transition-opacity duration-300",
        isVisible && "opacity-100",
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={onOpen}
        aria-label="Open prompt sidebar"
        className="pointer-events-auto shadow-md"
      >
        <PanelRight />
      </Button>
    </div>
  );
};

export function PromptSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  const [prompts, setPrompts] = useState<PromptItem[]>([
    {
      id: "1",
      title: "Goal",
      content: ["Stay alive"],
      isEditing: false
    },
    {
      id: "2",
      title: "Restriction",
      content: ["Be kind", "Be thoughtful", "Not awkward", "Not condescending", "..."],
      isEditing: false
    },
    {
      id: "3",
      title: "Length",
      content: [],
      isEditing: false
    },
    {
      id: "4",
      title: "Tone",
      content: [],
      isEditing: false
    }
  ]);

  const addPrompt = () => {
    const newPrompt: PromptItem = {
      id: Date.now().toString(),
      title: "New prompt",
      content: [],
      isEditing: false
    };
    setPrompts([...prompts, newPrompt]);
  };

  const deletePrompt = (id: string) => {
    setPrompts(prevPrompts => prevPrompts.filter(p => p.id !== id));
  };

  const updatePrompt = (id: string, data: { title: string; content: string[] }) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const sendAllPrompts = async () => {
    setPrompts(prompts.map(p => ({ ...p, isEditing: false })));

    let message = "";
    prompts.forEach((prompt, index) => {
      if (prompt.title) {
        message += prompt.title + "\n";
      }
      if (prompt.content.length > 0) {
        prompt.content.forEach(item => {
          message += "  - " + item + "\n";
        });
      }
      if (index < prompts.length - 1) {
        message += "\n";
      }
    });

    setIsSending(true);
    try {
      threadRuntime.composer.setText(message);
      await threadRuntime.composer.send();
    } finally {
      setIsSending(false);
    }
  };

  const updateEditingState = (id: string, isEditing: boolean) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, isEditing } : p));
  };

  useEffect(() => {
    const handleCollect = (event: Event) => {
      const detail = (event as CustomEvent<PromptCollectDetail>).detail;
      if (!detail || detail.content.length === 0) {
        return;
      }

      setPrompts(prevPrompts => [
        {
          id: `${detail.messageId}-${Date.now()}`,
          title: detail.title || "Collected prompt",
          content: detail.content,
          isEditing: false
        },
        ...prevPrompts,
      ]);
      setIsOpen(true);
    };

    window.addEventListener(PROMPT_COLLECT_EVENT, handleCollect);
    return () => {
      window.removeEventListener(PROMPT_COLLECT_EVENT, handleCollect);
    };
  }, []);

  return (
    <>
      <PromptSidebarExpandTrigger
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
      />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-80 border-l bg-background transition-transform duration-300",
          !isOpen && "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col px-4 pb-4 pt-2">
          <SidebarHeader className="flex items-center gap-2 px-0 pb-4">
            <SidebarMenu className="flex-row items-center gap-2">
              <SidebarMenuItem className="w-auto">
                <PromptSidebarTrigger onClick={() => setIsOpen(false)} />
              </SidebarMenuItem>
              <SidebarMenuItem className="w-auto">
                <SidebarMenuButton
                  asChild
                  size="lg"
                  className="w-auto justify-start px-0 font-semibold"
                >
                  <span className="rounded-md px-3 py-1 text-xl">Prompt Cards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                id={prompt.id}
                title={prompt.title}
                content={prompt.content}
                isEditing={prompt.isEditing}
                onDelete={deletePrompt}
                onUpdate={updatePrompt}
                onEditingChange={(isEditing) => updateEditingState(prompt.id, isEditing)}
              />
            ))}
          </div>

          <Button
            onClick={addPrompt}
            variant="outline"
            className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-3 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-200 dark:hover:bg-yellow-900/40"
          >
            <Plus className="size-6 text-yellow-600" />
          </Button>

          <Button
            onClick={sendAllPrompts}
            disabled={isSending}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-yellow-500 p-3 text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowLeft className="size-5" />
            )}
            <span>{isSending ? "Sending…" : "Send all prompts"}</span>
          </Button>
        </div>
      </div>
    </>
  );
}

