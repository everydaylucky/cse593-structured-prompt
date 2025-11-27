"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResizableSplitPanelProps {
  topPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
  topLabel?: string;
  bottomLabel?: string;
  storageKey?: string;
  defaultTopHeight?: number; // 0-100, percentage
  minTopHeight?: number; // 0-100, percentage
  minBottomHeight?: number; // 0-100, percentage
}

const DEFAULT_TOP_HEIGHT = 50;
const MIN_PANEL_HEIGHT = 5; // 5% minimum
const COLLAPSED_THRESHOLD = 2; // 2% or less = collapsed

export function ResizableSplitPanel({
  topPanel,
  bottomPanel,
  topLabel = "Top",
  bottomLabel = "Bottom",
  storageKey = "resizable-split-panel-height",
  defaultTopHeight = DEFAULT_TOP_HEIGHT,
  minTopHeight = MIN_PANEL_HEIGHT,
  minBottomHeight = MIN_PANEL_HEIGHT,
}: ResizableSplitPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [isTopCollapsed, setIsTopCollapsed] = useState(false);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  // Load saved height from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          setTopHeight(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load saved panel height:", error);
    }
  }, [storageKey]);

  // Save height to localStorage
  const saveHeight = useCallback((height: number) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, height.toString());
    } catch (error) {
      console.error("Failed to save panel height:", error);
    }
  }, [storageKey]);

  // Update collapsed states
  useEffect(() => {
    setIsTopCollapsed(topHeight <= COLLAPSED_THRESHOLD);
    setIsBottomCollapsed(topHeight >= 100 - COLLAPSED_THRESHOLD);
  }, [topHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = (y / rect.height) * 100;

    // Allow collapsing completely (0 or 100)
    let clamped = percentage;
    if (percentage < COLLAPSED_THRESHOLD) {
      clamped = 0;
    } else if (percentage > 100 - COLLAPSED_THRESHOLD) {
      clamped = 100;
    } else {
      // Clamp to valid range when not collapsing
      clamped = Math.max(minTopHeight, Math.min(100 - minBottomHeight, percentage));
    }
    setTopHeight(clamped);
    saveHeight(clamped);
  }, [isDragging, minTopHeight, minBottomHeight, saveHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleExpandTop = useCallback(() => {
    setTopHeight(50);
    saveHeight(50);
  }, [saveHeight]);

  const handleExpandBottom = useCallback(() => {
    setTopHeight(50);
    saveHeight(50);
  }, [saveHeight]);

  const handleCollapseTop = useCallback(() => {
    setTopHeight(0);
    saveHeight(0);
  }, [saveHeight]);

  const handleCollapseBottom = useCallback(() => {
    setTopHeight(100);
    saveHeight(100);
  }, [saveHeight]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full w-full"
    >
      {/* Top Panel */}
      <div
        className={cn(
          "relative overflow-hidden transition-all duration-200",
          isTopCollapsed ? "h-0" : "flex-shrink-0"
        )}
        style={{
          height: isTopCollapsed ? "0%" : `${topHeight}%`,
        }}
      >
        {!isTopCollapsed && topPanel}
      </div>

      {/* Resizer Handle - Always visible when not both collapsed */}
      {!isBottomCollapsed && (
        <div
          className={cn(
            "relative cursor-row-resize flex items-center justify-center group transition-all z-20",
            isTopCollapsed 
              ? "h-8 bg-muted/50 hover:bg-muted border-b border-border" 
              : "h-2 bg-gradient-to-b from-border via-border/50 to-border hover:from-primary/30 hover:via-primary/20 hover:to-primary/30",
            isDragging && !isTopCollapsed && "from-primary/50 via-primary/40 to-primary/50"
          )}
          onMouseDown={handleMouseDown}
          title={isTopCollapsed ? `Drag down to expand ${topLabel}` : "Drag to resize"}
        >
          {isTopCollapsed ? (
            // Collapsed indicator - show when top is hidden
            <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground">
              <ChevronDown className="size-3" />
              <span className="font-medium">{topLabel}</span>
              <GripVertical className="size-3" />
            </div>
          ) : (
            // Normal resizer handle
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-8 bg-muted-foreground/30 group-hover:bg-primary rounded-full" />
                <GripVertical className="size-3 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-0.5 w-8 bg-muted-foreground/30 group-hover:bg-primary rounded-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Panel */}
      <div
        className={cn(
          "relative overflow-hidden transition-all duration-200 flex-1",
          isBottomCollapsed && "h-0"
        )}
        style={{
          height: isBottomCollapsed ? "0%" : `${100 - topHeight}%`,
        }}
      >
        {bottomPanel}
        
        {/* Collapsed indicator for bottom panel */}
        {isBottomCollapsed && (
          <div
            className="absolute top-0 left-0 right-0 h-8 bg-muted/50 hover:bg-muted border-b border-border cursor-row-resize flex items-center justify-center group z-10"
            onMouseDown={handleMouseDown}
            title={`Drag up to expand ${bottomLabel}`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground">
              <ChevronUp className="size-3" />
              <span className="font-medium">{bottomLabel}</span>
              <GripVertical className="size-3" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

