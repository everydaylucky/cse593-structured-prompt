import { embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { texts } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'Invalid texts provided' },
        { status: 400 }
      );
    }

    console.log(`[API Embeddings] Request: ${texts.length} texts`);

    // 检查 API Key（支持多种环境变量名）
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_API_KEY;
    if (!apiKey) {
      console.error('[API Embeddings] ✗ Google API key not configured');
      console.error('[API Embeddings] Please set GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_GENERATIVE_API_KEY in .env');
      return NextResponse.json(
        { error: 'Google API key not configured. Please set GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_GENERATIVE_API_KEY in .env' },
        { status: 401 }
      );
    }

    // 使用 Google Gemini Embeddings (text-embedding-004)
    // 这是一个高性能且有免费额度的模型
    console.log(`[API Embeddings] Calling Google API...`);
    const apiStartTime = Date.now();
    
    // 临时设置环境变量，因为 @ai-sdk/google 的 textEmbeddingModel 需要从环境变量读取
    // 或者我们可以直接使用 google() 函数创建模型
    const originalEnvKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    
    try {
      const { embeddings } = await embedMany({
        model: google.textEmbeddingModel('text-embedding-004'),
        values: texts,
      });
      
      // 恢复原始环境变量
      if (originalEnvKey !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnvKey;
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      }
      
      console.log(`[API Embeddings] ✓ Google API responded in ${Date.now() - apiStartTime}ms`);
      console.log(`[API Embeddings] ✓ Generated ${embeddings.length} embeddings (dimension: ${embeddings[0]?.length || 'unknown'})`);

      const totalTime = Date.now() - startTime;
      console.log(`[API Embeddings] ✓ Total time: ${totalTime}ms`);

      return NextResponse.json({ embeddings });
    } catch (error) {
      // 恢复原始环境变量
      if (originalEnvKey !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnvKey;
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      }
      throw error;
    }
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[API Embeddings] ✗ Error after ${totalTime}ms:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate embeddings' },
      { status: 500 }
    );
  }
}

