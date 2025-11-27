/**
 * 文本分块工具
 * 实现智能文本分割，支持重叠
 */

export interface TextChunk {
  text: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, any>;
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

/**
 * 递归字符文本分割器
 * 类似于 LangChain 的 RecursiveCharacterTextSplitter
 */
export class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: ChunkOptions = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.separators = options.separators || ['\n\n', '\n', ' ', ''];
  }

  /**
   * 分割文本为块
   * 优化版本：减少字符串操作，提高性能
   */
  async splitText(text: string): Promise<TextChunk[]> {
    const chunks: TextChunk[] = [];
    let currentIndex = 0;
    let chunkIndex = 0;
    let lastYieldTime = Date.now();
    const YIELD_INTERVAL = 100; // 每 100ms 让出一次主线程（减少频率）
    const textLength = text.length;
    const estimatedChunks = Math.ceil(textLength / (this.chunkSize - this.chunkOverlap));
    
    console.log(`[Chunking] Starting: text length=${textLength}, estimated chunks=${estimatedChunks}`);

    while (currentIndex < textLength) {
      // 定期让出主线程，避免阻塞 UI
      const now = Date.now();
      if (now - lastYieldTime > YIELD_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYieldTime = now;
      }

      // 计算下一个块的结束位置
      const endIndex = Math.min(currentIndex + this.chunkSize, textLength);
      
      // 如果剩余文本小于等于 chunkSize，直接使用
      if (endIndex >= textLength) {
        const chunkText = text.slice(currentIndex, textLength);
        if (chunkText.trim().length > 0) {
          chunks.push({
            text: chunkText,
            chunkIndex: chunkIndex++,
            startChar: currentIndex,
            endChar: textLength,
          });
        }
        break;
      }

      // 尝试在 chunkSize 范围内找到最佳分割点
      let splitIndex = endIndex;
      
      // 优先在段落边界分割（\n\n）
      const paragraphIndex = text.lastIndexOf('\n\n', endIndex);
      if (paragraphIndex > currentIndex && paragraphIndex > endIndex - this.chunkSize * 0.5) {
        splitIndex = paragraphIndex + 2; // 包含 \n\n
      } else {
        // 其次在行边界分割（\n）
        const lineIndex = text.lastIndexOf('\n', endIndex);
        if (lineIndex > currentIndex && lineIndex > endIndex - this.chunkSize * 0.3) {
          splitIndex = lineIndex + 1; // 包含 \n
        } else {
          // 最后在空格边界分割
          const spaceIndex = text.lastIndexOf(' ', endIndex);
          if (spaceIndex > currentIndex && spaceIndex > endIndex - this.chunkSize * 0.2) {
            splitIndex = spaceIndex + 1; // 包含空格
          }
          // 如果都找不到，直接按 chunkSize 分割
        }
      }

      const chunkText = text.slice(currentIndex, splitIndex).trim();
      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          chunkIndex: chunkIndex++,
          startChar: currentIndex,
          endChar: splitIndex,
        });
      }

      // 移动到下一个块的起始位置（考虑重叠）
      currentIndex = Math.max(splitIndex - this.chunkOverlap, currentIndex + 1);
      
      // 每处理 50 个 chunk 或每 5% 输出一次进度
      if (chunkIndex % 50 === 0 || (currentIndex / textLength) % 0.05 < 0.01) {
        const progress = ((currentIndex / textLength) * 100).toFixed(1);
        console.log(`[Chunking] Processed ${chunkIndex} chunks, ${progress}% of text`);
      }
    }

    console.log(`[Chunking] Completed: ${chunks.length} chunks created`);
    return chunks;
  }

  // _getNextChunk 方法已不再使用，保留以防向后兼容
  private _getNextChunk(text: string, startIndex: number): TextChunk {
    // 这个方法已被优化后的 splitText 替代
    const chunkText = text.slice(0, Math.min(this.chunkSize, text.length));
    return {
      text: chunkText,
      chunkIndex: 0,
      startChar: startIndex,
      endChar: startIndex + chunkText.length,
    };
  }
}

/**
 * 便捷函数：分割文本
 */
export async function chunkText(
  text: string,
  options: ChunkOptions = {}
): Promise<TextChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter(options);
  return await splitter.splitText(text);
}

