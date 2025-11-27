/**
 * PDF 解析器工厂
 * 根据配置创建对应的解析器实例
 */

import type { PDFParser } from './base';
import { MathpixParser } from './mathpix-parser';
import { PDFJSParser } from './pdfjs-parser';
import { PDFParseParser } from './pdf-parse-parser';
import { getParserConfig, getDefaultParser } from './registry';

/**
 * 创建 PDF 解析器实例
 */
export async function createPDFParser(parserId?: string): Promise<PDFParser> {
  const id = parserId || getDefaultParser().id;
  const config = getParserConfig(id);

  if (!config) {
    throw new Error(`Unknown PDF parser: ${id}`);
  }

  switch (config.provider) {
    case 'mathpix': {
      const appId = process.env.MATHPIX_APP_ID;
      const appKey = process.env.MATHPIX_API_KEY;

      if (!appId || !appKey) {
        // 降级到免费解析器
        console.warn('Mathpix API not configured, falling back to free parser');
        return await createPDFParser('pdfjs-browser');
      }

      return new MathpixParser(appId, appKey);
    }

    case 'pdfjs':
      return new PDFJSParser();

    case 'pdf-parse':
      // pdf-parse 只在服务器端可用
      if (typeof window !== 'undefined') {
        // 在客户端，降级到 PDF.js
        console.warn('pdf-parse not available in browser, using PDF.js');
        return new PDFJSParser();
      }
      return new PDFParseParser();

    default:
      throw new Error(`Unsupported PDF parser provider: ${config.provider}`);
  }
}

/**
 * 尝试多个解析器（降级策略）
 */
export async function parsePDFWithFallback(
  file: File | Buffer,
  preferredParserId?: string
): Promise<{ result: any; parserId: string }> {
  // 根据环境选择解析器顺序
  const isServer = typeof window === 'undefined';
  
  const fallbackParsers = isServer
    ? ['pdf-parse-server', 'pdfjs-browser', 'mathpix'] // 服务器端优先使用 pdf-parse
    : ['pdfjs-browser', 'mathpix']; // 客户端只能使用 pdfjs 或 mathpix（通过 API）

  const parsers = preferredParserId
    ? [preferredParserId, ...fallbackParsers.filter((p) => p !== preferredParserId)]
    : fallbackParsers;

  let lastError: Error | null = null;

  for (const parserId of parsers) {
    try {
      const parser = await createPDFParser(parserId);
      
      if (!(await parser.isAvailable())) {
        console.log(`Parser ${parserId} is not available, skipping...`);
        continue;
      }

      const result = await parser.parse(file);
      console.log(`Successfully parsed PDF using ${parserId}`);
      return { result, parserId: parser.id };
    } catch (error: any) {
      console.warn(`Parser ${parserId} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(
    `All PDF parsers failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

