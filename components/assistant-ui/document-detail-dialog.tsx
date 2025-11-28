"use client";

import { useState, useEffect, useRef } from "react";
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
  List,
  ChevronDown,
  ChevronUp,
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
  const [expandedIndex, setExpandedIndex] = useState(false);
  const chunksContainerRef = useRef<HTMLDivElement>(null);
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
          console.log("[DocumentDetailDialog] Loaded file data:", {
            fileId: fileData.id,
            fileName: fileData.fileName,
            hasMetadata: !!fileData.metadata,
            metadataKeys: fileData.metadata ? Object.keys(fileData.metadata) : [],
            hasSummary: !!fileData.metadata?.summary,
            summaryLength: fileData.metadata?.summary?.length || 0,
            keywordsCount: fileData.metadata?.keywords?.length || 0,
            topicsCount: fileData.metadata?.topics?.length || 0,
            hasEntities: !!fileData.metadata?.entities,
            entitiesKeys: fileData.metadata?.entities ? Object.keys(fileData.metadata.entities) : [],
          });
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
          {/* 生成的文档标题 */}
          {file.metadata?.title && file.metadata.title !== file.fileName && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText className="size-4 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Generated Title
                  </p>
                  <p className="text-sm font-semibold text-foreground break-words">
                    {file.metadata.title}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 引用按钮 - 放在最上面 */}
          <div className="flex gap-2">
            <Button onClick={handleReference} size="sm" variant="default">
              <BookOpen className="size-4 mr-2" />
              Reference in Chat
            </Button>
          </div>

          {/* 笔记区域 - 移到最前面 */}
          <div className="space-y-2 border-t pt-4">
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

          {/* 文档元数据（GPT-4o-mini 生成） */}
          {file.metadata && (
            <div className="space-y-4 border-t pt-4">
              {/* 摘要 */}
              {file.metadata.summary && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="size-4" />
                    Summary
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {file.metadata.summary}
                  </p>
                </div>
              )}

              {/* 关键词 */}
              {file.metadata.keywords && file.metadata.keywords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {file.metadata.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 主题 */}
              {file.metadata.topics && file.metadata.topics.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {file.metadata.topics.map((topic, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-md"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 关键短语 */}
              {file.metadata.keyPhrases && file.metadata.keyPhrases.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Key Phrases</h3>
                  <div className="flex flex-wrap gap-2">
                    {file.metadata.keyPhrases.map((phrase, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md"
                      >
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 实体识别结果 */}
              {file.metadata.entities && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Entities</h3>
                  
                  {file.metadata.entities.persons && file.metadata.entities.persons.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Persons:</span>
                      <div className="flex flex-wrap gap-1">
                        {file.metadata.entities.persons.slice(0, 10).map((person, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                          >
                            {person}
                          </span>
                        ))}
                        {file.metadata.entities.persons.length > 10 && (
                          <span className="text-xs text-muted-foreground">
                            +{file.metadata.entities.persons.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {file.metadata.entities.organizations && file.metadata.entities.organizations.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Organizations:</span>
                      <div className="flex flex-wrap gap-1">
                        {file.metadata.entities.organizations.slice(0, 10).map((org, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
                          >
                            {org}
                          </span>
                        ))}
                        {file.metadata.entities.organizations.length > 10 && (
                          <span className="text-xs text-muted-foreground">
                            +{file.metadata.entities.organizations.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {file.metadata.entities.locations && file.metadata.entities.locations.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Locations:</span>
                      <div className="flex flex-wrap gap-1">
                        {file.metadata.entities.locations.slice(0, 10).map((location, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
                          >
                            {location}
                          </span>
                        ))}
                        {file.metadata.entities.locations.length > 10 && (
                          <span className="text-xs text-muted-foreground">
                            +{file.metadata.entities.locations.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {file.metadata.entities.dates && file.metadata.entities.dates.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Dates:</span>
                      <div className="flex flex-wrap gap-1">
                        {file.metadata.entities.dates.slice(0, 10).map((date, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded"
                          >
                            {date}
                          </span>
                        ))}
                        {file.metadata.entities.dates.length > 10 && (
                          <span className="text-xs text-muted-foreground">
                            +{file.metadata.entities.dates.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {file.metadata.entities.other && (
                    <>
                      {file.metadata.entities.other.emails && file.metadata.entities.other.emails.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">Emails:</span>
                          <div className="flex flex-wrap gap-1">
                            {file.metadata.entities.other.emails.slice(0, 5).map((email, index) => (
                              <span
                                key={index}
                                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-mono"
                              >
                                {email}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {file.metadata.entities.other.urls && file.metadata.entities.other.urls.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">URLs:</span>
                          <div className="flex flex-col gap-1">
                            {file.metadata.entities.other.urls.slice(0, 3).map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded font-mono hover:underline truncate max-w-full"
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 文档目录索引 */}
          {file.metadata?.tableOfContents && file.metadata.tableOfContents.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <List className="size-4" />
                  Table of Contents
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpandedIndex(!expandedIndex)}
                  className="h-7"
                >
                  {expandedIndex ? (
                    <>
                      <ChevronUp className="size-3 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              </div>
              {expandedIndex && (
                <div className="max-h-96 overflow-y-auto space-y-1 border rounded-lg p-3 bg-muted/30">
                  {file.metadata.tableOfContents.map((item, index) => {
                    // 找到这个目录条目覆盖的所有chunks
                    // 使用更严格的匹配：chunk的中心点必须在目录条目的范围内
                    const coveredChunks: typeof chunks = [];
                    if (item.startChar !== undefined && item.endChar !== undefined) {
                      for (const chunk of chunks) {
                        // 从 metadata 中获取位置信息（如果存储了的话）
                        const chunkStartChar = chunk.metadata?.startChar;
                        const chunkEndChar = chunk.metadata?.endChar;
                        
                        if (chunkStartChar !== undefined && chunkEndChar !== undefined) {
                          // 计算chunk的中心点
                          const chunkCenter = (chunkStartChar + chunkEndChar) / 2;
                          
                          // 只有当chunk的中心点在目录条目的范围内时，才归属于这个目录条目
                          // 这样可以避免chunk被多个section重复计算
                          if (chunkCenter >= item.startChar && chunkCenter < item.endChar) {
                            coveredChunks.push(chunk);
                          }
                        } else {
                          // 如果没有位置信息，使用chunkIndex来估算
                          // 基于目录条目的 approximateChunkIndex 和下一个条目的 approximateChunkIndex
                          const nextItem = file.metadata?.tableOfContents?.[index + 1];
                          const currentChunkIndex = item.approximateChunkIndex ?? 0;
                          const nextChunkIndex = nextItem?.approximateChunkIndex ?? chunks.length;
                          
                          if (chunk.chunkIndex >= currentChunkIndex && chunk.chunkIndex < nextChunkIndex) {
                            coveredChunks.push(chunk);
                          }
                        }
                      }
                    } else {
                      // 如果没有字符位置信息，使用chunkIndex来估算
                      const nextItem = file.metadata?.tableOfContents?.[index + 1];
                      const currentChunkIndex = item.approximateChunkIndex ?? 0;
                      const nextChunkIndex = nextItem?.approximateChunkIndex ?? chunks.length;
                      
                      for (const chunk of chunks) {
                        if (chunk.chunkIndex >= currentChunkIndex && chunk.chunkIndex < nextChunkIndex) {
                          coveredChunks.push(chunk);
                        }
                      }
                    }
                    
                    // 使用 approximateChunkIndex 作为主要跳转目标
                    const targetChunkIndex = item.approximateChunkIndex ?? 
                      (item.pageNumber 
                        ? Math.floor((item.pageNumber / (file.pageCount || 1)) * chunks.length)
                        : coveredChunks.length > 0 ? coveredChunks[0].chunkIndex : undefined);
                    
                    const targetChunk = targetChunkIndex !== undefined 
                      ? chunks.find(c => c.chunkIndex === targetChunkIndex) || chunks[Math.min(targetChunkIndex, chunks.length - 1)]
                      : coveredChunks.length > 0 ? coveredChunks[0] : null;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (targetChunk) {
                            const chunkElement = document.getElementById(`chunk-${targetChunk.id}`);
                            if (chunkElement) {
                              chunkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              chunkElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                              setTimeout(() => {
                                chunkElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                              }, 2000);
                            }
                          } else {
                            console.warn("[DocumentDetailDialog] No matching chunk found for TOC item:", item.title);
                          }
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded transition-colors"
                        style={{ paddingLeft: `${8 + (item.level - 1) * 16}px` }}
                        disabled={!targetChunk}
                      >
                        <div className="font-medium text-foreground">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground/60 text-[10px]">
                          {item.pageNumber && (
                            <span>Page {item.pageNumber}</span>
                          )}
                          {coveredChunks.length > 0 && (
                            <span>• {coveredChunks.length} chunk{coveredChunks.length > 1 ? 's' : ''}</span>
                          )}
                          {item.approximateChunkIndex !== undefined && coveredChunks.length === 0 && (
                            <span>• Chunk {item.approximateChunkIndex + 1}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 文档索引（基于 chunks，如果没有目录结构） */}
          {(!file.metadata?.tableOfContents || file.metadata.tableOfContents.length === 0) && chunks.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <List className="size-4" />
                  Document Index
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpandedIndex(!expandedIndex)}
                  className="h-7"
                >
                  {expandedIndex ? (
                    <>
                      <ChevronUp className="size-3 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              </div>
              {expandedIndex && (
                <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2 bg-muted/30">
                  {chunks.map((chunk, index) => {
                    const preview = chunk.text.substring(0, 80).trim() + (chunk.text.length > 80 ? '...' : '');
                    return (
                      <button
                        key={chunk.id}
                        onClick={() => {
                          const chunkElement = document.getElementById(`chunk-${chunk.id}`);
                          if (chunkElement) {
                            chunkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            chunkElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                            setTimeout(() => {
                              chunkElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                            }, 2000);
                          }
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded transition-colors"
                      >
                        <div className="font-medium text-muted-foreground">
                          Chunk {chunk.chunkIndex + 1}
                        </div>
                        <div className="text-muted-foreground/80 truncate">
                          {preview}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 文档内容（Chunks） */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Document Content</h3>
            <div ref={chunksContainerRef} className="space-y-3">
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
                    id={`chunk-${chunk.id}`}
                    key={chunk.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all scroll-mt-4"
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

