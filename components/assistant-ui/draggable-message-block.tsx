"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DragHandle } from "./drag-handle";
import type { FC, ReactNode } from "react";

interface DraggableMessageBlockProps {
  id: string;
  children: ReactNode;
  className?: string;
  role?: "user" | "assistant";
}

export const DraggableMessageBlock: FC<DraggableMessageBlockProps> = ({
  id,
  children,
  className,
  role,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `message-${id}`,
    data: {
      type: "message",
      messageId: id,
      role,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    ...(isDragging && {
      visibility: "hidden" as const,
    }),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        isDragging && "z-[9999]",
        className
      )}
      data-message-id={id}
    >
      <div className="flex items-start gap-2 w-full">
        <div
          {...attributes}
          {...listeners}
          className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <DragHandle />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
};

