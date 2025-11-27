"use client";

import { ModelConfig } from "@/lib/models/registry";

interface MentionTagProps {
  model: ModelConfig;
}

export function MentionTag({ model }: MentionTagProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent text-accent-foreground text-xs">
      <span>{model.icon || '🤖'}</span>
      <span className="font-medium">{model.displayName}</span>
    </div>
  );
}

