"use client";

import { forwardRef } from "react";
import { ModelConfig } from "@/lib/models/registry";

interface MentionPopoverProps {
  models: ModelConfig[];
  onSelect: (model: ModelConfig) => void;
  onClose: () => void;
}

export const MentionPopover = forwardRef<HTMLDivElement, MentionPopoverProps>(
  ({ models, onSelect, onClose }, ref) => {
    if (models.length === 0) {
      return (
        <div
          ref={ref}
          className="absolute z-50 mt-1 w-64 rounded-lg border bg-background shadow-lg p-2"
        >
          <div className="p-2 text-sm text-muted-foreground">
            No models found
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="absolute z-50 mt-1 w-64 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg"
      >
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => onSelect(model)}
            className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded text-left transition-colors"
          >
            <span className="text-lg shrink-0">{model.icon || '🤖'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{model.displayName}</div>
              {model.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {model.description}
                </div>
              )}
            </div>
            {model.default && (
              <span className="text-xs text-muted-foreground shrink-0">Default</span>
            )}
          </button>
        ))}
      </div>
    );
  }
);

MentionPopover.displayName = "MentionPopover";

