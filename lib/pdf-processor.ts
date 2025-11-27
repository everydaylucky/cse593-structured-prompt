/**
 * PDF 处理工具
 * 调用 Mathpix API 解析 PDF
 */

export interface PDFProcessResult {
  fileId: string;
  text: string;
  metadata: {
    pageCount: number;
    processedAt: number;
    mathpixRequestId?: string;
    parserId?: string;
  };
}

export interface PDFProcessOptions {
  formats?: ('text' | 'data' | 'latex')[];
  improve_mathpix?: boolean;
}

/**
 * 使用指定的解析器处理 PDF
 */
export async function processPDF(
  file: File,
  threadId: string,
  options: PDFProcessOptions & {
    parserId?: string;
    useFallback?: boolean;
  } = {}
): Promise<PDFProcessResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('threadId', threadId);
  
  if (options.parserId) {
    formData.append('parserId', options.parserId);
  }
  if (options.useFallback !== undefined) {
    formData.append('useFallback', String(options.useFallback));
  }
  if (options.formats) {
    formData.append('formats', JSON.stringify(options.formats));
  }
  if (options.improve_mathpix !== undefined) {
    formData.append('improve_mathpix', String(options.improve_mathpix));
  }

  const response = await fetch('/api/files/process-pdf', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`PDF processing failed: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'PDF processing failed');
  }

  return {
    fileId: result.fileId,
    text: result.text,
    metadata: result.metadata,
  };
}

/**
 * 使用 Mathpix API 处理 PDF（向后兼容）
 */
export async function processPDFWithMathpix(
  file: File,
  threadId: string,
  options: PDFProcessOptions = {}
): Promise<PDFProcessResult> {
  return processPDF(file, threadId, {
    ...options,
    parserId: 'mathpix',
    useFallback: true, // 如果 Mathpix 失败，自动降级
  });
}

/**
 * 从 Mathpix 响应中提取文本
 */
export function extractTextFromMathpixResponse(result: any): string {
  // 优先使用 text 字段
  if (result.text) {
    return result.text;
  }
  
  // 如果有 data 字段，提取文本
  if (result.data && Array.isArray(result.data)) {
    return result.data
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.value) return item.value;
        if (item.text) return item.text;
        return '';
      })
      .filter((text: string) => text.length > 0)
      .join('\n');
  }
  
  // 如果有 pages 字段，提取每页文本
  if (result.pages && Array.isArray(result.pages)) {
    return result.pages
      .map((page: any) => {
        if (page.text) return page.text;
        if (page.data) {
          return page.data
            .map((item: any) => item.value || item.text || '')
            .join('\n');
        }
        return '';
      })
      .filter((text: string) => text.length > 0)
      .join('\n\n');
  }
  
  return '';
}

