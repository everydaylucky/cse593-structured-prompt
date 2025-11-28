"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle, XCircle } from "lucide-react";
import { processPDFToRAG, type ProcessingProgress } from "@/lib/pdf-rag-pipeline";
import { getCurrentThreadId } from "@/lib/thread-storage";
import { PDFParserSelector } from "@/components/assistant-ui/pdf-parser-selector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadPanelProps {
  className?: string;
  onUploadComplete?: (fileId: string) => void;
}

export function FileUploadPanel({
  className,
  onUploadComplete,
}: FileUploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedParserId, setSelectedParserId] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    const threadId = getCurrentThreadId();
    if (!threadId) {
      setError("Please select a thread first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(null);

    try {
      const result = await processPDFToRAG(
        file,
        threadId,
        (prog) => {
          setProgress(prog);
        },
        {
          parserId: selectedParserId,
          useFallback: true, // 启用自动降级
        }
      );

      // 触发文件列表刷新
      window.dispatchEvent(new CustomEvent("files-updated"));

      onUploadComplete?.(result.fileId);
      setProgress(null);
    } catch (err: any) {
      console.error("File processing error:", err);
      const errorMessage = err?.message || "Failed to process file";
      setError(errorMessage);
      setProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* PDF 解析器选择器 */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">PDF Parser</label>
        <PDFParserSelector
          selectedParserId={selectedParserId}
          onSelect={setSelectedParserId}
        />
      </div>

      {/* 紧凑的单行上传框 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex items-center gap-2 border rounded-lg transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          isProcessing && "opacity-50 pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleInputChange}
          className="hidden"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <>
            <div className="flex-1 px-3 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {progress?.message || `${progress?.progress || 0}%`}
                  </p>
                  {progress && (
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="flex-1 px-3 py-2 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="size-4 shrink-0" />
                <span className="truncate">
                  {isDragging ? "Drop PDF here" : "Drop PDF or click to upload"}
                </span>
              </div>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="mx-2 shrink-0"
            >
              <FileText className="size-4 mr-2" />
              Browse
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 shrink-0" />
            <span className="font-medium">Upload Failed</span>
          </div>
          <p className="text-xs pl-6">{error}</p>
          {error.includes('credentials') && (
            <div className="mt-2 p-2 rounded bg-muted text-xs text-foreground">
              <p className="font-medium mb-1">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Create a <code className="bg-background px-1 rounded">.env.local</code> file in the project root</li>
                <li>Add your Mathpix API credentials:
                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
{`MATHPIX_APP_ID=your_app_id
MATHPIX_API_KEY=your_app_key`}
                  </pre>
                </li>
                <li>Get your API keys from: <a href="https://console.mathpix.com" target="_blank" rel="noopener noreferrer" className="underline">console.mathpix.com</a></li>
                <li>Restart the development server after adding the file</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

