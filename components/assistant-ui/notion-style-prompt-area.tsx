"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDroppable, useDndMonitor } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotionBlockEditor, type NotionBlock } from "./notion-block-editor";
import type { PromptItem } from "@/lib/prompt-storage";
import type { UndoRedoAction } from "@/lib/undo-redo-storage";

interface NotionStylePromptAreaProps {
  prompts: PromptItem[];
  onAddPrompt: () => void;
  onUpdatePrompt: (id: string, data: { title: string; content: string[] }) => void;
  onDeletePrompt: (id: string) => void;
  onIncludeChange: (id: string, isIncluded: boolean) => void;
  onReorder?: (oldIndex: number, newIndex: number) => void;
  onDropMessage?: (messageId: string, messageContent: string, role: "user" | "assistant") => void;
}

// 将 PromptItem 转换为 NotionBlock
function promptToBlock(prompt: PromptItem, existingBlock?: NotionBlock): NotionBlock {
  // 默认是 text block，除非明确标记为 toggle
  // 判断逻辑：如果 content 有多行，可能是 toggle block
  const hasContent = prompt.content.length > 0;
  const hasTitle = prompt.title && prompt.title.trim() !== "";
  
  // 默认是 text block，除非 content 有多行（可能是从 toggle 转换来的）
  const isToggle = hasContent && prompt.content.length > 1;
  
  // 如果既没有 content 也没有 title，返回空字符串（用于显示占位符）
  const content = hasContent 
    ? prompt.content.join("\n") 
    : (hasTitle ? prompt.title : "");
  
  return {
    id: prompt.id,
    type: isToggle ? "toggle" : "text",
    content: content,
    isExpanded: existingBlock?.isExpanded ?? false, // 保留现有的展开状态
    isIncluded: prompt.isIncluded,
  };
}

// 将 NotionBlock 转换回 PromptItem
function blockToPrompt(block: NotionBlock, originalPrompt: PromptItem): PromptItem {
  // 如果 content 为空，返回空的 title 和 content（不要生成 "Untitled"）
  if (!block.content || !block.content.trim()) {
    return {
      ...originalPrompt,
      title: "",
      content: [],
      isIncluded: block.isIncluded,
    };
  }
  
  return {
    ...originalPrompt,
    title: block.type === "toggle" 
      ? block.content.split("\n")[0] || "" 
      : block.content.substring(0, 50) || "",
    content: block.content.split("\n").filter(Boolean),
    isIncluded: block.isIncluded,
  };
}

export function NotionStylePromptArea({
  prompts,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onIncludeChange,
  onReorder,
  onDropMessage,
}: NotionStylePromptAreaProps) {
  const [blocks, setBlocks] = useState<NotionBlock[]>(() => 
    prompts.map(promptToBlock)
  );
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
  const [isDraggingMessage, setIsDraggingMessage] = useState(false);
  
  // 处理跨 block 的文本选择和删除
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 只在按下 Delete 或 Backspace 时处理
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      
      const selection = window.getSelection();
      if (!selection || !selection.toString() || selection.rangeCount === 0) return;
      
      const selectedText = selection.toString();
      const selectionRange = selection.getRangeAt(0);
      
      console.log("[NotionPromptArea] Global selection detected:", {
        selectedText: selectedText.substring(0, 100) + (selectedText.length > 100 ? "..." : ""),
        selectedLength: selectedText.length,
        key: e.key,
        startContainer: selectionRange.startContainer.nodeName,
        endContainer: selectionRange.endContainer.nodeName
      });
      
      // 检查选择是否跨越了多个 block
      const allBlockElements = document.querySelectorAll('[data-block-id]');
      const affectedBlocks: Array<{ id: string; element: Element; contentEl: Element | null }> = [];
      
      allBlockElements.forEach((blockEl) => {
        const blockId = blockEl.getAttribute('data-block-id');
        if (!blockId) return;
        
        // 获取 block 的内容元素
        const contentEl = blockEl.querySelector('[data-content]');
        if (!contentEl) return;
        
        // 检查选择是否与这个 block 的内容有交集
        try {
          if (selectionRange.intersectsNode(contentEl) || 
              contentEl.contains(selectionRange.commonAncestorContainer) ||
              selectionRange.commonAncestorContainer.contains(contentEl)) {
            affectedBlocks.push({ id: blockId, element: blockEl, contentEl });
          }
        } catch (err) {
          // 忽略错误，继续处理下一个 block
        }
      });
      
      if (affectedBlocks.length > 0) {
        console.log("[NotionPromptArea] Affected blocks:", {
          affectedBlockIds: affectedBlocks.map(b => b.id),
          blockCount: affectedBlocks.length
        });
        
        e.preventDefault();
        
        // 收集所有要删除的 blocks（用于批量删除操作）
        const blocksToDelete: Array<{ id: string; prompt: PromptItem; index: number }> = [];
        const blocksToUpdate: Array<{ id: string; oldPrompt: PromptItem; newPrompt: PromptItem; index: number }> = [];
        
        // 对每个受影响的 block 处理删除
        affectedBlocks.forEach(({ id, contentEl }) => {
          const block = blocks.find(b => b.id === id);
          if (!block || !contentEl) return;
          
          // 找到对应的 prompt
          const promptIndex = prompts.findIndex(p => p.id === id);
          if (promptIndex === -1) return;
          const prompt = prompts[promptIndex];
          
          try {
            // 计算在这个 block 内的选择范围
            const blockRange = document.createRange();
            blockRange.selectNodeContents(contentEl);
            
            // 计算交集
            let startOffset = 0;
            let endOffset = block.content.length;
            
            // 如果选择的开始在这个 block 的内容内
            if (contentEl.contains(selectionRange.startContainer) || 
                selectionRange.startContainer === contentEl ||
                (selectionRange.startContainer.nodeType === Node.TEXT_NODE && 
                 contentEl.contains(selectionRange.startContainer.parentElement))) {
              const tempRange = document.createRange();
              tempRange.selectNodeContents(contentEl);
              try {
                tempRange.setEnd(selectionRange.startContainer, selectionRange.startOffset);
                startOffset = tempRange.toString().length;
              } catch (err) {
                // 如果设置失败，使用 0
                startOffset = 0;
              }
            }
            
            // 如果选择的结束在这个 block 的内容内
            if (contentEl.contains(selectionRange.endContainer) || 
                selectionRange.endContainer === contentEl ||
                (selectionRange.endContainer.nodeType === Node.TEXT_NODE && 
                 contentEl.contains(selectionRange.endContainer.parentElement))) {
              const tempRange = document.createRange();
              tempRange.selectNodeContents(contentEl);
              try {
                tempRange.setEnd(selectionRange.endContainer, selectionRange.endOffset);
                endOffset = tempRange.toString().length;
              } catch (err) {
                // 如果设置失败，使用 block 内容的长度
                endOffset = block.content.length;
              }
            }
            
            // 确保偏移量在有效范围内
            startOffset = Math.max(0, Math.min(startOffset, block.content.length));
            endOffset = Math.max(startOffset, Math.min(endOffset, block.content.length));
            
            // 如果整个 block 都被选中，标记为删除
            if (startOffset === 0 && endOffset >= block.content.length) {
              console.log("[NotionPromptArea] Entire block selected, marking for deletion:", id);
              blocksToDelete.push({ id, prompt, index: promptIndex });
            } else if (startOffset < endOffset) {
              // 删除 block 中被选中的部分
              const deletedText = block.content.substring(startOffset, endOffset);
              const newContent = block.content.substring(0, startOffset) + 
                               block.content.substring(endOffset);
              
              console.log("[NotionPromptArea] Deleting from block:", {
                blockId: id,
                startOffset,
                endOffset,
                deletedText: deletedText.substring(0, 50) + (deletedText.length > 50 ? "..." : ""),
                deletedLength: deletedText.length,
                oldContentLength: block.content.length,
                newContentLength: newContent.length,
                newContent: newContent.substring(0, 50) + (newContent.length > 50 ? "..." : ""),
                willDeleteBlock: !newContent.trim()
              });
              
              if (!newContent.trim()) {
                console.log("[NotionPromptArea] Block is empty after deletion, marking for deletion:", id);
                blocksToDelete.push({ id, prompt, index: promptIndex });
              } else {
                // 标记为更新
                const newPrompt: PromptItem = {
                  ...prompt,
                  title: block.type === "toggle" 
                    ? newContent.split("\n")[0] || "Untitled"
                    : newContent.substring(0, 50) || "Untitled",
                  content: newContent.split("\n").filter(Boolean),
                };
                blocksToUpdate.push({ id, oldPrompt: prompt, newPrompt, index: promptIndex });
              }
            }
          } catch (err) {
            console.error("[NotionPromptArea] Error processing block:", id, err);
          }
        });
        
        // 批量处理删除和更新
        if (blocksToDelete.length > 0 || blocksToUpdate.length > 0) {
          // 创建批量操作
          const batchActions: UndoRedoAction[] = [];
          
          // 按索引倒序排序，从后往前删除，避免索引变化
          blocksToDelete.sort((a, b) => b.index - a.index);
          blocksToDelete.forEach(({ prompt, index }) => {
            batchActions.push({ type: "delete", prompt, index });
          });
          
          blocksToUpdate.forEach(({ oldPrompt, newPrompt, index }) => {
            batchActions.push({ type: "update", oldPrompt, newPrompt, index });
          });
          
          // 如果有多个操作，使用 batch 类型；否则使用单个操作
          if (batchActions.length > 1) {
            console.log("[NotionPromptArea] Batch operation:", {
              deleteCount: blocksToDelete.length,
              updateCount: blocksToUpdate.length,
              totalActions: batchActions.length
            });
            // 通过自定义事件通知 prompt-panel 进行批量操作
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("batch-delete-update", {
                  detail: { 
                    deletes: blocksToDelete,
                    updates: blocksToUpdate,
                    batchAction: { type: "batch", actions: batchActions } as UndoRedoAction
                  },
                })
              );
            }
          } else if (batchActions.length === 1) {
            // 单个操作，直接处理
            const action = batchActions[0];
            if (action.type === "delete") {
              onDeletePrompt(action.prompt.id);
            } else if (action.type === "update") {
              onUpdatePrompt(action.oldPrompt.id, {
                title: action.newPrompt.title,
                content: action.newPrompt.content,
              });
            }
          }
        }
        
        // 清除选择
        selection.removeAllRanges();
      }
    };
    
    window.addEventListener("keydown", handleGlobalKeyDown, true); // 使用 capture phase
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [blocks, onDeletePrompt, onUpdatePrompt]);

  const { setNodeRef, isOver } = useDroppable({
    id: "prompt-area",
  });

  // 监听拖拽状态 - 通过全局事件监听
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleDragStart = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string }>).detail;
      console.log("[NotionPromptArea] Drag start event:", detail);
      if (detail?.type === "message") {
        console.log("[NotionPromptArea] Setting isDraggingMessage to true");
        setIsDraggingMessage(true);
      }
    };

    const handleDragOver = (event: Event) => {
      const detail = (event as CustomEvent<{ 
        overId?: string | null; 
        activeType?: string;
        insertPosition?: "before" | "after";
        mouseY?: number;
      }>).detail;
      console.log("[NotionPromptArea] Drag over event:", detail, "blocks:", blocks.length);
      if (detail?.activeType === "message") {
        if (detail?.overId) {
          const overId = detail.overId;
          const insertPosition = detail.insertPosition || "after";
          setDragOverPosition(insertPosition);
          
          // 检查是否在某个 block 上方
          if (overId.startsWith("block-")) {
            const blockId = overId.replace("block-", "");
            const index = blocks.findIndex(b => b.id === blockId);
            console.log("[NotionPromptArea] Over block:", blockId, "index:", index, "position:", insertPosition);
            if (index !== -1) {
              // 根据 insertPosition 决定显示在哪一侧
              setDragOverIndex(insertPosition === "before" ? index : index + 1);
            } else {
              setDragOverIndex(null);
            }
          } else if (overId === "prompt-area") {
            // 在区域底部，但需要根据鼠标位置判断是否应该插入到某个 block 之间
            if (detail.mouseY !== undefined) {
              // 根据鼠标 Y 坐标找到对应的 block
              const blockElements = document.querySelectorAll('[data-block-id]');
              let targetIndex = blocks.length;
              
              for (let i = 0; i < blockElements.length; i++) {
                const el = blockElements[i];
                const rect = el.getBoundingClientRect();
                // 如果鼠标在这个 block 的上半部分，插入到它前面
                if (detail.mouseY < rect.top + rect.height * 0.4) {
                  targetIndex = i;
                  setDragOverPosition("before");
                  break;
                } else if (detail.mouseY < rect.bottom) {
                  // 如果鼠标在这个 block 的下半部分，插入到它后面
                  targetIndex = i + 1;
                  setDragOverPosition("after");
                  break;
                }
              }
              
              setDragOverIndex(targetIndex);
              console.log("[NotionPromptArea] Over prompt-area, calculated index:", targetIndex, "from mouseY:", detail.mouseY);
            } else {
              // 在区域底部
              console.log("[NotionPromptArea] Over prompt-area, setting index to:", blocks.length);
              setDragOverIndex(blocks.length);
            }
          } else {
            console.log("[NotionPromptArea] Unknown overId:", overId);
            setDragOverIndex(null);
          }
        } else {
          setDragOverIndex(null);
          setDragOverPosition(null);
        }
      } else {
        setDragOverIndex(null);
        setDragOverPosition(null);
      }
    };

    const handleDragEnd = () => {
      console.log("[NotionPromptArea] Drag end event");
      setIsDraggingMessage(false);
      setDragOverIndex(null);
      setDragOverPosition(null);
    };

    window.addEventListener("dnd-drag-start", handleDragStart);
    window.addEventListener("dnd-drag-over", handleDragOver);
    window.addEventListener("dnd-drag-end", handleDragEnd);
    
    return () => {
      window.removeEventListener("dnd-drag-start", handleDragStart);
      window.removeEventListener("dnd-drag-over", handleDragOver);
      window.removeEventListener("dnd-drag-end", handleDragEnd);
    };
  }, [blocks]);

      // 同步 prompts 变化到 blocks（保留展开状态），过滤掉空内容的 block，确保 id 唯一
  useEffect(() => {
    setBlocks((prevBlocks) => {
      const blockMap = new Map(prevBlocks.map(b => [b.id, b]));
      const seenIds = new Set<string>();
      const seenPromptIds = new Set<string>();
      
      console.log("[NotionPromptArea] Syncing prompts to blocks:", {
        promptCount: prompts.length,
        prevBlockCount: prevBlocks.length,
        promptIds: prompts.map(p => p.id),
        prevBlockIds: prevBlocks.map(b => b.id),
      });
      
      // 先过滤 prompts，确保每个 prompt id 只出现一次
      const uniquePrompts = prompts.filter((prompt, index) => {
        if (seenPromptIds.has(prompt.id)) {
          console.warn("[NotionPromptArea] Duplicate prompt id detected:", prompt.id, "at index", index);
          return false;
        }
        seenPromptIds.add(prompt.id);
        return true;
      });
      
      // 检查是否有 blocks 不在 prompts 中（这些是新建的空 blocks，还没有对应的 prompt）
      const blocksWithoutPrompts = prevBlocks.filter(b => !prompts.find(p => p.id === b.id));
      console.log("[NotionPromptArea] Blocks without prompts (new empty blocks):", {
        count: blocksWithoutPrompts.length,
        ids: blocksWithoutPrompts.map(b => b.id),
      });
      
      const newBlocks = uniquePrompts
        .map(prompt => {
          const existingBlock = blockMap.get(prompt.id);
          // 如果 block 已存在，保留其 isExpanded 状态
          const newBlock = promptToBlock(prompt, existingBlock);
          // 如果 existingBlock 存在，保留其 isExpanded 状态（除非 prompt 内容变化导致需要重新计算）
          if (existingBlock) {
            // 完全保留 existingBlock 的 isExpanded 状态
            newBlock.isExpanded = existingBlock.isExpanded;
          }
          return newBlock;
        })
        .filter((block) => {
          // 允许空的 block 显示（用于占位符），但确保 block id 唯一
          // 空的 block 会在用户没有输入内容时被自动删除（在 handleBlockUpdate 中处理）
          if (seenIds.has(block.id)) {
            console.warn("[NotionPromptArea] Duplicate block id detected:", block.id);
            return false;
          }
          seenIds.add(block.id);
          return true;
        });
      
      // 合并新建的空 blocks（还没有对应的 prompt）
      const finalBlocks = [...newBlocks, ...blocksWithoutPrompts];
      
      // 只在 block 数量变化时记录日志，减少日志输出
      const prevBlockCount = prevBlocks.length;
      if (finalBlocks.length !== prevBlockCount) {
        console.log("[NotionPromptArea] Final blocks:", {
          promptCount: uniquePrompts.length,
          blockCount: finalBlocks.length,
          prevBlockCount,
          newEmptyBlocksCount: blocksWithoutPrompts.length,
        });
      }
      
      return finalBlocks;
    });
  }, [prompts]);

  const handleBlockUpdate = useCallback((id: string, updates: Partial<NotionBlock>) => {
    setBlocks((prev) => {
      const updated = prev.map((b) => {
        if (b.id === id) {
          return { ...b, ...updates };
        }
        return b;
      });
      
      // 注意：不要在这里删除空的 block
      // 空的 block 应该由用户交互（blur 事件）来删除
      // 这样可以避免新建的空 block 被立即删除
      
      return updated;
    });
  }, []);
  
  // 同步 blocks 变化到 prompts（延迟执行，避免在渲染期间更新父组件）
  useEffect(() => {
    // 使用 setTimeout 确保在渲染完成后执行
    const timeoutId = setTimeout(() => {
      console.log("[NotionPromptArea] Syncing blocks to prompts:", {
        blockCount: blocks.length,
        promptCount: prompts.length,
        blockIds: blocks.map(b => b.id),
        promptIds: prompts.map(p => p.id),
      });
      
      // 检查是否有 block 被删除（在 prompts 中存在但在 blocks 中不存在）
      prompts.forEach((prompt) => {
        const block = blocks.find((b) => b.id === prompt.id);
        if (!block) {
          console.log("[NotionPromptArea] Block deleted, removing prompt:", prompt.id);
          // Block 被删除，但 prompt 还存在，删除 prompt
          onDeletePrompt(prompt.id);
        }
      });
      
      // 同步 blocks 到 prompts（只同步内容变化，不处理 isExpanded）
      blocks.forEach((block) => {
        const isEmpty = !block.content || !block.content.trim();
        console.log("[NotionPromptArea] Processing block:", {
          blockId: block.id,
          isEmpty,
          contentLength: block.content?.length || 0,
          contentPreview: block.content?.substring(0, 20) || "",
        });
        
        const prompt = prompts.find((p) => p.id === block.id);
        if (prompt) {
          // 检查是否需要更新（只检查内容和标题，不检查 isExpanded）
          const updatedPrompt = blockToPrompt(block, prompt);
          const updatedIsEmpty = !updatedPrompt.content || updatedPrompt.content.length === 0 || 
              (updatedPrompt.content.length === 1 && !updatedPrompt.content[0].trim());
          
          console.log("[NotionPromptArea] Block has prompt:", {
            blockId: block.id,
            updatedIsEmpty,
            updatedContentLength: updatedPrompt.content.length,
            willDelete: updatedIsEmpty,
          });
          
          // 如果更新后的内容为空，删除 prompt（用户没有输入内容）
          // 但要注意：新建的 block 在用户还没有输入时，不应该立即删除
          // 只有在用户 blur 且内容仍为空时才删除
          // 这里我们暂时不删除，让 blur 事件来处理
          if (!updatedIsEmpty) {
            if (updatedPrompt.title !== prompt.title || 
                JSON.stringify(updatedPrompt.content) !== JSON.stringify(prompt.content)) {
              console.log("[NotionPromptArea] Updating prompt:", {
                blockId: block.id,
                oldTitle: prompt.title,
                newTitle: updatedPrompt.title,
              });
              onUpdatePrompt(block.id, {
                title: updatedPrompt.title,
                content: updatedPrompt.content,
              });
            }
          }
        } else {
          // 如果 prompt 不存在，且 block 有内容，创建一个新的
          // 如果 block 内容为空，不要创建 prompt（让用户先输入内容）
          if (block.content && block.content.trim()) {
            console.log("[NotionPromptArea] Creating new prompt for block:", block.id);
            const newPrompt: PromptItem = {
              id: block.id,
              title: block.type === "toggle" 
                ? block.content.split("\n")[0] || ""
                : block.content.substring(0, 50) || "",
              content: block.content.split("\n").filter(Boolean),
              isIncluded: block.isIncluded ?? true,
            };
            onUpdatePrompt(block.id, {
              title: newPrompt.title,
              content: newPrompt.content,
            });
          } else {
            console.log("[NotionPromptArea] Block is empty, not creating prompt:", block.id);
          }
        }
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [blocks, prompts, onUpdatePrompt, onDeletePrompt]);

  const handleAddBlock = useCallback(() => {
    // 直接调用 onAddPrompt，它会在 prompts 中添加新的 prompt
    // blocks 会在 useEffect 中自动同步
    onAddPrompt();
    
    // 等待新 block 添加到 DOM 后，自动聚焦到它
    setTimeout(() => {
      // 找到最后一个 block（新添加的）
      const blockElements = document.querySelectorAll('[data-block-id]');
      if (blockElements.length > 0) {
        const lastBlock = blockElements[blockElements.length - 1];
        const blockId = lastBlock.getAttribute('data-block-id');
        if (blockId) {
          // 设置 focus 状态，触发编辑模式
          setFocusedBlockId(blockId);
          // 点击 block 内容区域，触发编辑
          const contentEl = lastBlock.querySelector('[data-content]') as HTMLElement;
          if (contentEl) {
            contentEl.click();
          }
        }
      }
    }, 50);
  }, [onAddPrompt]);

  const handleBlockDelete = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    // 使用 setTimeout 避免在渲染期间更新父组件
    setTimeout(() => {
      onDeletePrompt(id);
    }, 0);
  }, [onDeletePrompt]);

  const handleBlockIncludeChange = useCallback((id: string, isIncluded: boolean) => {
    setBlocks((prev) => 
      prev.map((b) => b.id === id ? { ...b, isIncluded } : b)
    );
    onIncludeChange(id, isIncluded);
  }, [onIncludeChange]);

  // 处理拖拽消息 - 只通过 onDropMessage prop，不在这里直接处理
  // 这样可以确保 prompt-panel 中的 handleDropMessage 统一处理

  const handleConvertToToggle = useCallback((id: string) => {
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (!block || block.type === "toggle") return prev;
      
      // 将 text block 转换为 toggle block
      // 将内容的第一行作为 title，其余作为 content
      const lines = block.content.split("\n").filter(Boolean);
      const title = lines[0] || "New toggle";
      const content = lines.length > 1 ? lines.slice(1).join("\n") : title;
      
      return prev.map((b) => 
        b.id === id ? { 
          ...b, 
          type: "toggle", 
          isExpanded: false,
          content: content
        } : b
      );
    });
    
    // 同步回 prompts - 使用 setTimeout 避免在渲染期间更新
    setTimeout(() => {
      const block = blocks.find((b) => b.id === id);
      if (block && block.type === "toggle") {
        const contentLines = block.content.split("\n").filter(Boolean);
        const title = contentLines[0] || "New toggle";
        const prompt = prompts.find((p) => p.id === id);
        if (prompt) {
          // 更新现有 prompt
          onUpdatePrompt(id, {
            title: title,
            content: contentLines.length > 1 ? contentLines : [title, ""], // 确保有多个元素
          });
        } else {
          // 如果 prompt 不存在，创建一个新的
          onUpdatePrompt(id, {
            title: title,
            content: contentLines.length > 1 ? contentLines : [title, ""],
          });
        }
      }
    }, 0);
  }, [blocks, prompts, onUpdatePrompt]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-1 transition-colors",
        isOver && "bg-primary/5"
      )}
    >

      <SortableContext
        items={blocks.map((b) => `block-${b.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {blocks.map((block, index) => (
            <div key={block.id} className="relative" data-block-id={block.id} data-block-content={block.content}>
              {/* 拖拽指示器 - 在 block 上方（before）或下方（after） */}
              {isDraggingMessage && dragOverIndex === index && dragOverPosition === "before" && (
                <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10" />
              )}
              <NotionBlockEditor
                id={block.id}
                block={block}
                isFocused={focusedBlockId === block.id}
                onUpdate={handleBlockUpdate}
                onDelete={handleBlockDelete}
                onIncludeChange={handleBlockIncludeChange}
                onFocus={setFocusedBlockId}
                onConvertToToggle={handleConvertToToggle}
                dragHandle={true}
              />
              {/* 拖拽指示器 - 在 block 下方（after） */}
              {isDraggingMessage && dragOverIndex === index + 1 && dragOverPosition === "after" && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10" />
              )}
            </div>
          ))}
          {/* 拖拽指示器 - 在最后一个 block 之后 */}
          {isDraggingMessage && dragOverIndex === blocks.length && (
            <div className="h-0.5 bg-blue-400 rounded-full -mt-0.5 mb-1" />
          )}
          {/* 点击空白区域添加新 block */}
          <div
            onClick={handleAddBlock}
            className="text-sm text-muted-foreground/50 hover:text-muted-foreground cursor-text py-2 px-1 rounded hover:bg-muted/30 transition-colors"
          >
            <span className="italic">+ Add new block</span>
          </div>
        </div>
      </SortableContext>

      {blocks.length === 0 && (
        <div 
          className="text-center py-8 text-sm text-muted-foreground px-1 cursor-text hover:bg-muted/50 rounded transition-colors"
          onClick={handleAddBlock}
        >
          <p>Click here to start writing...</p>
        </div>
      )}
    </div>
  );
}

