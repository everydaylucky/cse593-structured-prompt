/**
 * 语义感知文本分块器
 * 支持 Section 边界优先、句子完整性、Token-based chunking
 */

import { estimateTokens, tokensToChars, detectChineseRatio } from './token-counter';
import type { TextChunk } from './text-chunker';

export interface SemanticChunkOptions {
  chunkSizeTokens?: number; // Chunk size in tokens (512-1024)
  chunkOverlapRatio?: number; // Overlap ratio (0.15-0.20)
  minChunkSizeTokens?: number; // Minimum chunk size in tokens
  maxChunkSizeTokens?: number; // Maximum chunk size in tokens
  preserveSentences?: boolean; // Preserve sentence integrity
  preserveSections?: boolean; // Preserve section boundaries
}

export interface SectionBoundary {
  type: 'section' | 'subsection' | 'paragraph' | 'sentence';
  start: number;
  end: number;
  level?: number; // For hierarchical sections
  title?: string;
}

/**
 * 检测 Section 边界
 */
function detectSectionBoundaries(text: string): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];
  const lines = text.split('\n');
  let currentPos = 0;

  // Section 标题模式
  const sectionPatterns = [
    /^#{1,6}\s+(.+)$/, // Markdown headers
    /^(\d+\.?\s*[A-Z][^\n]*)$/m, // Numbered sections (1. Introduction)
    /^([A-Z][A-Z\s]{2,})$/, // ALL CAPS sections
    /^(Abstract|Introduction|Methodology|Results|Discussion|Conclusion|References?)\s*$/i, // Common section titles
    /^Section\s+\d+[\.:]?\s*[^\n]*$/i, // "Section 1: ..."
    /^Chapter\s+\d+[\.:]?\s*[^\n]*$/i, // "Chapter 1: ..."
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentPos;
    const lineEnd = currentPos + line.length;

    // 检查是否是 section 标题
    for (const pattern of sectionPatterns) {
      if (pattern.test(line.trim())) {
        // 确定 section level
        let level = 1;
        if (line.startsWith('#')) {
          level = (line.match(/^#+/) || [''])[0].length;
        } else if (/^\d+\./.test(line.trim())) {
          const match = line.trim().match(/^(\d+)/);
          if (match) {
            level = match[1].split('.').length;
          }
        }

        boundaries.push({
          type: level === 1 ? 'section' : 'subsection',
          start: lineStart,
          end: lineEnd,
          level,
          title: line.trim(),
        });
        break;
      }
    }

    // 段落边界（空行）
    if (line.trim().length === 0 && i > 0 && i < lines.length - 1) {
      boundaries.push({
        type: 'paragraph',
        start: lineStart,
        end: lineEnd,
      });
    }

    currentPos = lineEnd + 1; // +1 for newline
  }

  return boundaries.sort((a, b) => a.start - b.start);
}

/**
 * 检测句子边界
 */
function detectSentenceBoundaries(text: string): number[] {
  const boundaries: number[] = [0]; // Start of text
  const sentenceEndPattern = /[.!?。！？]\s+/g;
  let match;

  while ((match = sentenceEndPattern.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length);
  }

  boundaries.push(text.length); // End of text
  return boundaries;
}

/**
 * 找到最佳分割点
 */
function findBestSplitPoint(
  text: string,
  start: number,
  targetEnd: number,
  boundaries: SectionBoundary[],
  sentenceBoundaries: number[],
  options: SemanticChunkOptions
): number {
  const { preserveSections = true, preserveSentences = true } = options;

  // 1. 优先在 section 边界分割
  if (preserveSections) {
    // 检查是否在 section 末尾附近
    for (let i = boundaries.length - 1; i >= 0; i--) {
      const boundary = boundaries[i];
      if (boundary.start >= start && boundary.end <= targetEnd) {
        // 如果在 section 末尾，尝试包含整个 section
        if (boundary.end <= targetEnd && boundary.end > targetEnd * 0.8) {
          // 查找下一个 section 的开始
          const nextSection = boundaries.find(b => b.start > boundary.end);
          if (nextSection && nextSection.start <= targetEnd * 1.2) {
            return nextSection.start;
          }
          return boundary.end;
        }
      }
    }

    // 检查是否在 section 开头
    for (const boundary of boundaries) {
      if (boundary.start >= start && boundary.start <= targetEnd) {
        // 如果 section 在前半部分，确保包含 section 标题
        if (boundary.start <= targetEnd * 0.5) {
          return boundary.start;
        }
      }
    }
  }

  // 2. 在句子边界分割
  if (preserveSentences) {
    // 找到最接近 targetEnd 的句子边界
    for (let i = sentenceBoundaries.length - 1; i >= 0; i--) {
      const boundary = sentenceBoundaries[i];
      if (boundary >= start && boundary <= targetEnd) {
        // 如果边界在合理范围内（80%-120% of targetEnd）
        if (boundary >= targetEnd * 0.8 && boundary <= targetEnd * 1.2) {
          return boundary;
        }
      }
    }
  }

  // 3. 在段落边界分割（空行）
  const paragraphIndex = text.lastIndexOf('\n\n', targetEnd);
  if (paragraphIndex > start && paragraphIndex > targetEnd * 0.7) {
    return paragraphIndex + 2; // Include \n\n
  }

  // 4. 在行边界分割
  const lineIndex = text.lastIndexOf('\n', targetEnd);
  if (lineIndex > start && lineIndex > targetEnd * 0.6) {
    return lineIndex + 1;
  }

  // 5. 在空格边界分割
  const spaceIndex = text.lastIndexOf(' ', targetEnd);
  if (spaceIndex > start && spaceIndex > targetEnd * 0.5) {
    return spaceIndex + 1;
  }

  // 6. 默认：在目标位置分割
  return targetEnd;
}

/**
 * 找到最佳重叠点
 */
function findBestOverlapPoint(
  text: string,
  chunkEnd: number,
  targetOverlapChars: number,
  sentenceBoundaries: number[],
  options: SemanticChunkOptions
): number {
  const { preserveSentences = true } = options;
  const targetStart = chunkEnd - targetOverlapChars;

  if (preserveSentences) {
    // 找到最接近目标重叠量的句子边界
    for (let i = sentenceBoundaries.length - 1; i >= 0; i--) {
      const boundary = sentenceBoundaries[i];
      if (boundary <= chunkEnd && boundary >= targetStart * 0.8) {
        return boundary;
      }
    }
  }

  // 如果没有找到句子边界，在段落边界
  const paragraphIndex = text.lastIndexOf('\n\n', chunkEnd);
  if (paragraphIndex >= targetStart * 0.8) {
    return paragraphIndex;
  }

  // 默认：使用目标位置
  return Math.max(0, chunkEnd - targetOverlapChars);
}

/**
 * 语义感知文本分块
 */
export async function semanticChunkText(
  text: string,
  options: SemanticChunkOptions = {}
): Promise<TextChunk[]> {
  const {
    chunkSizeTokens = 768, // Default: middle of 512-1024 range
    chunkOverlapRatio = 0.175, // Default: 17.5% (middle of 15-20%)
    minChunkSizeTokens = 512,
    maxChunkSizeTokens = 1024,
    preserveSentences = true,
    preserveSections = true,
  } = options;

  console.log('[Semantic Chunker] Starting semantic chunking:', {
    textLength: text.length,
    chunkSizeTokens,
    chunkOverlapRatio,
    preserveSections,
    preserveSentences,
  });

  // 检测中文比例，用于 token 估算
  const chineseRatio = detectChineseRatio(text);
  const avgCharsPerToken = chineseRatio > 0.5 ? 2.5 : 3; // 中文多则更少字符/token

  // 将 token 转换为字符数
  const chunkSizeChars = Math.floor(chunkSizeTokens * avgCharsPerToken);
  const minChunkSizeChars = Math.floor(minChunkSizeTokens * avgCharsPerToken);
  const maxChunkSizeChars = Math.floor(maxChunkSizeTokens * avgCharsPerToken);
  const targetOverlapChars = Math.floor(chunkSizeChars * chunkOverlapRatio);

  console.log('[Semantic Chunker] Converted to chars:', {
    chunkSizeChars,
    minChunkSizeChars,
    maxChunkSizeChars,
    targetOverlapChars,
    avgCharsPerToken,
  });

  // 检测边界
  const sectionBoundaries = preserveSections ? detectSectionBoundaries(text) : [];
  const sentenceBoundaries = preserveSentences ? detectSentenceBoundaries(text) : [];

  console.log('[Semantic Chunker] Detected boundaries:', {
    sections: sectionBoundaries.length,
    sentences: sentenceBoundaries.length,
  });

  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;
  const textLength = text.length;

  while (currentIndex < textLength) {
    // 计算目标结束位置
    const targetEnd = Math.min(currentIndex + chunkSizeChars, textLength);

    // 如果剩余文本小于最小 chunk size，直接使用
    if (textLength - currentIndex <= minChunkSizeChars) {
      const chunkText = text.slice(currentIndex, textLength).trim();
      if (chunkText.length > 0) {
        const tokens = estimateTokens(chunkText);
        chunks.push({
          text: chunkText,
          chunkIndex: chunkIndex++,
          startChar: currentIndex,
          endChar: textLength,
          metadata: {
            tokens,
            isLastChunk: true,
          },
        });
      }
      break;
    }

    // 找到最佳分割点
    const splitIndex = findBestSplitPoint(
      text,
      currentIndex,
      targetEnd,
      sectionBoundaries,
      sentenceBoundaries,
      options
    );

    // 确保不超过最大 chunk size
    const finalSplitIndex = Math.min(splitIndex, currentIndex + maxChunkSizeChars);

    // 提取 chunk 文本
    const chunkText = text.slice(currentIndex, finalSplitIndex).trim();
    
    if (chunkText.length > 0) {
      const tokens = estimateTokens(chunkText);
      
      // 验证 token 数量
      if (tokens >= minChunkSizeTokens || chunkIndex === 0 || finalSplitIndex >= textLength) {
        chunks.push({
          text: chunkText,
          chunkIndex: chunkIndex++,
          startChar: currentIndex,
          endChar: finalSplitIndex,
          metadata: {
            tokens,
            chineseRatio,
          },
        });
      } else {
        // 如果 token 太少，尝试扩展
        const extendedEnd = Math.min(finalSplitIndex + (minChunkSizeTokens - tokens) * avgCharsPerToken, textLength);
        const extendedText = text.slice(currentIndex, extendedEnd).trim();
        const extendedTokens = estimateTokens(extendedText);
        
        if (extendedTokens >= minChunkSizeTokens) {
          chunks.push({
            text: extendedText,
            chunkIndex: chunkIndex++,
            startChar: currentIndex,
            endChar: extendedEnd,
            metadata: {
              tokens: extendedTokens,
              chineseRatio,
            },
          });
          currentIndex = extendedEnd;
          continue;
        }
      }
    }

    // 计算下一个 chunk 的起始位置（考虑重叠）
    const overlapStart = findBestOverlapPoint(
      text,
      finalSplitIndex,
      targetOverlapChars,
      sentenceBoundaries,
      options
    );

    currentIndex = Math.max(overlapStart, currentIndex + minChunkSizeChars);

    // 定期让出主线程
    if (chunkIndex % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  console.log('[Semantic Chunker] Completed:', {
    chunksCreated: chunks.length,
    avgTokensPerChunk: chunks.reduce((sum, c) => sum + (c.metadata?.tokens || 0), 0) / chunks.length,
  });

  return chunks;
}

