"use client";

import { useState, useEffect } from "react";
import { FileText, Search, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDocumentRAGModeConfig,
  saveDocumentRAGModeConfig,
  type DocumentRAGMode,
} from "@/lib/document-rag-mode-storage";

export function RAGSettings() {
  const [config, setConfig] = useState(getDocumentRAGModeConfig());

  useEffect(() => {
    setConfig(getDocumentRAGModeConfig());
  }, []);

  const handleModeChange = (mode: DocumentRAGMode) => {
    const newConfig = { ...config, mode };
    setConfig(newConfig);
    saveDocumentRAGModeConfig(newConfig);
  };

  const handleThresholdChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1000) return;

    const newConfig = {
      ...config,
      smartThreshold: {
        maxTextLength: numValue,
      },
    };
    setConfig(newConfig);
    saveDocumentRAGModeConfig(newConfig);
  };

  const getPageEstimate = (textLength: number): string => {
    const pages = Math.round(textLength / 2500);
    if (pages < 1) return '< 1 page';
    if (pages === 1) return '~1 page';
    return `~${pages} pages`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-3">RAG Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure how documents are processed when referenced in chat.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-medium">Reference Mode</Label>
          <Select value={config.mode} onValueChange={handleModeChange}>
            <SelectTrigger className="text-left [&>span]:text-left [&>span]:justify-start h-11">
              <SelectValue className="text-left" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-text" className="text-left">
                <div className="flex items-center gap-2 text-left">
                  <FileText className="size-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium text-left">Full Text</div>
                    <div className="text-xs text-muted-foreground text-left">
                      Send entire document content
                    </div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="rag" className="text-left">
                <div className="flex items-center gap-2 text-left">
                  <Search className="size-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium text-left">RAG Mode</div>
                    <div className="text-xs text-muted-foreground text-left">
                      Search and retrieve relevant sections only
                    </div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="smart" className="text-left">
                <div className="flex items-center gap-2 text-left">
                  <Sparkles className="size-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium text-left">Smart Mode</div>
                    <div className="text-xs text-muted-foreground text-left">
                      Auto-select based on document size
                    </div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.mode === 'smart' && (
          <div className="space-y-4 p-6 border rounded-lg bg-muted/50">
            <div className="space-y-3">
              <Label htmlFor="maxTextLength" className="text-base font-semibold">
                Document Size Threshold
              </Label>
              <Input
                id="maxTextLength"
                type="number"
                min="1000"
                step="1000"
                value={config.smartThreshold?.maxTextLength || 50000}
                onChange={(e) => handleThresholdChange(e.target.value)}
                className="text-base h-11"
              />
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Current setting: <span className="font-medium text-foreground">
                    {config.smartThreshold?.maxTextLength?.toLocaleString() || 50000}
                  </span> characters ({getPageEstimate(config.smartThreshold?.maxTextLength || 50000)})
                </p>
                <p className="pt-2 border-t">
                  <span className="font-medium">Reference values:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>1 page ≈ 2,500 characters</li>
                  <li>10 pages ≈ 25,000 characters</li>
                  <li>20 pages ≈ 50,000 characters</li>
                  <li>50 pages ≈ 125,000 characters</li>
                </ul>
                <p className="pt-2 text-sm">
                  Documents larger than this threshold will automatically use RAG mode (retrieve relevant sections only),
                  while smaller documents will use full-text mode (send complete content).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

