"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragHandleProps {
  className?: string;
}

export function DragHandle({ className }: DragHandleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center cursor-grab active:cursor-grabbing",
        "text-muted-foreground hover:text-foreground transition-colors",
        "opacity-0 group-hover:opacity-100",
        className
      )}
    >
      <GripVertical className="size-4" />
    </div>
  );
}

