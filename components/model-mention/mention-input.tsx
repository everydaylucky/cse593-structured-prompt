"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MentionPopover } from "./mention-popover";
import { MentionTag } from "./mention-tag";
import { searchModels, type ModelConfig } from "@/lib/models/registry";
import { shouldShowModelPopover, parseModelFromMessage } from "@/lib/models/message-parser";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onModelSelect?: (modelId: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onModelSelect,
  placeholder = "Send a message... @ to mention a model",
  className = "",
}: MentionInputProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 检测是否应该显示弹出框（只有消息开头才触发）
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);
    setCursorPosition(cursorPos);

    // 使用解析器检查是否应该显示弹出框
    const { show, query } = shouldShowModelPopover(newValue, cursorPos);
    
    if (show) {
      setShowPopover(true);
      setSearchQuery(query);
    } else {
      setShowPopover(false);
    }
  };

  // 处理模型选择
  const handleModelSelect = useCallback((model: ModelConfig) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const trimmedBefore = textBeforeCursor.trimStart();
    
    // 找到 @ 的位置（考虑前导空格）
    const atIndex = trimmedBefore.indexOf('@');
    if (atIndex === -1) return;
    
    // 计算实际位置（考虑前导空格）
    const actualAtIndex = textBeforeCursor.length - trimmedBefore.length + atIndex;
    const textAfterCursor = value.substring(cursorPosition);
    
    // 找到 @ 后第一个空格的位置
    const afterAt = trimmedBefore.substring(atIndex + 1);
    const spaceIndex = afterAt.search(/[\s\n]/);
    const mentionEnd = spaceIndex === -1 
      ? cursorPosition 
      : actualAtIndex + 1 + spaceIndex + 1;
    
    // 替换 @query 为 @model-id
    const newValue = 
      value.substring(0, actualAtIndex) + 
      `@${model.id} ` + 
      value.substring(mentionEnd);
    
    onChange(newValue);
    setSelectedModel(model);
    setShowPopover(false);
    onModelSelect?.(model.id);
    
    // 聚焦输入框并设置光标位置
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = actualAtIndex + model.id.length + 2; // @ + modelId + space
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, cursorPosition, onChange, onModelSelect]);

  // 解析消息中的模型（用于显示当前选择的模型）
  useEffect(() => {
    const parsed = parseModelFromMessage(value);
    setSelectedModel(parsed.hasModelMention ? parsed.model : null);
    onModelSelect?.(parsed.hasModelMention ? parsed.model.id : null);
  }, [value, onModelSelect]);

  // 点击外部关闭弹出框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPopover]);

  const filteredModels = searchModels(searchQuery);

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          // ESC 键关闭弹出框
          if (e.key === 'Escape' && showPopover) {
            setShowPopover(false);
            e.preventDefault();
          }
          // Enter 键选择第一个模型
          if (e.key === 'Enter' && showPopover && filteredModels.length > 0 && !e.shiftKey) {
            handleModelSelect(filteredModels[0]);
            e.preventDefault();
          }
        }}
        placeholder={placeholder}
        className="w-full min-h-[60px] resize-none rounded-lg border p-3"
      />
      
      {selectedModel && (
        <div className="absolute top-2 right-2">
          <MentionTag model={selectedModel} />
        </div>
      )}

      {showPopover && (
        <MentionPopover
          ref={popoverRef}
          models={filteredModels}
          onSelect={handleModelSelect}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}

