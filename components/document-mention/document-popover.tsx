"use client";

import { forwardRef } from "react";
import { FileVectorIndex } from "@/lib/vector-storage";

interface DocumentPopoverProps {
  documents: FileVectorIndex[];
  onSelect: (document: FileVectorIndex) => void;
  onClose: () => void;
}

export const DocumentPopover = forwardRef<HTMLDivElement, DocumentPopoverProps>(
  ({ documents, onSelect, onClose }, ref) => {
    if (documents.length === 0) {
      return (
        <div
          ref={ref}
          className="absolute z-50 mt-1 w-64 rounded-lg border bg-background shadow-lg p-2"
        >
          <div className="p-2 text-sm text-muted-foreground">
            No documents found
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="absolute z-50 mt-1 w-64 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg"
      >
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelect(doc)}
            className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded text-left transition-colors"
          >
            <span className="text-lg shrink-0">📄</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{doc.fileName}</div>
              <div className="text-xs text-muted-foreground">
                {doc.pageCount} pages • {doc.chunkCount} chunks
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

DocumentPopover.displayName = "DocumentPopover";

