"use client";

import { FileText } from "lucide-react";
import { FileVectorIndex } from "@/lib/vector-storage";
import { cn } from "@/lib/utils";

interface DocumentCitationProps {
  documents: FileVectorIndex[];
  className?: string;
}

export function DocumentCitation({
  documents,
  className,
}: DocumentCitationProps) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs",
        className
      )}
    >
      <span className="text-muted-foreground">Cited:</span>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border"
        >
          <FileText className="size-3 text-muted-foreground" />
          <span className="font-medium truncate max-w-[120px]">
            {doc.fileName}
          </span>
        </div>
      ))}
    </div>
  );
}

