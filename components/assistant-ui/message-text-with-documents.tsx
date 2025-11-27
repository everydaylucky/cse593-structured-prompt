"use client";

import { useMemo } from "react";
import { parseDocumentsFromMessage } from "@/lib/document-parser";
import { getFilesByThreadId, type FileVectorIndex } from "@/lib/vector-storage";
import { getCurrentThreadId } from "@/lib/thread-storage";
import { DocumentTag } from "@/components/document-mention/document-tag";
import { useState, useEffect } from "react";

interface MessageTextWithDocumentsProps {
  text: string;
}

export function MessageTextWithDocuments({ text }: MessageTextWithDocumentsProps) {
  const [availableDocuments, setAvailableDocuments] = useState<FileVectorIndex[]>([]);

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
  }, []);

  const renderedContent = useMemo(() => {
    if (!text) return text;

    // 解析文档引用
    const docParsed = parseDocumentsFromMessage(text);
    
    if (!docParsed.hasDocumentMention) {
      return <span>{text}</span>;
    }

    // 找到所有文档引用并替换为标签
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    // 匹配 #文件名(file-id) 或 #file-id
    const regex = /#([^(]+)\(([a-zA-Z0-9_-]+)\)|#([a-zA-Z0-9_-]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const fileId = match[2] || match[3]; // 命名格式的 id 或简单格式的 id
      const fileName = match[1] || fileId; // 命名格式的文件名或使用 id

      // 查找对应的文档
      const document = availableDocuments.find((d) => d.id === fileId);

      if (document) {
        // 显示为标签
        parts.push(
          <DocumentTag
            key={`doc-${fileId}-${match.index}`}
            document={document}
            showRemove={false}
          />
        );
      } else {
        // 如果找不到文档，显示原始文本
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <span>{parts}</span>;
  }, [text, availableDocuments]);

  return <>{renderedContent}</>;
}

