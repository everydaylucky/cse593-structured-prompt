"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Edit2,
  Save,
  X,
  BookOpen,
  Copy,
  Check,
} from "lucide-react";
import {
  getFileMetadata,
  getChunksByFileId,
  type FileVectorIndex,
  type VectorChunk,
} from "@/lib/vector-storage";
import {
  getDocumentNote,
  saveDocumentNote,
} from "@/lib/document-notes-storage";
import { cn } from "@/lib/utils";
import { useAssistantApi } from "@assistant-ui/react";

interface DocumentDetailDialogProps {
  fileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReference?: (fileId: string) => void;
}

export function DocumentDetailDialog({
  fileId,
  open,
  onOpenChange,
  onReference,
}: DocumentDetailDialogProps) {
  const [file, setFile] = useState<FileVectorIndex | null>(null);
  const [chunks, setChunks] = useState<VectorChunk[]>([]);
  const [notes, setNotes] = useState("");
  const [isEditingFileName, setIsEditingFileName] = useState(false);
  const [editedFileName, setEditedFileName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useAssistantApi();

  useEffect(() => {
    if (!fileId || !open) {
      setFile(null);
      setChunks([]);
      setNotes("");
      setLoading(false);
      return;
    }

    const loadDocument = async () => {
      setLoading(true);
      try {
        const [fileData, chunksData] = await Promise.all([
          getFileMetadata(fileId),
          getChunksByFileId(fileId),
        ]);

        if (fileData) {
          setFile(fileData);
          setEditedFileName(fileData.fileName);
          const savedNotes = getDocumentNote(fileId);
          setNotes(savedNotes);
        }

        // 按 chunkIndex 排序
        const sortedChunks = chunksData.sort(
          (a, b) => a.chunkIndex - b.chunkIndex
        );
        setChunks(sortedChunks);
      } catch (error) {
        console.error("Failed to load document:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [fileId, open]);

  const handleSaveNotes = () => {
    if (!fileId) return;
    saveDocumentNote(fileId, notes);
  };

  const handleSaveFileName = async () => {
    if (!fileId || !file) return;

    setIsSaving(true);
    try {
      const { updateFileMetadata: updateFn } = await import("@/lib/vector-storage");
      await updateFn(fileId, {
        fileName: editedFileName,
      });
      setFile({ ...file, fileName: editedFileName });
      setIsEditingFileName(false);
      
      // 触发文件列表刷新
      window.dispatchEvent(new CustomEvent("files-updated"));
    } catch (error) {
      console.error("Failed to update file name:", error);
      alert("Failed to update file name");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReference = () => {
    if (!fileId) return;

    try {
      // 在 composer 中添加 #文件名(file-id)
      const threadRuntime = api.thread();
      const composer = threadRuntime.composer;
      
      if (!file) return;
      
      const sanitizedFileName = file.fileName.replace(/[()]/g, '').trim();
      const mention = `#${sanitizedFileName}(${fileId})`;

      // 获取当前输入值（通过 DOM 或状态）
      const inputElement = document.querySelector(
        '.aui-composer-input'
      ) as HTMLTextAreaElement;
      
      const currentValue = inputElement?.value || "";
      
      // 如果已经包含这个引用（检查 file-id），就不添加
      if (currentValue.includes(`#${fileId}`) || currentValue.includes(`(${fileId})`)) {
        onReference?.(fileId);
        onOpenChange(false);
        return;
      }

      // 添加到消息开头或当前光标位置
      const newValue = currentValue.trim()
        ? `${currentValue} ${mention}`
        : mention;
      
      composer.setText(newValue);
      
      // 尝试聚焦输入框
      setTimeout(() => {
        inputElement?.focus();
      }, 100);

      onReference?.(fileId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to reference document:", error);
      // 即使失败也关闭对话框
      onOpenChange(false);
    }
  };

  const handleCopyChunk = async (chunk: VectorChunk) => {
    try {
      await navigator.clipboard.writeText(chunk.text);
      setCopiedChunkId(chunk.id);
      setTimeout(() => setCopiedChunkId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (!file) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-muted-foreground" />
            {isEditingFileName ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editedFileName}
                  onChange={(e) => setEditedFileName(e.target.value)}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveFileName();
                    } else if (e.key === "Escape") {
                      setEditedFileName(file.fileName);
                      setIsEditingFileName(false);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleSaveFileName}
                  disabled={isSaving || !editedFileName.trim()}
                >
                  <Save className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditedFileName(file.fileName);
                    setIsEditingFileName(false);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <DialogTitle className="flex-1 flex items-center gap-2">
                <span>{file.fileName}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingFileName(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit2 className="size-3" />
                </Button>
              </DialogTitle>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 文档信息 */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Pages:</span>{" "}
              <span className="font-medium">{file.pageCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Chunks:</span>{" "}
              <span className="font-medium">{file.chunkCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>{" "}
              <span className="font-medium">
                {(file.fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>

          {/* 引用按钮 */}
          <div className="flex gap-2">
            <Button onClick={handleReference} size="sm" variant="default">
              <BookOpen className="size-4 mr-2" />
              Reference in Chat
            </Button>
          </div>

          {/* 笔记区域 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="size-4" />
                My Notes
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveNotes}
                className="h-7"
              >
                <Save className="size-3 mr-1" />
                Save
              </Button>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes about this document..."
              className="min-h-[120px] resize-none"
              onBlur={handleSaveNotes}
            />
          </div>

          {/* 文档内容（Chunks） */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Document Content</h3>
            <div className="space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">
                  Loading chunks...
                </div>
              ) : chunks.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No chunks available
                </div>
              ) : (
                chunks.map((chunk, index) => (
                  <div
                    key={chunk.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Chunk {chunk.chunkIndex + 1}
                        </span>
                        {chunk.metadata?.startChar !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            (chars {chunk.metadata.startChar}-
                            {chunk.metadata.endChar})
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyChunk(chunk)}
                        className="h-6 w-6 p-0"
                      >
                        {copiedChunkId === chunk.id ? (
                          <Check className="size-3 text-green-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {chunk.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

