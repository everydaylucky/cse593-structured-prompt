"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { ChevronRight, Plus, GripVertical, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NotionBlock {
  id: string;
  type: "text" | "toggle";
  content: string;
  isExpanded?: boolean;
  isIncluded: boolean;
}

interface NotionBlockEditorProps {
  id: string;
  block: NotionBlock;
  isFocused?: boolean;
  onUpdate: (id: string, block: Partial<NotionBlock>) => void;
  onDelete: (id: string) => void;
  onIncludeChange: (id: string, isIncluded: boolean) => void;
  onFocus?: (id: string | null) => void;
  onConvertToToggle?: (id: string) => void;
  dragHandle?: boolean;
}

export function NotionBlockEditor({
  id,
  block,
  isFocused = false,
  onUpdate,
  onDelete,
  onIncludeChange,
  onFocus,
  onConvertToToggle,
  dragHandle = false,
}: NotionBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(block.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isClickingArrowRef = useRef(false);
  
  // 同步 block 的变化到本地状态
  useEffect(() => {
    setLocalContent(block.content);
  }, [block.content, id]);
  
  // 单独处理 isExpanded 的变化，确保折叠时退出编辑状态
  useEffect(() => {
    // 如果 block 被折叠，确保退出编辑状态
    if (!block.isExpanded && isEditing) {
      console.log("[NotionBlockEditor] Block collapsed, exiting edit mode");
      setIsEditing(false);
    }
  }, [block.isExpanded, isEditing]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `block-${id}`, disabled: !dragHandle });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContentChange = (newContent: string) => {
    const oldContent = localContent;
    setLocalContent(newContent);
    
    console.log("[NotionBlockEditor] Content changed:", {
      blockId: id,
      oldLength: oldContent.length,
      newLength: newContent.length,
      willDeleteBlock: !newContent.trim()
    });
    
    // 如果内容为空，删除该 block
    if (!newContent.trim()) {
      console.log("[NotionBlockEditor] Block is empty, deleting block:", id);
      onDelete(id);
      return;
    }
    onUpdate(id, { content: newContent });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setLocalContent(block.content);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // 检查是否正在点击箭头按钮
    if (isClickingArrowRef.current) {
      console.log("[NotionBlockEditor] Blur ignored - clicking arrow button");
      // 延迟重置标志，确保 onClick 能执行
      setTimeout(() => {
        isClickingArrowRef.current = false;
      }, 100);
      return;
    }
    
    // 检查是否点击了箭头按钮（通过检查 relatedTarget）
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isClickingArrow = relatedTarget && (
      relatedTarget.closest('button[data-toggle-arrow]') ||
      relatedTarget.closest('[data-toggle-arrow]')
    );
    
    console.log("[NotionBlockEditor] Blur event:", {
      blockId: id,
      contentLength: localContent.length,
      willDeleteBlock: !localContent.trim(),
      relatedTarget: relatedTarget?.tagName,
      isClickingArrow,
      isClickingArrowRef: isClickingArrowRef.current,
      relatedTargetClasses: relatedTarget?.className
    });
    
    if (isClickingArrow) {
      // 如果点击了箭头按钮，不处理 blur，让箭头按钮的 onClick 处理
      console.log("[NotionBlockEditor] Blur ignored - clicking arrow button (relatedTarget)");
      return;
    }
    
    setIsEditing(false);
    onFocus?.(null); // 清除 focus 状态
    
    // 如果内容为空，删除该 block
    if (!localContent.trim()) {
      console.log("[NotionBlockEditor] Block is empty on blur, deleting block:", id);
      onDelete(id);
      return;
    }
    onUpdate(id, { content: localContent });
  };

  const handleClick = () => {
    // 对于 toggle block，点击内容区域应该展开并进入编辑状态
    if (block.type === "toggle" && !block.isExpanded) {
      onUpdate(id, { isExpanded: true });
    }
    setIsEditing(true);
    onFocus?.(id);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };
  
  // 检查内容是否为空（用于显示占位符）
  const isEmpty = !localContent || localContent.trim().length === 0;
  const placeholder = "Type something...";

  // 处理非编辑状态下的文本选择和删除
  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 如果按下了 Delete 或 Backspace，且有选中的文本
    if ((e.key === "Delete" || e.key === "Backspace")) {
      const selection = window.getSelection();
      const selectedText = selection?.toString();
      
      if (selectedText) {
        console.log("[NotionBlockEditor] Selected text:", {
          blockId: id,
          selectedText: selectedText.substring(0, 50) + (selectedText.length > 50 ? "..." : ""),
          selectedLength: selectedText.length,
          key: e.key
        });
        
        e.preventDefault();
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // 检查选中的文本是否在当前 block 内
          const contentElement = contentRef.current;
          const isWithinBlock = contentElement && (
            contentElement.contains(range.commonAncestorContainer) ||
            range.commonAncestorContainer === contentElement ||
            (range.commonAncestorContainer.nodeType === Node.TEXT_NODE && 
             contentElement.contains(range.commonAncestorContainer.parentElement))
          );
          
          if (isWithinBlock) {
            // 选中的文本在当前 block 内
            // 获取当前 block 内的文本节点
            const textNode = contentElement.querySelector('div') || contentElement;
            const textContent = textNode.textContent || "";
            
            // 计算在当前 block 内的偏移量
            let startOffset = 0;
            let endOffset = textContent.length;
            
            // 如果 range 的起始节点在当前 block 内
            if (contentElement.contains(range.startContainer) || range.startContainer === contentElement) {
              // 创建一个新的 range 来计算偏移量
              const blockRange = document.createRange();
              blockRange.selectNodeContents(contentElement);
              blockRange.setEnd(range.startContainer, range.startOffset);
              startOffset = blockRange.toString().length;
            }
            
            // 如果 range 的结束节点在当前 block 内
            if (contentElement.contains(range.endContainer) || range.endContainer === contentElement) {
              const blockRange = document.createRange();
              blockRange.selectNodeContents(contentElement);
              blockRange.setEnd(range.endContainer, range.endOffset);
              endOffset = blockRange.toString().length;
            }
            
            // 确保偏移量在有效范围内
            startOffset = Math.max(0, Math.min(startOffset, localContent.length));
            endOffset = Math.max(startOffset, Math.min(endOffset, localContent.length));
            
            const deletedText = localContent.substring(startOffset, endOffset);
            const newContent = localContent.substring(0, startOffset) + localContent.substring(endOffset);
            
            console.log("[NotionBlockEditor] Deleting from block:", {
              blockId: id,
              startOffset,
              endOffset,
              deletedText: deletedText.substring(0, 50) + (deletedText.length > 50 ? "..." : ""),
              deletedLength: deletedText.length,
              oldContentLength: localContent.length,
              newContentLength: newContent.length,
              newContent: newContent.substring(0, 50) + (newContent.length > 50 ? "..." : ""),
              willDeleteBlock: !newContent.trim()
            });
            
            setLocalContent(newContent);
            onUpdate(id, { content: newContent });
            
            // 如果内容为空，删除该 block
            if (!newContent.trim()) {
              console.log("[NotionBlockEditor] Block is empty, deleting block:", id);
              onDelete(id);
            }
          } else {
            // 选中的文本跨越了多个 block
            console.log("[NotionBlockEditor] Selection spans multiple blocks:", {
              blockId: id,
              commonAncestor: range.commonAncestorContainer.nodeName,
              isInBlock: contentElement?.contains(range.commonAncestorContainer)
            });
            // 对于跨 block 的选择，我们只清除选择，不删除内容
            // 因为删除跨 block 的内容需要更复杂的逻辑
            selection.removeAllRanges();
          }
          
          // 清除选择
          selection.removeAllRanges();
        }
      }
    }
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [isEditing, localContent]);

  if (block.type === "toggle") {
    return (
      <div
        ref={dragHandle ? setNodeRef : undefined}
        style={dragHandle ? style : undefined}
        className={cn(
          "group relative flex items-start gap-2 py-1",
          isDragging && "opacity-50"
        )}
      >
      {dragHandle && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className="mt-1.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing px-2 py-1.5 text-sm rounded-sm hover:bg-accent"
              onClick={(e) => e.stopPropagation()}
            >
              Drag to reorder
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

        <button
          onMouseDown={(e) => {
            // 在 mousedown 时设置标志，阻止 textarea 的 blur 事件
            isClickingArrowRef.current = true;
            e.preventDefault();
            e.stopPropagation();
            console.log("[NotionBlockEditor] Arrow button mousedown:", {
              blockId: id,
              isExpanded: block.isExpanded,
              isEditing,
              isClickingArrowRef: isClickingArrowRef.current
            });
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log("[NotionBlockEditor] Arrow button clicked:", {
              blockId: id,
              isExpanded: block.isExpanded,
              isEditing,
              currentContentLength: localContent.length,
              isClickingArrowRef: isClickingArrowRef.current
            });
            
            // 如果当前是展开状态（向下箭头），点击后应该折叠并退出编辑
            if (block.isExpanded) {
              console.log("[NotionBlockEditor] Collapsing toggle and exiting edit mode");
              // 先退出编辑状态
              setIsEditing(false);
              // 清除 focus 状态
              onFocus?.(null);
              // 然后折叠 - 立即更新，不使用 setTimeout
              console.log("[NotionBlockEditor] Calling onUpdate with isExpanded: false");
              onUpdate(id, { isExpanded: false });
              // 确保 textarea 失去焦点（但不触发 blur 处理）
              if (textareaRef.current) {
                textareaRef.current.blur();
              }
              // 重置标志
              setTimeout(() => {
                isClickingArrowRef.current = false;
              }, 100);
            } else {
              console.log("[NotionBlockEditor] Expanding toggle and entering edit mode");
              // 如果当前是折叠状态（>），点击后应该展开并进入编辑
              console.log("[NotionBlockEditor] Calling onUpdate with isExpanded: true");
              onUpdate(id, { isExpanded: true });
              setIsEditing(true);
              onFocus?.(id);
              setTimeout(() => {
                textareaRef.current?.focus();
                isClickingArrowRef.current = false;
              }, 0);
            }
          }}
          data-toggle-arrow
          className="mt-1 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              block.isExpanded && "rotate-90"
            )}
          />
        </button>

        <div className="flex-1 min-w-0">
          {isEditing || isFocused ? (
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full text-sm bg-transparent border-none outline-none resize-none overflow-hidden whitespace-pre-wrap"
              style={{ minHeight: "1.5rem" }}
              rows={1}
              placeholder="Toggle content..."
            />
          ) : (
            <div
              ref={contentRef}
              onClick={handleClick}
              onKeyDown={handleContentKeyDown}
              contentEditable={false}
              suppressContentEditableWarning
              data-content
              className="text-sm cursor-text hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors min-h-[1.5rem] select-text"
            >
              {/* 非编辑状态：根据 isExpanded 决定显示截断还是完整内容 */}
              {block.isExpanded ? (
                <div className="text-muted-foreground whitespace-pre-wrap select-text">
                  {isEmpty ? (
                    <span className="text-muted-foreground/50 italic">{placeholder}</span>
                  ) : (
                    localContent
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground line-clamp-2 select-text">
                  {isEmpty ? (
                    <span className="text-muted-foreground/50 italic">{placeholder}</span>
                  ) : (
                    localContent
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!block.isIncluded && (
            <button
              onClick={() => onDelete(id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
              title="Delete"
            >
              <X className="size-4" />
            </button>
          )}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={block.isIncluded}
              onChange={(e) => onIncludeChange(id, e.target.checked)}
              className="sr-only peer"
            />
            <div className={cn(
              "w-4 h-4 rounded border-2 transition-colors flex items-center justify-center",
              block.isIncluded
                ? "bg-yellow-400 border-yellow-400"
                : "bg-transparent border-yellow-400"
            )}>
              {block.isIncluded && (
                <Check className="size-3 text-yellow-900" />
              )}
            </div>
          </label>
        </div>
      </div>
    );
  }

  // Text block
  return (
    <div
      ref={dragHandle ? setNodeRef : undefined}
      style={dragHandle ? style : undefined}
      className={cn(
        "group relative flex items-start gap-2 py-1",
        isDragging && "opacity-50"
      )}
    >
      {dragHandle && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className="mt-1.5 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {block.type === "text" && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToToggle?.(id);
                }}
              >
                Turn into toggle
              </DropdownMenuItem>
            )}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing px-2 py-1.5 text-sm rounded-sm hover:bg-accent"
              onClick={(e) => e.stopPropagation()}
            >
              Drag to reorder
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex-1 min-w-0">
        {isEditing || isFocused ? (
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-transparent border-none outline-none resize-none overflow-hidden"
            style={{ minHeight: "1.5rem" }}
            rows={1}
            placeholder={placeholder}
          />
        ) : (
          <div
            ref={contentRef}
            onClick={handleClick}
            onKeyDown={handleContentKeyDown}
            contentEditable={false}
            suppressContentEditableWarning
            data-content
            className="text-sm cursor-text hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors min-h-[1.5rem] whitespace-pre-wrap select-text"
            tabIndex={0}
          >
            {isEmpty ? (
              <span className="text-muted-foreground/50 italic">{placeholder}</span>
            ) : (
              localContent
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!block.isIncluded && (
          <button
            onClick={() => onDelete(id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <X className="size-4" />
          </button>
        )}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={block.isIncluded}
            onChange={(e) => onIncludeChange(id, e.target.checked)}
            className="sr-only peer"
          />
          <div className={cn(
            "w-4 h-4 rounded border-2 transition-colors flex items-center justify-center",
            block.isIncluded
              ? "bg-yellow-400 border-yellow-400"
              : "bg-transparent border-yellow-400"
          )}>
            {block.isIncluded && (
              <Check className="size-3 text-yellow-900" />
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

