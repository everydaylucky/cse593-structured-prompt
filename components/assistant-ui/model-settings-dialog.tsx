"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Save, X } from "lucide-react";
import { MODEL_REGISTRY, type ModelConfig } from "@/lib/models/registry";
import {
  getModelConfigOverride,
  saveModelConfigOverride,
  deleteModelConfigOverride,
  mergeModelConfig,
} from "@/lib/models/model-config-storage";
import { cn } from "@/lib/utils";

interface ModelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelSettingsDialog({
  open,
  onOpenChange,
}: ModelSettingsDialogProps) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [responseFormat, setResponseFormat] = useState<'text' | 'json_object' | undefined>(undefined);

  // 当选择模型时，加载配置
  useEffect(() => {
    if (!selectedModelId) return;

    const model = MODEL_REGISTRY.find((m) => m.id === selectedModelId);
    if (!model) return;

    const override = getModelConfigOverride(selectedModelId);
    const merged = mergeModelConfig(model.config, override);

    setTemperature(merged?.temperature ?? 0.7);
    setMaxTokens(merged?.maxTokens);
    setResponseFormat(merged?.responseFormat);
  }, [selectedModelId]);

  const handleSave = () => {
    if (!selectedModelId) return;

    const config: Partial<ModelConfig['config']> = {
      temperature,
      ...(maxTokens !== undefined && { maxTokens }),
      ...(responseFormat && { responseFormat }),
    };

    saveModelConfigOverride(selectedModelId, config);
    onOpenChange(false);
  };

  const handleReset = () => {
    if (!selectedModelId) return;
    deleteModelConfigOverride(selectedModelId);
    
    const model = MODEL_REGISTRY.find((m) => m.id === selectedModelId);
    if (model?.config) {
      setTemperature(model.config.temperature ?? 0.7);
      setMaxTokens(model.config.maxTokens);
      setResponseFormat(model.config.responseFormat);
    }
  };

  const selectedModel = selectedModelId
    ? MODEL_REGISTRY.find((m) => m.id === selectedModelId)
    : null;

  const openaiModels = MODEL_REGISTRY.filter((m) => m.provider === 'openai');
  const googleModels = MODEL_REGISTRY.filter((m) => m.provider === 'google');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Model Settings
          </DialogTitle>
          <DialogDescription>
            Configure temperature, max tokens, and other parameters for each model.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label>Select Model</Label>
            <Select
              value={selectedModelId || ""}
              onValueChange={setSelectedModelId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a model..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  OpenAI Models
                </div>
                {openaiModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.icon}</span>
                      <span>{model.displayName}</span>
                    </div>
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                  Google Gemini Models
                </div>
                {googleModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.icon}</span>
                      <span>{model.displayName}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedModel && (
            <>
              {/* Model Info */}
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-sm">
                  <div className="font-medium">{selectedModel.displayName}</div>
                  {selectedModel.description && (
                    <div className="text-muted-foreground text-xs mt-1">
                      {selectedModel.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-sm text-muted-foreground">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <Input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 (Deterministic)</span>
                  <span>1 (Balanced)</span>
                  <span>2 (Creative)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Controls randomness. Lower values make output more deterministic.
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="1"
                  max={selectedModel.provider === 'openai' ? 4096 : 8192}
                  value={maxTokens || ""}
                  onChange={(e) =>
                    setMaxTokens(
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  placeholder="Leave empty for default"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of tokens to generate. Leave empty to use model default.
                </p>
              </div>

              {/* Response Format (OpenAI only) */}
              {selectedModel.provider === 'openai' && (
                <div className="space-y-2">
                  <Label htmlFor="responseFormat">Response Format</Label>
                  <Select
                    value={responseFormat || "text"}
                    onValueChange={(value) =>
                      setResponseFormat(
                        value === "text" ? "text" : "json_object"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="json_object">JSON Object</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Force the model to generate output in a specific format.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleReset}>
                  Reset to Default
                </Button>
                <Button onClick={handleSave}>
                  <Save className="size-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

