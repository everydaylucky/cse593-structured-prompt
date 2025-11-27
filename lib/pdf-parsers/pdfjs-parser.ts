/**
 * PDF.js 浏览器端解析器（免费）
 */

import type { PDFParser, PDFParseResult } from './base';

export class PDFJSParser implements PDFParser {
  id = 'pdfjs-browser';

  async isAvailable(): Promise<boolean> {
    // PDF.js 在浏览器中总是可用
    return typeof window !== 'undefined';
  }

  async parse(file: File | Buffer): Promise<PDFParseResult> {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js parser only works in browser');
    }

    // 动态导入 pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');
    
    // 设置 worker（使用 CDN 或本地 worker）
    if (typeof window !== 'undefined') {
      // 优先使用 CDN，如果失败则使用本地 worker
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      } catch {
        // 如果 CDN 不可用，尝试使用本地 worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;
      }
    }

    // 读取文件
    const arrayBuffer = file instanceof File
      ? await file.arrayBuffer()
      : (file as Buffer).buffer || Buffer.from(file as Buffer);

    // 加载 PDF
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;

    // 提取每页文本
    let fullText = '';
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return {
      text: fullText.trim(),
      metadata: {
        pageCount,
        processedAt: Date.now(),
        parserId: this.id,
      },
    };
  }
}

