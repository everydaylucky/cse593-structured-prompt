"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Pencil, Trash2, MoreVertical, GripVertical } from "lucide-react";
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
import type { FileVectorIndex } from "@/lib/vector-storage";
import type { DocumentFolder } from "@/lib/document-folder-storage";
import {
  getDocumentFolders,
  createDocumentFolder,
  updateDocumentFolder,
  deleteDocumentFolder,
  saveDocumentFolders,
} from "@/lib/document-folder-storage";
import {
  getFilesByThreadId,
  deleteFile,
  updateFileMetadata,
} from "@/lib/vector-storage";
import { getCurrentThreadId } from "@/lib/thread-storage";
import { DocumentDetailDialog } from "@/components/assistant-ui/document-detail-dialog";

interface DocumentTreeNode {
  id: string;
  name: string;
  type: "folder" | "document";
  parentId?: string;
  isExpanded?: boolean;
  createdAt: number;
  updatedAt: number;
  fileData?: FileVectorIndex;
}

interface DocumentTreeProps {
  onSelectDocument?: (fileId: string) => void;
  onRefresh?: () => void;
}

function buildDocumentTree(folders: DocumentFolder[], files: FileVectorIndex[]): DocumentTreeNode[] {
  const folderNodes: DocumentTreeNode[] = folders.map(f => ({
    ...f,
    type: "folder" as const,
  }));
  
  const fileNodes: DocumentTreeNode[] = files.map(f => ({
    id: f.id,
    name: f.fileName,
    type: "document" as const,
    parentId: f.folderId,
    createdAt: f.processedAt,
    updatedAt: f.processedAt,
    fileData: f,
  }));
  
  return [...folderNodes, ...fileNodes];
}

function getChildren(nodes: DocumentTreeNode[], parentId: string | undefined): DocumentTreeNode[] {
  return nodes.filter(n => n.parentId === parentId);
}

function getRootNodes(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
  return nodes.filter(n => !n.parentId);
}

export function DocumentTree({ onSelectDocument, onRefresh }: DocumentTreeProps) {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [files, setFiles] = useState<FileVectorIndex[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setFolders(getDocumentFolders());
      const threadId = getCurrentThreadId();
      if (threadId) {
        const threadFiles = await getFilesByThreadId(threadId);
        setFiles(threadFiles);
      }
    };
    loadData();
    
    const handleStorageChange = () => loadData();
    const handleFilesUpdated = () => loadData();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("files-updated", handleFilesUpdated);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("files-updated", handleFilesUpdated);
    };
  }, []);

  const nodes = buildDocumentTree(folders, files);
  const rootNodes = getRootNodes(nodes);

  const handleCreateFolder = (parentId?: string) => {
    const folder = createDocumentFolder("New Folder", parentId);
    const updated = [...folders, folder];
    setFolders(updated);
    saveDocumentFolders(updated);
  };

  const handleRenameNode = async (id: string, name: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      updateDocumentFolder(id, { name });
      setFolders(getDocumentFolders());
    } else {
      const file = files.find(f => f.id === id);
      if (file) {
        await updateFileMetadata(id, { fileName: name });
        const threadId = getCurrentThreadId();
        if (threadId) {
          const threadFiles = await getFilesByThreadId(threadId);
          setFiles(threadFiles);
        }
      }
    }
  };

  const handleDeleteNode = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      deleteDocumentFolder(id);
      setFolders(getDocumentFolders());
    } else {
      await deleteFile(id);
      const threadId = getCurrentThreadId();
      if (threadId) {
        const threadFiles = await getFilesByThreadId(threadId);
        setFiles(threadFiles);
      }
      onRefresh?.();
    }
  };

  const handleToggleFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      updateDocumentFolder(id, { isExpanded: !folder.isExpanded });
      setFolders(getDocumentFolders());
    }
  };

  const renderNode = (node: DocumentTreeNode, level: number = 0): React.ReactNode => {
    const isFolder = node.type === "folder";
    const isExpanded = isFolder ? (node.isExpanded ?? true) : false;
    const children = isFolder ? getChildren(nodes, node.id) : [];
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer group hover:bg-accent/50"
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
            <FileText className="size-4 text-muted-foreground" />
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
              className="flex-1 truncate cursor-pointer"
              onClick={() => {
                if (!isFolder) {
                  setSelectedFileId(node.id);
                  onSelectDocument?.(node.id);
                }
              }}
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
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-sm font-semibold">Documents</h3>
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
        
        <div className="space-y-0.5">
          {rootNodes.map(node => renderNode(node))}
        </div>
      </div>
      
      <DocumentDetailDialog
        fileId={selectedFileId}
        open={selectedFileId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFileId(null);
          }
        }}
        onReference={(fileId) => {
          onSelectDocument?.(fileId);
        }}
      />
    </>
  );
}

