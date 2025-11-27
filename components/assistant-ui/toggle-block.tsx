"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronRight, Pencil, X, Eye, EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ToggleBlockProps {
  id: string;
  title: string;
  content: string[];
  isExpanded: boolean;
  isIncluded: boolean;
  isEditing?: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdate: (id: string, data: { title: string; content: string[] }) => void;
  onDelete: (id: string) => void;
  onIncludeChange: (id: string, isIncluded: boolean) => void;
  onEditingChange?: (id: string, isEditing: boolean) => void;
  dragHandle?: boolean;
}

export function ToggleBlock({
  id,
  title,
  content,
  isExpanded,
  isIncluded,
  isEditing = false,
  onToggle,
  onEdit,
  onUpdate,
  onDelete,
  onIncludeChange,
  onEditingChange,
  dragHandle = false,
}: ToggleBlockProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(content.join("\n"));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `prompt-${id}`, disabled: !dragHandle });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(title);
      setEditContent(content.join("\n"));
    }
  }, [title, content, isEditing]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isEditing) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.style.overflowY = "hidden";
  }, [editContent, isEditing]);

  const handleSave = () => {
    const normalizedContent = editContent
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);
    
    onUpdate(id, {
      title: editTitle.trim() || "Untitled",
      content: normalizedContent,
    });
    onEditingChange?.(id, false);
  };

  const handleCancel = () => {
    setEditTitle(title);
    setEditContent(content.join("\n"));
    onEditingChange?.(id, false);
  };

  const normalizeContent = (text: string) =>
    text.split("\n").map(line => line.trim()).filter(Boolean);

  if (isEditing) {
    return (
      <div
        ref={dragHandle ? setNodeRef : undefined}
        style={dragHandle ? style : undefined}
        className="group relative rounded-lg border border-border bg-background p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="space-y-2">
          <Input
            value={editTitle}
            placeholder="Untitled"
            onChange={(e) => setEditTitle(e.target.value)}
            className="text-sm font-semibold"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            autoFocus
          />
          <Textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={1}
            className="text-sm resize-none overflow-hidden min-h-0"
            placeholder="Add content..."
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleCancel();
              }
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dragHandle ? setNodeRef : undefined}
      style={dragHandle ? style : undefined}
      className={cn(
        "group relative rounded-lg border border-border bg-background transition-colors",
        "hover:bg-muted/50",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2 p-3">
        {dragHandle && (
          <div
            {...attributes}
            {...listeners}
            className="mt-1 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="size-4" />
          </div>
        )}
        
        <button
          onClick={() => onToggle(id)}
          className="mt-0.5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div
            onClick={() => onEdit(id)}
            className="cursor-text hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
          >
            <h3 className="text-sm font-semibold mb-1">{title || "Untitled"}</h3>
          </div>

          {isExpanded && (
            <div className="mt-2 space-y-1">
              {content.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No content</p>
              ) : (
                <ul className="space-y-1 text-sm text-foreground">
                  {content.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span className="flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onIncludeChange(id, !isIncluded)}
            title={isIncluded ? "Exclude" : "Include"}
          >
            {isIncluded ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onEdit(id)}
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </Button>
          {!isIncluded && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(id)}
              title="Delete"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

