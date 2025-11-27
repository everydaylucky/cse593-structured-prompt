/**
 * Mathpix PDF 解析器
 */

import type { PDFParser, PDFParseResult } from './base';
import { extractTextFromMathpixResponse } from '../pdf-processor';

export class MathpixParser implements PDFParser {
  id = 'mathpix';
  private appId: string;
  private appKey: string;

  constructor(appId: string, appKey: string) {
    this.appId = appId;
    this.appKey = appKey;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.appId && !!this.appKey;
  }

  async parse(file: File | Buffer): Promise<PDFParseResult> {
    if (!(await this.isAvailable())) {
      throw new Error('Mathpix API credentials not configured');
    }

    const pdfBuffer = file instanceof File 
      ? Buffer.from(await file.arrayBuffer())
      : file;

    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer]), 'document.pdf');
    formData.append(
      'options_json',
      JSON.stringify({
        formats: ['text', 'data'],
        metadata: {
          improve_mathpix: false,
        },
      })
    );

    const response = await fetch('https://api.mathpix.com/v3/pdf', {
      method: 'POST',
      headers: {
        app_id: this.appId,
        app_key: this.appKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: response.statusText };
      }
      throw new Error(
        `Mathpix API error: ${error.error || error.message || response.statusText}`
      );
    }

    const result = await response.json();
    const text = extractTextFromMathpixResponse(result);

    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }

    return {
      text,
      metadata: {
        pageCount: result.page_count || 0,
        processedAt: Date.now(),
        parserId: this.id,
        requestId: result.request_id || result.id || '',
      },
    };
  }
}

