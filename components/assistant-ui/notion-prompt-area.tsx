"use client";

import { useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToggleBlock } from "./toggle-block";
import type { PromptItem } from "@/lib/prompt-storage";

interface NotionPromptAreaProps {
  prompts: PromptItem[];
  onAddPrompt: () => void;
  onUpdatePrompt: (id: string, data: { title: string; content: string[] }) => void;
  onDeletePrompt: (id: string) => void;
  onTogglePrompt: (id: string) => void;
  onEditPrompt: (id: string) => void;
  onIncludeChange: (id: string, isIncluded: boolean) => void;
  onEditingChange?: (id: string, isEditing: boolean) => void;
  onReorder?: (oldIndex: number, newIndex: number) => void;
  onDropMessage?: (messageId: string, messageContent: string, role: "user" | "assistant") => void;
}

export function NotionPromptArea({
  prompts,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onTogglePrompt,
  onEditPrompt,
  onIncludeChange,
  onEditingChange,
  onReorder,
  onDropMessage,
}: NotionPromptAreaProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  const { setNodeRef, isOver } = useDroppable({
    id: "prompt-area",
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    onTogglePrompt(id);
  }, [onTogglePrompt]);

  const handleEdit = useCallback((id: string) => {
    setEditingIds((prev) => new Set(prev).add(id));
    onEditPrompt(id);
  }, [onEditPrompt]);

  const handleEditingChange = useCallback((id: string, isEditing: boolean) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (isEditing) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    onEditingChange?.(id, isEditing);
  }, [onEditingChange]);


  return (
      <div
        ref={setNodeRef}
        className={cn(
          "space-y-2 p-4 rounded-lg border-2 border-dashed transition-colors",
          isOver
            ? "border-primary bg-primary/5"
            : "border-transparent bg-muted/30"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Structured Prompts
          </h3>
          <Button
            onClick={onAddPrompt}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
          >
            <Plus className="size-3 mr-1" />
            Add Block
          </Button>
        </div>

        <SortableContext
          items={prompts.map((p) => `prompt-${p.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <ToggleBlock
                key={prompt.id}
                id={prompt.id}
                title={prompt.title}
                content={prompt.content}
                isExpanded={expandedIds.has(prompt.id)}
                isIncluded={prompt.isIncluded}
                isEditing={editingIds.has(prompt.id)}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onUpdate={onUpdatePrompt}
                onDelete={onDeletePrompt}
                onIncludeChange={onIncludeChange}
                onEditingChange={handleEditingChange}
                dragHandle={true}
              />
            ))}
          </div>
        </SortableContext>

        {prompts.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>No prompts yet. Drag a message here or click "Add Block" to get started.</p>
          </div>
        )}
      </div>
  );
}

