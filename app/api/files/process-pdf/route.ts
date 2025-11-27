import { NextRequest, NextResponse } from 'next/server';
import { createPDFParser, parsePDFWithFallback } from '@/lib/pdf-parsers/factory';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const threadId = formData.get('threadId') as string;
    const parserId = (formData.get('parserId') as string) || undefined;
    const useFallback = formData.get('useFallback') === 'true';

    if (!file || !threadId) {
      return NextResponse.json(
        { success: false, error: 'Missing file or threadId' },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    let result;
    let usedParserId: string;

    try {
      if (useFallback) {
        // 使用降级策略
        const fallbackResult = await parsePDFWithFallback(pdfBuffer, parserId);
        result = fallbackResult.result;
        usedParserId = fallbackResult.parserId;
      } else {
        // 使用指定的解析器
        const parser = await createPDFParser(parserId);
        
        if (!(await parser.isAvailable())) {
          // 如果不可用，尝试降级
          console.log(`Parser ${parserId} not available, falling back...`);
          const fallbackResult = await parsePDFWithFallback(pdfBuffer);
          result = fallbackResult.result;
          usedParserId = fallbackResult.parserId;
        } else {
          result = await parser.parse(pdfBuffer);
          usedParserId = parser.id;
        }
      }
    } catch (error: any) {
      // 如果所有解析器都失败，提供更友好的错误信息
      throw new Error(
        `PDF parsing failed: ${error.message}. Please check your PDF file and try again.`
      );
    }

    // 确保 result.text 是字符串
    const textContent = result.text && typeof result.text === 'string' ? result.text : String(result.text || '');

    if (textContent.trim().length === 0) {
      console.error('Empty text extracted:', result);
      throw new Error('No text extracted from PDF');
    }

    return NextResponse.json({
      success: true,
      fileId: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: textContent,
      metadata: {
        ...result.metadata,
        parserId: usedParserId,
      },
    });
  } catch (error: any) {
    console.error('PDF processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to process PDF',
      },
      { status: 500 }
    );
  }
}

