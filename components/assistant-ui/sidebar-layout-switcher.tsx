"use client";

import { useState, useEffect } from "react";
import { Layout, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSidebarLayoutMode,
  saveSidebarLayoutMode,
  type SidebarLayoutMode,
} from "@/lib/sidebar-layout-storage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarLayoutSwitcherProps {
  onModeChange?: (mode: SidebarLayoutMode) => void;
}

export function SidebarLayoutSwitcher({ onModeChange }: SidebarLayoutSwitcherProps) {
  const [mode, setMode] = useState<SidebarLayoutMode>('combined');

  useEffect(() => {
    setMode(getSidebarLayoutMode());
  }, []);

  const handleModeChange = (newMode: SidebarLayoutMode) => {
    setMode(newMode);
    saveSidebarLayoutMode(newMode);
    onModeChange?.(newMode);
    
    // 触发自定义事件，通知其他组件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sidebar-layout-changed', {
        detail: { mode: newMode }
      }));
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'combined' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => handleModeChange('combined')}
            >
              <Layout className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Combined View</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'threads-only' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => handleModeChange('threads-only')}
            >
              <MessageSquare className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Threads Only</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'documents-only' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => handleModeChange('documents-only')}
            >
              <FileText className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Documents Only</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

