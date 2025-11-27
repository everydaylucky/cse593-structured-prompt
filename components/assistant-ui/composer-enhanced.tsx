"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ComposerPrimitive, useAssistantApi } from "@assistant-ui/react";
import { MentionPopover } from "@/components/model-mention/mention-popover";
import { MentionTag } from "@/components/model-mention/mention-tag";
import { DocumentPopover } from "@/components/document-mention/document-popover";
import { DocumentTag } from "@/components/document-mention/document-tag";
import { searchModels, type ModelConfig } from "@/lib/models/registry";
import {
  shouldShowModelPopover,
  parseModelFromMessage,
} from "@/lib/models/message-parser";
import {
  shouldShowDocumentPopover,
  parseDocumentsFromMessage,
} from "@/lib/document-parser";
import { getFilesByThreadId, type FileVectorIndex } from "@/lib/vector-storage";
import { getCurrentThreadId } from "@/lib/thread-storage";

export function ComposerEnhanced() {
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [showDocumentPopover, setShowDocumentPopover] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<FileVectorIndex[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<FileVectorIndex[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const documentPopoverRef = useRef<HTMLDivElement>(null);

  // 加载可用文档
  useEffect(() => {
    const loadDocuments = async () => {
      const threadId = getCurrentThreadId();
      if (!threadId) {
        setAvailableDocuments([]);
        return;
      }

      try {
        const files = await getFilesByThreadId(threadId);
        setAvailableDocuments(files);
      } catch (error) {
        console.error("Failed to load documents:", error);
        setAvailableDocuments([]);
      }
    };

    loadDocuments();

    const handleFilesUpdated = () => {
      loadDocuments();
    };

    window.addEventListener("files-updated", handleFilesUpdated);
    return () => {
      window.removeEventListener("files-updated", handleFilesUpdated);
    };
  }, []);

  // 检测输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    // 先检查文档选择器（优先级更高，因为可以在 @mention 后使用）
    const docCheck = shouldShowDocumentPopover(newValue, cursorPos);
    if (docCheck.show) {
      setShowDocumentPopover(true);
      setShowModelPopover(false);
      // 提取搜索查询（去除 # 符号）
      const query = docCheck.query.trim();
      setDocumentSearchQuery(query);
    } else {
      setShowDocumentPopover(false);
      
      // 只有在文档选择器不显示时才检查模型选择器
      const modelCheck = shouldShowModelPopover(newValue, cursorPos);
      if (modelCheck.show) {
        setShowModelPopover(true);
        setModelSearchQuery(modelCheck.query);
      } else {
        setShowModelPopover(false);
      }
    }

    // 解析消息中的模型和文档
    const modelParsed = parseModelFromMessage(newValue);
    setSelectedModel(modelParsed.hasModelMention ? modelParsed.model : null);

    const docParsed = parseDocumentsFromMessage(newValue);
    if (docParsed.hasDocumentMention) {
      const foundDocs = docParsed.documents
        .map((doc) => availableDocuments.find((d) => d.id === doc.fileId))
        .filter((d): d is FileVectorIndex => d !== undefined);
      setSelectedDocuments(foundDocs);
    } else {
      setSelectedDocuments([]);
    }
  };

  // 处理模型选择
  const handleModelSelect = useCallback(
    (model: ModelConfig) => {
      const currentValue = inputRef.current?.value || "";
      const textBeforeCursor = currentValue.substring(0, cursorPosition);
      const trimmedBefore = textBeforeCursor.trimStart();

      const atIndex = trimmedBefore.indexOf("@");
      if (atIndex === -1) return;

      const actualAtIndex =
        textBeforeCursor.length - trimmedBefore.length + atIndex;
      const textAfterCursor = currentValue.substring(cursorPosition);

      const afterAt = trimmedBefore.substring(atIndex + 1);
      const spaceIndex = afterAt.search(/[\s\n]/);
      const mentionEnd =
        spaceIndex === -1
          ? cursorPosition
          : actualAtIndex + 1 + spaceIndex + 1;

      const newValue =
        currentValue.substring(0, actualAtIndex) +
        `@${model.id} ` +
        currentValue.substring(mentionEnd);

      threadRuntime.composer.setText(newValue);
      setSelectedModel(model);
      setShowModelPopover(false);

      setTimeout(() => {
        inputRef.current?.focus();
        const newCursorPos = actualAtIndex + model.id.length + 2;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [threadRuntime.composer, cursorPosition]
  );

  // 处理文档选择
  const handleDocumentSelect = useCallback(
    (document: FileVectorIndex) => {
      const currentValue = inputRef.current?.value || "";
      const textBeforeCursor = currentValue.substring(0, cursorPosition);
      const trimmedBefore = textBeforeCursor.trimStart();

      const hashIndex = trimmedBefore.indexOf("#");
      if (hashIndex === -1) return;

      const actualHashIndex =
        textBeforeCursor.length - trimmedBefore.length + hashIndex;
      const textAfterCursor = currentValue.substring(cursorPosition);

      const afterHash = trimmedBefore.substring(hashIndex + 1);
      const spaceIndex = afterHash.search(/[\s\n]/);
      const mentionEnd =
        spaceIndex === -1
          ? cursorPosition
          : actualHashIndex + 1 + spaceIndex + 1;

      // 使用文件名作为显示，但实际存储 file-id
      // 格式：#文件名(file-id)
      const sanitizedFileName = document.fileName.replace(/[()]/g, '').trim();
      const newValue =
        currentValue.substring(0, actualHashIndex) +
        `#${sanitizedFileName}(${document.id}) ` +
        currentValue.substring(mentionEnd);

      threadRuntime.composer.setText(newValue);
      setShowDocumentPopover(false);

      if (!selectedDocuments.find((d) => d.id === document.id)) {
        setSelectedDocuments((prev) => [...prev, document]);
      }

      setTimeout(() => {
        inputRef.current?.focus();
        const sanitizedFileName = document.fileName.replace(/[()]/g, '').trim();
        const newCursorPos = actualHashIndex + sanitizedFileName.length + document.id.length + 4; // # + fileName + ( + id + )
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [threadRuntime.composer, cursorPosition, selectedDocuments]
  );

  // 解析消息中的模型和文档（在 handleInputChange 中处理，避免重复监听）

  // 点击外部关闭弹出框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideModelPopover =
        modelPopoverRef.current &&
        !modelPopoverRef.current.contains(target);
      const isOutsideDocumentPopover =
        documentPopoverRef.current &&
        !documentPopoverRef.current.contains(target);
      const isOutsideInput =
        inputRef.current && !inputRef.current.contains(target);

      if (isOutsideModelPopover && isOutsideInput) {
        setShowModelPopover(false);
      }
      if (isOutsideDocumentPopover && isOutsideInput) {
        setShowDocumentPopover(false);
      }
    };

    if (showModelPopover || showDocumentPopover) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModelPopover, showDocumentPopover]);

  const filteredModels = searchModels(modelSearchQuery);
  // 根据搜索查询过滤文档（支持文件名和 file-id 搜索）
  const filteredDocuments = availableDocuments.filter((doc) => {
    if (!documentSearchQuery) return true;
    const query = documentSearchQuery.toLowerCase();
    return (
      doc.fileName.toLowerCase().includes(query) ||
      doc.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="relative">
      <ComposerPrimitive.Input
        ref={inputRef}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          // ESC 键关闭弹出框
          if (e.key === "Escape") {
            if (showModelPopover) {
              setShowModelPopover(false);
              e.preventDefault();
            }
            if (showDocumentPopover) {
              setShowDocumentPopover(false);
              e.preventDefault();
            }
          }
          // Enter 键选择第一个选项
          if (e.key === "Enter" && !e.shiftKey) {
            if (showModelPopover && filteredModels.length > 0) {
              handleModelSelect(filteredModels[0]);
              e.preventDefault();
            }
            if (
              showDocumentPopover &&
              filteredDocuments.length > 0
            ) {
              handleDocumentSelect(filteredDocuments[0]);
              e.preventDefault();
            }
          }
        }}
        placeholder="Send a message... @ for model, # for document"
        className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
        rows={1}
        autoFocus
        aria-label="Message input"
      />

      {/* 显示选中的模型和文档标签 */}
      {(selectedModel || selectedDocuments.length > 0) && (
        <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-none">
          {selectedModel && <MentionTag model={selectedModel} />}
          {selectedDocuments.map((doc) => (
            <DocumentTag key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* 模型选择器弹出框 */}
      {showModelPopover && (
        <MentionPopover
          ref={modelPopoverRef}
          models={filteredModels}
          onSelect={handleModelSelect}
          onClose={() => setShowModelPopover(false)}
        />
      )}

      {/* 文档选择器弹出框 */}
      {showDocumentPopover && (
        <DocumentPopover
          ref={documentPopoverRef}
          documents={filteredDocuments}
          onSelect={handleDocumentSelect}
          onClose={() => setShowDocumentPopover(false)}
        />
      )}
    </div>
  );
}

