/**
 * 文档引用解析器
 * 解析消息中的文档引用（#document-id）
 */

export interface DocumentMention {
  fileId: string;
  fileName?: string;
}

export interface ParsedDocuments {
  hasDocumentMention: boolean;
  documents: DocumentMention[];
  cleanedContent: string;
}

/**
 * 检查是否应该显示文档选择器
 * 规则：检查光标位置是否在 # 后面，且 # 后面还没有完整的 mention
 * 允许在 @mention 后面使用 #mention
 */
export function shouldShowDocumentPopover(
  text: string,
  cursorPosition: number
): { show: boolean; query: string } {
  const textBeforeCursor = text.substring(0, cursorPosition);
  
  // 查找光标前最近的 # 符号
  const lastHashIndex = textBeforeCursor.lastIndexOf('#');
  
  if (lastHashIndex === -1) {
    return { show: false, query: '' };
  }
  
  // 检查 # 后面到光标之间的内容
  const afterHash = textBeforeCursor.substring(lastHashIndex + 1);
  const spaceIndex = afterHash.search(/[\s\n]/);
  
  // 如果 # 后面已经有内容且后面有空格，说明已经有完整的 mention
  if (spaceIndex !== -1 && spaceIndex > 0) {
    // 检查光标是否在空格后面，如果是，说明 mention 已经完成，不触发
    const afterSpace = afterHash.substring(spaceIndex + 1);
    const textAfterCursor = text.substring(cursorPosition);
    // 如果空格后面有内容，或者光标就在空格位置，说明 mention 已完成
    if (afterSpace.length > 0 || (textAfterCursor.length > 0 && !textAfterCursor.startsWith(' '))) {
      return { show: false, query: '' };
    }
  }
  
  // 提取查询内容（# 后到空格或换行的内容）
  const query = spaceIndex === -1 ? afterHash : afterHash.substring(0, spaceIndex);
  
  // 检查 # 前面是否有 @mention，如果有，需要确保 @mention 已经完成（后面有空格）
  const beforeHash = textBeforeCursor.substring(0, lastHashIndex);
  const trimmedBeforeHash = beforeHash.trim();
  
  // 如果前面有 @mention，检查是否已经完成
  if (trimmedBeforeHash.includes('@')) {
    const lastAtIndex = trimmedBeforeHash.lastIndexOf('@');
    const afterAt = trimmedBeforeHash.substring(lastAtIndex + 1);
    const atSpaceIndex = afterAt.search(/[\s\n]/);
    
    // 如果 @ 后面有内容但没有空格，说明 @mention 还没完成，不显示 # 选择器
    // 但允许 @mention 后面直接跟 #（中间可以有空格）
    if (atSpaceIndex === -1 && afterAt.length > 0) {
      // 检查 # 和 @ 之间是否有空格，如果有，说明 @mention 已完成
      const betweenAtAndHash = textBeforeCursor.substring(lastAtIndex + afterAt.length, lastHashIndex);
      if (!betweenAtAndHash.trim().includes(' ')) {
        return { show: false, query: '' };
      }
    }
  }
  
  return { show: true, query };
}

/**
 * 解析消息中的文档引用
 * 支持两种格式：
 * 1. #文件名(file-id) - 带显示名称
 * 2. #file-id - 简化格式
 */
export function parseDocumentsFromMessage(text: string): ParsedDocuments {
  console.log("[DocumentParser] Parsing text:", text);
  
  // 匹配 #文件名(file-id) 格式
  const namedRegex = /#([^(]+)\(([a-zA-Z0-9_-]+)\)/g;
  // 匹配 #file-id 格式（作为降级，但排除已经匹配的命名格式）
  const simpleRegex = /#([a-zA-Z0-9_-]+)/g;
  
  const namedMatches = Array.from(text.matchAll(namedRegex));
  const simpleMatches = Array.from(text.matchAll(simpleRegex));
  
  console.log("[DocumentParser] Named matches found:", namedMatches.length);
  console.log("[DocumentParser] Simple matches found:", simpleMatches.length);
  namedMatches.forEach((match, i) => {
    console.log(`[DocumentParser] Named match ${i + 1}:`, {
      fullMatch: match[0],
      fileName: match[1],
      fileId: match[2],
      index: match.index,
    });
  });
  simpleMatches.forEach((match, i) => {
    console.log(`[DocumentParser] Simple match ${i + 1}:`, {
      fullMatch: match[0],
      fileId: match[1],
      index: match.index,
    });
  });
  
  // 收集所有匹配，优先使用命名格式
  const allMatches = new Map<string, { fileId: string; fileName?: string }>();
  const matchedPositions = new Set<number>(); // 记录已匹配的位置
  
  namedMatches.forEach((match) => {
    const fileId = match[2];
    const fileName = match[1].trim();
    allMatches.set(fileId, { fileId, fileName });
    // 记录匹配位置，避免简单格式重复匹配
    for (let i = match.index!; i < match.index! + match[0].length; i++) {
      matchedPositions.add(i);
    }
  });
  
  // 添加简单格式的匹配（如果还没有被命名格式匹配）
  simpleMatches.forEach((match) => {
    // 检查这个匹配是否已经被命名格式覆盖
    let isOverlapped = false;
    for (let i = match.index!; i < match.index! + match[0].length; i++) {
      if (matchedPositions.has(i)) {
        isOverlapped = true;
        break;
      }
    }
    
    if (!isOverlapped) {
      const fileId = match[1];
      // 检查是否是 file- 开头的 ID（避免匹配普通文本）
      if (fileId.startsWith('file-') || /^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
        if (!allMatches.has(fileId)) {
          allMatches.set(fileId, { fileId });
        }
      }
    }
  });
  
  const documents: DocumentMention[] = Array.from(allMatches.values());
  
  console.log("[DocumentParser] Final documents extracted:", documents);
  console.log("[DocumentParser] Total unique documents:", documents.length);

  // 移除文档引用，保留其他内容
  let cleanedContent = text;
  // 先移除命名格式的引用
  namedMatches.forEach((match) => {
    cleanedContent = cleanedContent.replace(match[0], '').trim();
  });
  // 再移除简单格式的引用（但排除已经被命名格式匹配的部分）
  simpleMatches.forEach((match) => {
    let isOverlapped = false;
    for (let i = match.index!; i < match.index! + match[0].length; i++) {
      if (matchedPositions.has(i)) {
        isOverlapped = true;
        break;
      }
    }
    if (!isOverlapped && (match[1].startsWith('file-') || /^[a-zA-Z0-9_-]{10,}$/.test(match[1]))) {
      cleanedContent = cleanedContent.replace(match[0], '').trim();
    }
  });

  return {
    hasDocumentMention: documents.length > 0,
    documents,
    cleanedContent: cleanedContent.trim(),
  };
}

