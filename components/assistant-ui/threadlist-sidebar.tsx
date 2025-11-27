import * as React from "react";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/assistant-ui/threadlist";
import { CustomThreadList } from "@/components/assistant-ui/custom-thread-list";
import { ThreadTree } from "@/components/assistant-ui/thread-tree";
import { FileUploadPanel } from "@/components/assistant-ui/file-upload-panel";
import { ProcessedFilesPanel } from "@/components/assistant-ui/processed-files-panel";
import { DocumentTree } from "@/components/assistant-ui/document-tree";
import { SidebarLayoutSwitcher } from "@/components/assistant-ui/sidebar-layout-switcher";
import { ResizableSplitPanel } from "@/components/assistant-ui/resizable-split-panel";
import { StructifyIcon } from "../logo/structify";
import { Monitor, FlaskConical } from "lucide-react";
import { getSidebarLayoutMode, type SidebarLayoutMode } from "@/lib/sidebar-layout-storage";
import { useAssistantApi } from "@assistant-ui/react";
import { setCurrentThreadId } from "@/lib/thread-storage";

type ThreadListSidebarProps = React.ComponentProps<typeof Sidebar> & {
  structifyFeature: boolean;
  onToggleStructifyFeature: () => void;
  userStudyMode: boolean;
  onToggleUserStudyMode: () => void;
};

export function ThreadListSidebar({
  structifyFeature,
  onToggleStructifyFeature,
  userStudyMode,
  onToggleUserStudyMode,
  ...props
}: ThreadListSidebarProps) {
  const [layoutMode, setLayoutMode] = useState<SidebarLayoutMode>('combined');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const api = useAssistantApi();

  useEffect(() => {
    setLayoutMode(getSidebarLayoutMode());
    
    const handleLayoutChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.mode) {
        setLayoutMode(customEvent.detail.mode);
      }
    };
    
    window.addEventListener('sidebar-layout-changed', handleLayoutChange);
    return () => {
      window.removeEventListener('sidebar-layout-changed', handleLayoutChange);
    };
  }, []);

  useEffect(() => {
    const handleThreadSwitch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.threadId) {
        setCurrentThreadId(customEvent.detail.threadId);
      }
    };
    
    window.addEventListener('thread-switch', handleThreadSwitch);
    return () => {
      window.removeEventListener('thread-switch', handleThreadSwitch);
    };
  }, []);

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
    
    // Clear composer
    try {
      const threadRuntime = api.thread();
      threadRuntime.composer.setText("");
    } catch (error) {
      console.error("Failed to clear composer:", error);
    }
    
    // Dispatch thread switch event
    window.dispatchEvent(new CustomEvent('thread-switch', {
      detail: { threadId }
    }));
  };

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('threads-updated'));
  };

  const renderContent = () => {
    const topPanel = (
      <div className="h-full overflow-y-auto px-2">
        <ThreadTree
          currentThreadId={currentThreadId}
          onSelectThread={handleSelectThread}
          onRefresh={handleRefresh}
        />
      </div>
    );

    const bottomPanel = (
      <div className="h-full overflow-y-auto px-2 flex flex-col">
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 px-2">Documents</h3>
          <FileUploadPanel onUploadComplete={() => {}} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <DocumentTree onRefresh={handleRefresh} />
        </div>
      </div>
    );

    if (layoutMode === 'threads-only') {
      return (
        <SidebarContent className="aui-sidebar-content px-2 flex flex-col">
          <div className="flex items-center justify-between mb-2 px-2">
            <SidebarLayoutSwitcher onModeChange={setLayoutMode} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {topPanel}
          </div>
        </SidebarContent>
      );
    }

    if (layoutMode === 'documents-only') {
      return (
        <SidebarContent className="aui-sidebar-content px-2 flex flex-col">
          <div className="flex items-center justify-between mb-2 px-2">
            <SidebarLayoutSwitcher onModeChange={setLayoutMode} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {bottomPanel}
          </div>
        </SidebarContent>
      );
    }

    // Combined mode with resizable split
    return (
      <SidebarContent className="aui-sidebar-content px-2 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-2">
          <SidebarLayoutSwitcher onModeChange={setLayoutMode} />
        </div>
        <div className="flex-1 min-h-0">
          <ResizableSplitPanel
            topPanel={topPanel}
            bottomPanel={bottomPanel}
            topLabel="Threads"
            bottomLabel="Documents"
            storageKey="sidebar-split-height"
            defaultTopHeight={50}
            minTopHeight={10}
            minBottomHeight={10}
          />
        </div>
      </SidebarContent>
    );
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="aui-sidebar-header-content flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                aria-pressed={structifyFeature}
                onClick={onToggleStructifyFeature}
                title={
                  structifyFeature
                    ? "Hide structured prompts panel"
                    : "Show structured prompts panel"
                }
              >
                <div className="aui-sidebar-header-icon-wrapper flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <StructifyIcon className="aui-sidebar-header-icon size-4" />
                </div>
                <div className="aui-sidebar-header-heading mr-6 flex flex-col gap-0.5 leading-none">
                  <span className="aui-sidebar-header-title font-semibold">
                    Structify
                  </span>
                  <span className="aui-sidebar-header-subtitle text-xs text-muted-foreground">
                    {structifyFeature ? "Features on" : "Features off"}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="ml-2 shrink-0" size="icon" />
        </div>
      </SidebarHeader>
      
      {renderContent()}
      
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              aria-pressed={userStudyMode}
              onClick={onToggleUserStudyMode}
              title={
                userStudyMode
                  ? "Switch to Normal Mode"
                  : "Switch to User Study Mode"
              }
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {userStudyMode ? (
                    <FlaskConical className="size-4" aria-hidden="true" />
                  ) : (
                    <Monitor className="size-4" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-sm font-medium">
                    {userStudyMode ? "User Study Mode" : "Normal Mode"}
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
