"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDocumentProcessingConfig,
  saveDocumentProcessingConfig,
} from "@/lib/document-processing-config-storage";
import {
  getSummaryPrompt,
  saveSummaryPrompt,
  resetSummaryPrompt,
} from "@/lib/summary-prompt-config-storage";
import { MODEL_REGISTRY } from "@/lib/models/registry";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function ModelSettings() {
  const [config, setConfig] = useState(getDocumentProcessingConfig());
  const [summaryPrompt, setSummaryPrompt] = useState(getSummaryPrompt());

  useEffect(() => {
    setConfig(getDocumentProcessingConfig());
    setSummaryPrompt(getSummaryPrompt());
  }, []);

  const handleChange = (field: keyof typeof config, value: string) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    saveDocumentProcessingConfig(newConfig);
  };

  const handlePromptChange = (value: string) => {
    setSummaryPrompt(value);
    saveSummaryPrompt(value);
  };

  const handleResetPrompt = () => {
    resetSummaryPrompt();
    setSummaryPrompt(getSummaryPrompt());
  };

  // 获取可用的模型列表（用于文档处理）
  const availableModels = Object.values(MODEL_REGISTRY).filter(
    (model) => model.provider === 'openai' || model.provider === 'google'
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-3">Document Processing Models</h2>
        <p className="text-sm text-muted-foreground">
          Select which models to use for different document processing tasks.
        </p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <Label htmlFor="summaryModel" className="text-base font-medium">Summary Generation Model</Label>
          <Select
            value={config.summaryModel}
            onValueChange={(value) => handleChange('summaryModel', value)}
          >
            <SelectTrigger id="summaryModel" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[600px]">
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="w-full">
                  <div className="flex flex-col min-w-0 w-full gap-1 pr-2">
                    <span className="font-medium break-words">{model.displayName}</span>
                    <span className="text-xs text-muted-foreground break-words leading-relaxed">
                      {model.description || ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2 break-words leading-relaxed px-1">
            Model used to generate detailed, comprehensive document summaries.
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="tocModel" className="text-base font-medium">Table of Contents Extraction Model</Label>
          <Select
            value={config.tocModel}
            onValueChange={(value) => handleChange('tocModel', value)}
          >
            <SelectTrigger id="tocModel" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[600px]">
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="w-full">
                  <div className="flex flex-col min-w-0 w-full gap-1 pr-2">
                    <span className="font-medium break-words">{model.displayName}</span>
                    <span className="text-xs text-muted-foreground break-words leading-relaxed">
                      {model.description || ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2 break-words leading-relaxed px-1">
            Model used to extract document structure and table of contents.
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="keywordsModel" className="text-base font-medium">Keywords Extraction Model</Label>
          <Select
            value={config.keywordsModel}
            onValueChange={(value) => handleChange('keywordsModel', value)}
          >
            <SelectTrigger id="keywordsModel" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[600px]">
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="w-full">
                  <div className="flex flex-col min-w-0 w-full gap-1 pr-2">
                    <span className="font-medium break-words">{model.displayName}</span>
                    <span className="text-xs text-muted-foreground break-words leading-relaxed">
                      {model.description || ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2 break-words leading-relaxed px-1">
            Model used to extract keywords, topics, and key phrases from documents.
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="queryEnhancementModel" className="text-base font-medium">Query Enhancement Model</Label>
          <Select
            value={config.queryEnhancementModel}
            onValueChange={(value) => handleChange('queryEnhancementModel', value)}
          >
            <SelectTrigger id="queryEnhancementModel" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[600px]">
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="w-full">
                  <div className="flex flex-col min-w-0 w-full gap-1 pr-2">
                    <span className="font-medium break-words">{model.displayName}</span>
                    <span className="text-xs text-muted-foreground break-words leading-relaxed">
                      {model.description || ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2 break-words leading-relaxed px-1">
            Model used to enhance user queries for better document retrieval.
          </p>
        </div>

        <div className="space-y-4 pt-6 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="summaryPrompt" className="text-base font-medium">Summary Generation Prompt</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetPrompt}
              className="h-8"
            >
              <RotateCcw className="size-4 mr-1" />
              Reset
            </Button>
          </div>
          <Textarea
            id="summaryPrompt"
            value={summaryPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            className="min-h-[350px] font-mono text-sm leading-relaxed"
            placeholder="Enter custom prompt for summary generation..."
          />
          <p className="text-sm text-muted-foreground break-words leading-relaxed px-1">
            Customize the system prompt used for generating document summaries. 
            The prompt should request JSON output with "title", "summary", "keywords", "topics", and "keyPhrases" fields.
          </p>
        </div>
      </div>
    </div>
  );
}

