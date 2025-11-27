"use client";

import { X } from "lucide-react";
import { FileVectorIndex } from "@/lib/vector-storage";

interface DocumentTagProps {
  document: FileVectorIndex;
  onRemove?: () => void;
  showRemove?: boolean;
}

export function DocumentTag({
  document,
  onRemove,
  showRemove = false,
}: DocumentTagProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent text-accent-foreground text-xs">
      <span>📄</span>
      <span className="font-medium truncate max-w-[120px]">
        {document.fileName}
      </span>
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

