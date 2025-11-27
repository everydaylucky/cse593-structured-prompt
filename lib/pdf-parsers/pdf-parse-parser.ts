/**
 * pdf-parse 服务器端解析器（免费）
 */

import type { PDFParser, PDFParseResult } from './base';

export class PDFParseParser implements PDFParser {
  id = 'pdf-parse-server';

  async isAvailable(): Promise<boolean> {
    // pdf-parse 只在服务器端可用
    return typeof window === 'undefined';
  }

  async parse(file: File | Buffer): Promise<PDFParseResult> {
    if (typeof window !== 'undefined') {
      throw new Error('pdf-parse parser only works on server');
    }

    try {
      // 使用 require 方式导入 CommonJS 模块
      // pdf-parse 是 CommonJS 模块，在服务器端使用 require 更可靠
      // 动态 require 以避免在客户端打包
      const pdfParseModule = eval('require')('pdf-parse');
      
      // pdf-parse v2.x 导出 PDFParse 类
      const PDFParse = pdfParseModule.PDFParse || pdfParseModule;

      // 检查是否为构造函数
      if (typeof PDFParse !== 'function' || !PDFParse.prototype || !PDFParse.prototype.getText) {
        throw new Error(`pdf-parse module is not a valid class. Module keys: ${Object.keys(pdfParseModule || {}).join(', ')}`);
      }

      const buffer = file instanceof File
        ? Buffer.from(await file.arrayBuffer())
        : file;

      // pdf-parse v2.4.5 需要 Uint8Array 而不是 Buffer
      const uint8Array = new Uint8Array(buffer);

      // 实例化并解析
      const instance = new PDFParse(uint8Array);
      const textResult = await instance.getText();
      
      // getText 返回的是一个对象 { text: string, pages: [...], total: number }
      const text = typeof textResult === 'string' ? textResult : (textResult.text || '');
      
      // 获取元数据（如果可用）
      let pageCount = 0;
      try {
        // 如果 getText 返回了页数信息，直接使用
        if (textResult && typeof textResult === 'object' && 'total' in textResult) {
          pageCount = textResult.total;
        } else {
          const info = await instance.getInfo();
          pageCount = info?.pages || 0;
        }
      } catch (e) {
        console.warn('Failed to get PDF info:', e);
      }

      return {
        text: text || '',
        metadata: {
          pageCount,
          processedAt: Date.now(),
          parserId: this.id,
        },
      };

      return {
        text: data.text || '',
        metadata: {
          pageCount: data.numpages || 0,
          processedAt: Date.now(),
          parserId: this.id,
        },
      };
    } catch (error: any) {
      throw new Error(`pdf-parse error: ${error.message}`);
    }
  }
}

