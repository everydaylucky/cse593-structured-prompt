"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FC } from "react";

interface DragMessagePreviewProps {
  messageId: string;
  role: "user" | "assistant";
  content: string;
}

export const DragMessagePreview: FC<DragMessagePreviewProps> = ({
  messageId,
  role,
  content,
}) => {
  // 截取前 80 个字符作为预览，淡化显示
  const previewText = content.length > 80 
    ? content.substring(0, 80) + "..." 
    : content;

  return (
    <div
      className={cn(
        "flex items-start gap-2 max-w-[20rem] rounded-lg border bg-background/90 backdrop-blur-sm shadow-xl p-2.5",
        role === "user" ? "bg-muted/90" : "bg-background/90"
      )}
      style={{ 
        pointerEvents: "none",
        transform: "translate(-8px, -8px)", // 偏移，使六个点对齐鼠标位置
      }}
    >
      <div className="mt-0.5 shrink-0 opacity-100">
        <div className="flex items-center justify-center cursor-grab text-foreground/80">
          <GripVertical className="size-4" />
        </div>
      </div>
      <div className="flex-1 min-w-0 max-w-[16rem]">
        <div
          className={cn(
            "text-xs line-clamp-2 opacity-60",
            role === "user" 
              ? "text-foreground/50" 
              : "text-foreground/50"
          )}
        >
          {previewText || (role === "user" ? "User message" : "Assistant message")}
        </div>
      </div>
    </div>
  );
};

