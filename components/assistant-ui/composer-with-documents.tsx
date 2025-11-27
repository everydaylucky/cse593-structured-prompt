"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ComposerPrimitive, useAssistantApi } from "@assistant-ui/react";
import { DocumentPopover } from "@/components/document-mention/document-popover";
import { DocumentTag } from "@/components/document-mention/document-tag";
import {
  shouldShowDocumentPopover,
  parseDocumentsFromMessage,
  type DocumentMention,
} from "@/lib/document-parser";
import { getFilesByThreadId, type FileVectorIndex } from "@/lib/vector-storage";
import { getCurrentThreadId } from "@/lib/thread-storage";

export function ComposerWithDocuments() {
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  const [showPopover, setShowPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedDocuments, setSelectedDocuments] = useState<FileVectorIndex[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<FileVectorIndex[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

    // 监听文件更新
    const handleFilesUpdated = () => {
      loadDocuments();
    };

    window.addEventListener("files-updated", handleFilesUpdated);
    return () => {
      window.removeEventListener("files-updated", handleFilesUpdated);
    };
  }, []);

  // 检测是否应该显示弹出框
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    // 检查是否应该显示文档选择器
    const { show, query } = shouldShowDocumentPopover(newValue, cursorPos);

    if (show) {
      setShowPopover(true);
      setSearchQuery(query);
    } else {
      setShowPopover(false);
    }
  };

  // 处理文档选择
  const handleDocumentSelect = useCallback(
    (document: FileVectorIndex) => {
      const currentValue = inputRef.current?.value || "";
      const textBeforeCursor = currentValue.substring(0, cursorPosition);
      const trimmedBefore = textBeforeCursor.trimStart();

      // 找到 # 的位置
      const hashIndex = trimmedBefore.indexOf("#");
      if (hashIndex === -1) return;

      // 计算实际位置
      const actualHashIndex =
        textBeforeCursor.length - trimmedBefore.length + hashIndex;
      const textAfterCursor = currentValue.substring(cursorPosition);

      // 找到 # 后第一个空格的位置
      const afterHash = trimmedBefore.substring(hashIndex + 1);
      const spaceIndex = afterHash.search(/[\s\n]/);
      const mentionEnd =
        spaceIndex === -1
          ? cursorPosition
          : actualHashIndex + 1 + spaceIndex + 1;

      // 替换 #query 为 #file-id
      const newValue =
        currentValue.substring(0, actualHashIndex) +
        `#${document.id} ` +
        currentValue.substring(mentionEnd);

      // 更新 composer
      threadRuntime.composer.setText(newValue);
      setShowPopover(false);

      // 更新选中的文档列表
      if (!selectedDocuments.find((d) => d.id === document.id)) {
        setSelectedDocuments((prev) => [...prev, document]);
      }

      // 聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
        const newCursorPos = actualHashIndex + document.id.length + 2;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [threadRuntime.composer, cursorPosition, selectedDocuments]
  );

  // 解析消息中的文档引用
  useEffect(() => {
    const currentValue = inputRef.current?.value || "";
    const parsed = parseDocumentsFromMessage(currentValue);

    if (parsed.hasDocumentMention) {
      // 根据 fileId 查找文档信息
      const foundDocs = parsed.documents
        .map((doc) => availableDocuments.find((d) => d.id === doc.fileId))
        .filter((d): d is FileVectorIndex => d !== undefined);

      setSelectedDocuments(foundDocs);
    } else {
      setSelectedDocuments([]);
    }
  }, [inputRef.current?.value, availableDocuments]);

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

  // 过滤文档
  const filteredDocuments = availableDocuments.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative">
      <ComposerPrimitive.Input
        ref={inputRef}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          // ESC 键关闭弹出框
          if (e.key === "Escape" && showPopover) {
            setShowPopover(false);
            e.preventDefault();
          }
          // Enter 键选择第一个文档
          if (
            e.key === "Enter" &&
            showPopover &&
            filteredDocuments.length > 0 &&
            !e.shiftKey
          ) {
            handleDocumentSelect(filteredDocuments[0]);
            e.preventDefault();
          }
        }}
        placeholder="Send a message... @ for model, # for document"
        className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
        rows={1}
        autoFocus
        aria-label="Message input"
      />

      {/* 显示选中的文档标签 */}
      {selectedDocuments.length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-none">
          {selectedDocuments.map((doc) => (
            <DocumentTag key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {/* 文档选择器弹出框 */}
      {showPopover && (
        <DocumentPopover
          ref={popoverRef}
          documents={filteredDocuments}
          onSelect={handleDocumentSelect}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}

