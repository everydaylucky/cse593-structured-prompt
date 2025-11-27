/**
 * PDF 解析器基础接口
 */

export interface PDFParseResult {
  text: string;
  metadata: {
    pageCount: number;
    processedAt: number;
    parserId: string;
    requestId?: string;
  };
}

export interface PDFParser {
  /**
   * 解析器 ID
   */
  id: string;

  /**
   * 解析 PDF 文件
   */
  parse(file: File | Buffer): Promise<PDFParseResult>;

  /**
   * 检查是否可用（是否有 API key 等）
   */
  isAvailable(): Promise<boolean>;
}

