"use client";

import { useState, useEffect } from "react";
import { FileText, X, Loader2 } from "lucide-react";
import {
  getFilesByThreadId,
  deleteFile,
  type FileVectorIndex,
} from "@/lib/vector-storage";
import { getCurrentThreadId } from "@/lib/thread-storage";
import { Button } from "@/components/ui/button";
import { DocumentDetailDialog } from "@/components/assistant-ui/document-detail-dialog";
import { cn } from "@/lib/utils";

interface ProcessedFilesPanelProps {
  className?: string;
  onFileSelect?: (fileId: string) => void;
}

export function ProcessedFilesPanel({
  className,
  onFileSelect,
}: ProcessedFilesPanelProps) {
  const [files, setFiles] = useState<FileVectorIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      const threadId = getCurrentThreadId();
      setCurrentThreadId(threadId);

      if (!threadId) {
        setFiles([]);
        setLoading(false);
        return;
      }

      try {
        const threadFiles = await getFilesByThreadId(threadId);
        setFiles(threadFiles);
      } catch (error) {
        console.error("Failed to load files:", error);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();

    // 监听线程切换
    const handleThreadSwitch = () => {
      loadFiles();
    };

    window.addEventListener("thread-switch", handleThreadSwitch);
    return () => {
      window.removeEventListener("thread-switch", handleThreadSwitch);
    };
  }, []);

  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      await deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error("Failed to delete file:", error);
      alert("Failed to delete file");
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className={cn("p-4", className)}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        <p>No processed files yet.</p>
        <p className="text-xs mt-1">Upload a PDF to get started.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 p-4", className)}>
      <h3 className="text-sm font-semibold mb-3">Processed Files</h3>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="group relative p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => {
              setSelectedFileId(file.id);
              setIsDialogOpen(true);
              onFileSelect?.(file.id);
            }}
          >
            <div className="flex items-start gap-3">
              <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{file.fileName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {file.pageCount} pages • {file.chunkCount} chunks
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(file.processedAt)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(file.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
              >
                <X className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <DocumentDetailDialog
        fileId={selectedFileId}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedFileId(null);
          }
        }}
        onReference={(fileId) => {
          onFileSelect?.(fileId);
        }}
      />
    </div>
  );
}

