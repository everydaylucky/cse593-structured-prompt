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
import type { TreeNode, TreeNodeWithChildren, PromptCollection, PromptFolder } from "@/lib/prompt-storage";
import {
  createCollection,
  createFolder,
  addCollection,
  addFolder,
  updateFolder,
  updateCollection,
  deleteNode,
  moveNode,
  buildTree,
  getNode,
} from "@/lib/prompt-storage";

interface CollectionTreeProps {
  currentCollectionId: string | null;
  onSelectCollection: (id: string) => void;
  onRefresh: () => void;
}

function DraggableTreeNode({ 
  node, 
  level, 
  isExpanded, 
  isSelected, 
  isEditing, 
  editName, 
  onToggleFolder, 
  onRenameNode, 
  onSaveRename, 
  onDeleteNode, 
  onCreateFolder, 
  onCreatePage, 
  onSelectCollection,
  onEditNameChange,
  onEditNameEscape
}: {
  node: TreeNodeWithChildren;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editName: string;
  onToggleFolder: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onSaveRename: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onCreatePage: (parentId?: string) => void;
  onSelectCollection: (id: string) => void;
  onEditNameChange: (value: string) => void;
  onEditNameEscape: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `tree-node-${node.id}`,
    data: {
      type: "tree-node",
      nodeId: node.id,
      nodeType: node.type,
    },
  });

  const {
    setNodeRef: setDroppableRef,
    isOver,
  } = useDroppable({
    id: `tree-drop-${node.id}`,
    data: {
      type: "tree-drop",
      nodeId: node.id,
      nodeType: node.type,
    },
  });

  const indent = level * 20;
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const setNodeRef = (element: HTMLElement | null) => {
    setDraggableRef(element);
    setDroppableRef(element);
  };

  if (node.type === "folder") {
    return (
      <div>
        <div
          ref={setNodeRef}
          style={{ ...style, paddingLeft: `${8 + indent}px` }}
          className={cn(
            "group flex items-center gap-1 px-2 py-1 rounded hover:bg-muted cursor-pointer",
            isSelected && "bg-accent",
            isDragging && "opacity-50",
            isOver && "bg-blue-100 dark:bg-blue-900"
          )}
        >
          <button
            onClick={() => onToggleFolder(node.id)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
          </button>
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
          >
            <GripVertical className="size-3 text-muted-foreground" />
          </div>
          <Folder className="size-4 text-blue-500" />
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => {/* handled by parent */}}
              onBlur={() => onSaveRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSaveRename(node.id);
                } else if (e.key === "Escape") {
                  onEditNameEscape();
                }
              }}
              className="flex-1 px-1 text-sm border rounded"
              autoFocus
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
            />
          ) : (
            <>
              <span className="flex-1 text-sm truncate">{node.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onCreateFolder(node.id)}>
                    <Plus className="size-4 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreatePage(node.id)}>
                    <Plus className="size-4 mr-2" />
                    New Page
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRenameNode(node.id, node.name)}>
                    <Pencil className="size-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDeleteNode(node.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map(child => (
              <DraggableTreeNode
                key={child.id}
                node={child}
                level={level + 1}
                isExpanded={false}
                isSelected={false}
                isEditing={isEditing && child.id === node.id}
                editName={editName}
                onToggleFolder={onToggleFolder}
                onRenameNode={onRenameNode}
                onSaveRename={onSaveRename}
                onDeleteNode={onDeleteNode}
                onCreateFolder={onCreateFolder}
                onCreatePage={onCreatePage}
                onSelectCollection={onSelectCollection}
                onEditNameChange={onEditNameChange}
                onEditNameEscape={onEditNameEscape}
              />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, paddingLeft: `${8 + indent}px` }}
        className={cn(
          "group flex items-center gap-1 px-2 py-1 rounded hover:bg-muted cursor-pointer",
          isSelected && "bg-accent",
          isDragging && "opacity-50",
          isOver && "bg-blue-100 dark:bg-blue-900"
        )}
        onClick={() => onSelectCollection(node.id)}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
        >
          <GripVertical className="size-3 text-muted-foreground" />
        </div>
        <FileText className="size-4 text-muted-foreground" />
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => {/* handled by parent */}}
            onBlur={() => onSaveRename(node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSaveRename(node.id);
              } else if (e.key === "Escape") {
                onEditNameEscape();
              }
            }}
            className="flex-1 px-1 text-sm border rounded"
            autoFocus
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
          />
        ) : (
          <>
            <span className="flex-1 text-sm truncate">{node.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onRenameNode(node.id, node.name)}>
                  <Pencil className="size-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeleteNode(node.id)}
                  className="text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    );
  }
}

export function CollectionTree({ currentCollectionId, onSelectCollection, onRefresh }: CollectionTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // 监听 tree-node-moved 事件，刷新树
  useEffect(() => {
    const handleTreeNodeMoved = () => {
      onRefresh();
    };
    
    if (typeof window !== "undefined") {
      window.addEventListener("tree-node-moved", handleTreeNodeMoved);
      return () => {
        window.removeEventListener("tree-node-moved", handleTreeNodeMoved);
      };
    }
  }, [onRefresh]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleCreateFolder = useCallback((parentId?: string) => {
    const name = prompt("Enter folder name:", "New Folder");
    if (!name || !name.trim()) return;
    
    const newFolder = createFolder(name.trim(), parentId);
    addFolder(newFolder);
    if (parentId) {
      setExpandedFolders(prev => new Set(prev).add(parentId));
    }
    onRefresh();
  }, [onRefresh]);

  const handleCreatePage = useCallback((parentId?: string) => {
    const name = prompt("Enter page name:", "New Page");
    if (!name || !name.trim()) return;
    
    const newCollection = createCollection(name.trim(), [], parentId);
    addCollection(newCollection);
    if (parentId) {
      setExpandedFolders(prev => new Set(prev).add(parentId));
    }
    onSelectCollection(newCollection.id);
    onRefresh();
  }, [onSelectCollection, onRefresh]);

  const handleRenameNode = useCallback((nodeId: string, currentName: string) => {
    setEditingNodeId(nodeId);
    setEditName(currentName);
  }, []);

  const handleSaveRename = useCallback((nodeId: string) => {
    if (!editName.trim()) {
      setEditingNodeId(null);
      return;
    }
    
    const node = getNode(nodeId);
    if (!node) return;
    
    if (node.type === "folder") {
      updateFolder(nodeId, { name: editName.trim() });
    } else {
      updateCollection(nodeId, { name: editName.trim() });
    }
    
    setEditingNodeId(null);
    setEditName("");
    onRefresh();
  }, [editName, onRefresh]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    
    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;
    
    deleteNode(nodeId);
    onRefresh();
  }, [onRefresh]);


  const tree = buildTree();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-muted-foreground">Collections</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Plus className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleCreateFolder()}>
              <Folder className="size-4 mr-2" />
              New Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreatePage()}>
              <FileText className="size-4 mr-2" />
              New Page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col">
        {tree.map(node => {
          const isExpanded = expandedFolders.has(node.id);
          const isSelected = currentCollectionId === node.id && node.type === "page";
          const isEditing = editingNodeId === node.id;
          
          return (
            <DraggableTreeNode
              key={node.id}
              node={node}
              level={0}
              isExpanded={isExpanded}
              isSelected={isSelected}
              isEditing={isEditing}
              editName={editName}
              onToggleFolder={toggleFolder}
              onRenameNode={handleRenameNode}
              onSaveRename={handleSaveRename}
              onDeleteNode={handleDeleteNode}
              onCreateFolder={handleCreateFolder}
              onCreatePage={handleCreatePage}
              onSelectCollection={onSelectCollection}
              onEditNameChange={setEditName}
              onEditNameEscape={() => {
                setEditingNodeId(null);
                setEditName("");
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

