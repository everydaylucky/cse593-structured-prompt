"use client";

import { useState, useEffect } from "react";
import { X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(title);
      setEditContent(content.join("\n"));
    }
  }, [title, content, isEditing]);

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
      <button
        onClick={() => onDelete?.(id)}
        className="absolute top-2 right-2 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <X className="size-4" />
      </button>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm font-semibold"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            rows={5}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded bg-yellow-400 px-3 py-1 text-sm hover:bg-yellow-500"
            >
              Save
            </button>
            <button
              onClick={() => onEditingChange?.(false)}
              className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditingChange?.(true);
            }}
            className="absolute bottom-2 right-2 rounded p-1 hover:bg-yellow-200 dark:hover:bg-yellow-900"
          >
            <Pencil className="size-4 text-yellow-600" />
          </button>
        </div>
      )}
    </div>
  );
}

