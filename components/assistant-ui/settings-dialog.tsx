"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Settings, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GeneralSettings } from "./settings/general-settings";
import { RAGSettings } from "./settings/rag-settings";
import { ChunkingSettings } from "./settings/chunking-settings";
import { ModelSettings } from "./settings/model-settings";
import { AdvancedSettings } from "./settings/advanced-settings";

type SettingsPage = 'general' | 'rag' | 'chunking' | 'models' | 'advanced';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_DIALOG_WIDTH = 90; // 90% of viewport width
const DEFAULT_DIALOG_HEIGHT = 85; // 85% of viewport height
const MIN_DIALOG_WIDTH = 600; // minimum width in pixels
const MIN_DIALOG_HEIGHT = 400; // minimum height in pixels
const STORAGE_KEY_WIDTH = "settings-dialog-width";
const STORAGE_KEY_HEIGHT = "settings-dialog-height";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activePage, setActivePage] = useState<SettingsPage>('general');
  const [dialogSize, setDialogSize] = useState({ width: DEFAULT_DIALOG_WIDTH, height: DEFAULT_DIALOG_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const pages: Array<{ id: SettingsPage; label: string; icon?: string }> = [
    { id: 'general', label: 'General' },
    { id: 'rag', label: 'RAG' },
    { id: 'chunking', label: 'Chunking' },
    { id: 'models', label: 'Models' },
    { id: 'advanced', label: 'Advanced' },
  ];

  // Load saved dialog size from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const savedWidth = localStorage.getItem(STORAGE_KEY_WIDTH);
      const savedHeight = localStorage.getItem(STORAGE_KEY_HEIGHT);
      
      if (savedWidth) {
        const width = parseFloat(savedWidth);
        if (!isNaN(width) && width >= 50 && width <= 95) {
          setDialogSize(prev => ({ ...prev, width }));
        }
      }
      
      if (savedHeight) {
        const height = parseFloat(savedHeight);
        if (!isNaN(height) && height >= 50 && height <= 95) {
          setDialogSize(prev => ({ ...prev, height }));
        }
      }
    } catch (error) {
      console.error("Failed to load saved dialog size:", error);
    }
  }, []);

  // Save dialog size to localStorage
  const saveDialogSize = useCallback((width: number, height: number) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, width.toString());
      localStorage.setItem(STORAGE_KEY_HEIGHT, height.toString());
    } catch (error) {
      console.error("Failed to save dialog size:", error);
    }
  }, []);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !dialogRef.current) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate new size based on mouse position
    // Resize from bottom-right corner
    const rect = dialogRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / viewportWidth) * 100;
    const newHeight = ((e.clientY - rect.top) / viewportHeight) * 100;

    // Clamp to valid range
    const clampedWidth = Math.max(
      (MIN_DIALOG_WIDTH / viewportWidth) * 100,
      Math.min(95, newWidth)
    );
    const clampedHeight = Math.max(
      (MIN_DIALOG_HEIGHT / viewportHeight) * 100,
      Math.min(95, newHeight)
    );

    setDialogSize({ width: clampedWidth, height: clampedHeight });
    saveDialogSize(clampedWidth, clampedHeight);
  }, [isResizing, saveDialogSize]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
      
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const renderPage = () => {
    switch (activePage) {
      case 'general':
        return <GeneralSettings />;
      case 'rag':
        return <RAGSettings />;
      case 'chunking':
        return <ChunkingSettings />;
      case 'models':
        return <ModelSettings />;
      case 'advanced':
        return <AdvancedSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="p-0 flex flex-col"
        style={{
          width: `${dialogSize.width}vw`,
          height: `${dialogSize.height}vh`,
          maxWidth: '95vw',
          maxHeight: '95vh',
          minWidth: `${MIN_DIALOG_WIDTH}px`,
          minHeight: `${MIN_DIALOG_HEIGHT}px`,
        }}
        showCloseButton={false}
      >
        <div
          ref={dialogRef}
          className="w-full h-full flex flex-col relative"
        >
        <DialogHeader className="px-8 pt-8 pb-6 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <Settings className="size-5" />
              Settings
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 min-h-0">
          {/* 左侧导航栏 */}
          <div className="w-56 border-r bg-muted/30 flex-shrink-0">
            <ScrollArea className="h-full">
              <nav className="p-4 space-y-2">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setActivePage(page.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors",
                      activePage === page.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {page.label}
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-8">
                {renderPage()}
              </div>
            </ScrollArea>
          </div>
        </div>

          {/* Resize Handle - Bottom Right Corner */}
          <div
            ref={resizeHandleRef}
            className={cn(
              "absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center group z-50",
              "bg-transparent hover:bg-primary/10 transition-colors",
              isResizing && "bg-primary/20"
            )}
            onMouseDown={handleMouseDown}
            title="Drag to resize"
          >
            <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[12px] border-l-transparent border-b-[12px] border-b-border group-hover:border-b-primary transition-colors" />
            <GripVertical className="absolute bottom-1 right-1 size-3 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity rotate-45" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

