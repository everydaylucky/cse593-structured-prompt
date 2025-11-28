"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getChunkingConfig,
  saveChunkingConfig,
} from "@/lib/chunking-config-storage";

export function ChunkingSettings() {
  const [config, setConfig] = useState(getChunkingConfig());

  useEffect(() => {
    setConfig(getChunkingConfig());
  }, []);

  const handleChange = (field: keyof typeof config, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    saveChunkingConfig(newConfig);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-3">Chunking Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure how documents are split into chunks for processing.
        </p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <Label htmlFor="chunkSizeTokens" className="text-base font-medium">Chunk Size (tokens)</Label>
          <Input
            id="chunkSizeTokens"
            type="number"
            min="512"
            max="1024"
            step="64"
            value={config.chunkSizeTokens}
            onChange={(e) => handleChange('chunkSizeTokens', parseInt(e.target.value, 10))}
            className="h-11"
          />
          <p className="text-sm text-muted-foreground">
            Recommended: 512-1024 tokens for academic papers. Current: {config.chunkSizeTokens} tokens
            (≈ {Math.round(config.chunkSizeTokens * 3)} characters for mixed content).
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="chunkOverlapRatio" className="text-base font-medium">Overlap Ratio</Label>
          <Input
            id="chunkOverlapRatio"
            type="number"
            min="0.15"
            max="0.20"
            step="0.01"
            value={config.chunkOverlapRatio}
            onChange={(e) => handleChange('chunkOverlapRatio', parseFloat(e.target.value))}
            className="h-11"
          />
          <p className="text-sm text-muted-foreground">
            Recommended: 15-20% overlap. Current: {(config.chunkOverlapRatio * 100).toFixed(1)}%
            (≈ {Math.round(config.chunkSizeTokens * config.chunkOverlapRatio)} tokens overlap).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label htmlFor="minChunkSizeTokens" className="text-base font-medium">Min Chunk Size (tokens)</Label>
            <Input
              id="minChunkSizeTokens"
              type="number"
              min="256"
              max="512"
              step="64"
              value={config.minChunkSizeTokens}
              onChange={(e) => handleChange('minChunkSizeTokens', parseInt(e.target.value, 10))}
              className="h-11"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="maxChunkSizeTokens" className="text-base font-medium">Max Chunk Size (tokens)</Label>
            <Input
              id="maxChunkSizeTokens"
              type="number"
              min="768"
              max="1536"
              step="64"
              value={config.maxChunkSizeTokens}
              onChange={(e) => handleChange('maxChunkSizeTokens', parseInt(e.target.value, 10))}
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-5 p-6 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="preserveSentences" className="text-base font-medium">Preserve Sentence Integrity</Label>
              <p className="text-sm text-muted-foreground">
                Avoid splitting chunks in the middle of sentences
              </p>
            </div>
            <Switch
              id="preserveSentences"
              checked={config.preserveSentences}
              onCheckedChange={(checked) => handleChange('preserveSentences', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="preserveSections" className="text-base font-medium">Preserve Section Boundaries</Label>
              <p className="text-sm text-muted-foreground">
                Prioritize section boundaries when splitting chunks
              </p>
            </div>
            <Switch
              id="preserveSections"
              checked={config.preserveSections}
              onCheckedChange={(checked) => handleChange('preserveSections', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

