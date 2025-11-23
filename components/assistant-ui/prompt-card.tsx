"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { X, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PromptCardProps {
  id: string;
  title: string;
  content?: string[];
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: { title: string; content: string[] }) => void;
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
}

export function PromptCard({ id, title, content = [], onDelete, onUpdate, isEditing = false, onEditingChange }: PromptCardProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(content.join("\n"));
  const [isSummarizing, setIsSummarizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(title);
      setEditContent(content.join("\n"));
    }
  }, [title, content, isEditing]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editContent, isEditing]);

  const normalizeContent = (text: string) =>
    text
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  const handleSummarize = async () => {
    const sourceContent = isEditing ? normalizeContent(editContent) : content;
    if (sourceContent.length === 0 || isSummarizing) return;

    setIsSummarizing(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: isEditing ? editTitle : title,
          content: sourceContent
        })
      });

      if (!response.ok) {
        throw new Error(`Summarize request failed with ${response.status}`);
      }

      const { summary } = await response.json() as { summary?: string };
      if (!summary) return;

      const summaryLines = normalizeContent(summary);
      if (summaryLines.length === 0) return;

      const nextTitle = isEditing ? editTitle : title;
      onUpdate?.(id, { title: nextTitle, content: summaryLines });
      setEditContent(summaryLines.join("\n"));
    } catch (error) {
      console.error("Failed to summarize prompt card:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const renderSummarizeButton = (className?: string) => {
    const hasContent = isEditing ? normalizeContent(editContent).length > 0 : content.length > 0;
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={(e) => {
          e.stopPropagation();
          handleSummarize();
        }}
        disabled={isSummarizing || !hasContent}
        className={cn(
          "h-auto bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-900 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-yellow-900/30 dark:text-yellow-200 dark:hover:bg-yellow-900/50",
          className,
        )}
      >
        {isSummarizing ? <Loader2 className="size-4 animate-spin" /> : "Summarize"}
      </Button>
    );
  };

  const handleSave = () => {
    onUpdate?.(id, {
      title: editTitle,
      content: editContent.split("\n").filter(line => line.trim())
    });
    onEditingChange?.(false);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    const start = text.slice(0, 60);
    const end = text.slice(-20);
    return `${start}...${end}`;
  };

  return (
    <div className={cn(
      "relative rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-4",
      "dark:bg-yellow-950/20 dark:border-yellow-600"
    )}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete?.(id)}
        className="absolute top-2 right-2 z-10 size-7 rounded-full hover:bg-gray-200 dark:bg-background dark:hover:bg-gray-700"
      >
        <X className="size-4" />
      </Button>

      {isEditing ? (
        <div className="space-y-2">
          <Input
            value={editTitle}
            placeholder="Untitled Prompt"
            onChange={(e) => setEditTitle(e.target.value)}
            className="text-sm font-semibold"
          />
          <Textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={1}
            className="text-sm resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {renderSummarizeButton()}
            <Button
              type="button"
              onClick={handleSave}
              className="h-auto rounded bg-yellow-400 px-3 py-1 text-sm text-yellow-950 hover:bg-yellow-500"
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onEditingChange?.(false)}
              className="h-auto rounded bg-gray-200 px-3 py-1 text-sm text-gray-900 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div onClick={() => onEditingChange?.(true)} className="cursor-pointer">
            <h3 className="mb-2 pr-6 font-semibold line-clamp-2">{truncateText(title, 80)}</h3>
            {content.length > 0 && (
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {content.slice(0, 5).map((item, idx) => (
                  <li key={idx} className="line-clamp-1">• {truncateText(item, 60)}</li>
                ))}
                {content.length > 5 && (
                  <li className="text-xs italic opacity-60">...and {content.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            {renderSummarizeButton("px-3")}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEditingChange?.(true);
              }}
              className="size-8 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900"
            >
              <Pencil className="size-4 text-yellow-600" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

