"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, MessageSquare, Plus, Pencil, Trash2, MoreVertical, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ThreadData } from "@/lib/thread-storage";
import type { ThreadFolder } from "@/lib/thread-folder-storage";
import {
  getThreadFolders,
  createThreadFolder,
  updateThreadFolder,
  deleteThreadFolder,
  saveThreadFolders,
} from "@/lib/thread-folder-storage";
import {
  getThreads,
  saveThread,
  deleteThread,
  createThread,
  setCurrentThreadId,
} from "@/lib/thread-storage";

interface ThreadTreeNode {
  id: string;
  name: string;
  type: "folder" | "thread";
  parentId?: string;
  isExpanded?: boolean;
  createdAt: number;
  updatedAt: number;
  threadData?: ThreadData; // 如果是 thread 类型
}

interface ThreadTreeProps {
  currentThreadId: string | null;
  onSelectThread: (id: string) => void;
  onRefresh: () => void;
}

function buildThreadTree(folders: ThreadFolder[], threads: ThreadData[]): ThreadTreeNode[] {
  const folderNodes: ThreadTreeNode[] = folders.map(f => ({
    ...f,
    type: "folder" as const,
  }));
  
  const threadNodes: ThreadTreeNode[] = threads.map(t => ({
    id: t.id,
    name: t.title,
    type: "thread" as const,
    parentId: t.folderId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    threadData: t,
  }));
  
  return [...folderNodes, ...threadNodes];
}

function getChildren(nodes: ThreadTreeNode[], parentId: string | undefined): ThreadTreeNode[] {
  return nodes.filter(n => n.parentId === parentId);
}

function getRootNodes(nodes: ThreadTreeNode[]): ThreadTreeNode[] {
  return nodes.filter(n => !n.parentId);
}

export function ThreadTree({ currentThreadId, onSelectThread, onRefresh }: ThreadTreeProps) {
  const [folders, setFolders] = useState<ThreadFolder[]>([]);
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const loadData = () => {
      setFolders(getThreadFolders());
      setThreads(getThreads());
    };
    loadData();
    
    const handleStorageChange = () => loadData();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("threads-updated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("threads-updated", handleStorageChange);
    };
  }, []);

  const nodes = buildThreadTree(folders, threads);
  const rootNodes = getRootNodes(nodes);

  const handleCreateFolder = (parentId?: string) => {
    const folder = createThreadFolder("New Folder", parentId);
    const updated = [...folders, folder];
    setFolders(updated);
    saveThreadFolders(updated);
  };

  const handleCreateThread = () => {
    const newThread = createThread("New Chat");
    saveThread(newThread);
    setThreads(getThreads());
    setCurrentThreadId(newThread.id);
    onSelectThread(newThread.id);
    onRefresh();
  };

  const handleRenameNode = (id: string, name: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      updateThreadFolder(id, { name });
      setFolders(getThreadFolders());
    } else {
      const thread = threads.find(t => t.id === id);
      if (thread) {
        saveThread({ ...thread, title: name });
        setThreads(getThreads());
        onRefresh();
      }
    }
  };

  const handleDeleteNode = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      deleteThreadFolder(id);
      setFolders(getThreadFolders());
    } else {
      deleteThread(id);
      setThreads(getThreads());
      onRefresh();
    }
  };

  const handleToggleFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      updateThreadFolder(id, { isExpanded: !folder.isExpanded });
      setFolders(getThreadFolders());
    }
  };

  const renderNode = (node: ThreadTreeNode, level: number = 0): React.ReactNode => {
    const isFolder = node.type === "folder";
    const isSelected = !isFolder && node.id === currentThreadId;
    const isExpanded = isFolder ? (node.isExpanded ?? true) : false;
    const children = isFolder ? getChildren(nodes, node.id) : [];
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer group",
            isSelected && "bg-accent text-accent-foreground",
            !isSelected && "hover:bg-accent/50"
          )}
          style={{ paddingLeft: `${8 + level * 20}px` }}
        >
          <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
          
          {isFolder && (
            <button
              onClick={() => handleToggleFolder(node.id)}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
          )}
          
          {isFolder ? (
            <Folder className="size-4 text-muted-foreground" />
          ) : (
            <MessageSquare className="size-4 text-muted-foreground" />
          )}
          
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim()) {
                  handleRenameNode(node.id, editName.trim());
                }
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editName.trim()) {
                    handleRenameNode(node.id, editName.trim());
                  }
                  setEditingId(null);
                } else if (e.key === "Escape") {
                  setEditingId(null);
                }
              }}
              className="flex-1 px-1 border rounded text-sm"
              autoFocus
            />
          ) : (
            <span
              className="flex-1 truncate"
              onClick={() => !isFolder && onSelectThread(node.id)}
            >
              {node.name}
            </span>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded">
                <MoreVertical className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setEditingId(node.id);
                setEditName(node.name);
              }}>
                <Pencil className="size-4 mr-2" />
                Rename
              </DropdownMenuItem>
              {isFolder && (
                <>
                  <DropdownMenuItem onClick={() => handleCreateFolder(node.id)}>
                    <Folder className="size-4 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleDeleteNode(node.id)}
                className="text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {isFolder && isExpanded && (
          <div>
            {children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="text-sm font-semibold">Threads</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleCreateThread}
          >
            <Plus className="size-3 mr-1" />
            New Chat
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreateFolder()}>
                <Folder className="size-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="space-y-0.5">
        {rootNodes.map(node => renderNode(node))}
      </div>
    </div>
  );
}

