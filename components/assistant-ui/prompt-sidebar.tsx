"use client";

import { useState, useEffect } from "react";
import { Plus, PanelRightClose, PanelRight, ArrowLeft, Loader2 } from "lucide-react";
import { PromptCard } from "./prompt-card";
import { cn } from "@/lib/utils";
import { useAssistantApi } from "@assistant-ui/react";
import { Button } from "../ui/button";
import { PROMPT_COLLECT_EVENT, type PromptCollectDetail } from "@/lib/prompt-collector";

interface PromptItem {
  id: string;
  title: string;
  content: string[];
  isEditing?: boolean;
}

export function PromptSidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const toggleIconClass = "size-5";
  let api = useAssistantApi();
  const threadRuntime = api.thread();
  const [prompts, setPrompts] = useState<PromptItem[]>([
    {
      id: "1",
      title: "Scenario: ...",
      content: [],
      isEditing: false
    },
    {
      id: "2",
      title: "Be high EQ",
      content: [],
      isEditing: false
    },
    {
      id: "3",
      title: 'Avoid "layoff"',
      content: [],
      isEditing: false
    },
    {
      id: "4",
      title: "",
      content: ["Be kind", "Be thoughtful", "Not awkward", "Not condescending", "..."],
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
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-20 right-4 z-50 rounded-full bg-yellow-400 p-2 shadow-lg hover:bg-yellow-500",
          isOpen && "right-[320px]"
        )}
      >
        {isOpen ? <PanelRightClose className={toggleIconClass} /> : <PanelRight className={toggleIconClass} />}
      </Button>

      {isOpen && (
        <Button
          onClick={sendAllPrompts}
          disabled={isSending}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-50 rounded-full bg-yellow-400 p-3 shadow-lg hover:bg-yellow-500 transition-all",
            "right-[320px]",
            isSending && "opacity-50 cursor-not-allowed"
          )}
          title="Send all prompts"
        >
          {isSending ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ArrowLeft className="size-6" />
          )}
        </Button>
      )}

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-80 border-l bg-background transition-transform duration-300",
          !isOpen && "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-4">
          <h2 className="mb-4 text-lg font-semibold">Prompt Cards</h2>
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
        </div>
      </div>
    </>
  );
}

