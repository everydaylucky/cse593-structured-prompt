/**
 * 向量生成工具
 * 使用 Google Gemini API 生成向量嵌入
 */

/**
 * 服务器端生成向量嵌入（直接调用 API，不通过 HTTP）
 */
async function generateEmbeddingServer(text: string): Promise<number[]> {
  const { embedMany } = await import('ai');
  const { google } = await import('@ai-sdk/google');
  
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_API_KEY;
  if (!apiKey) {
    console.error('[Embedding] ❌ API key check failed:');
    console.error('[Embedding]   GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'SET' : 'NOT SET');
    console.error('[Embedding]   GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'SET' : 'NOT SET');
    console.error('[Embedding]   GOOGLE_GENERATIVE_API_KEY:', process.env.GOOGLE_GENERATIVE_API_KEY ? 'SET' : 'NOT SET');
    console.error('[Embedding]   All env keys:', Object.keys(process.env).filter(k => k.includes('GOOGLE')));
    throw new Error('Google API key not configured. Please set GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_GENERATIVE_API_KEY in .env file and restart the server');
  }

  console.log('[Embedding] Server-side generation for text length:', text.length);
  console.log('[Embedding] API key found:', !!apiKey, 'Length:', apiKey.length);
  
  // 临时设置环境变量（因为 textEmbeddingModel 从环境变量读取）
  const originalEnvKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
  
  try {
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel('text-embedding-004'),
      values: [text],
    });
    
    // 恢复原始环境变量
    if (originalEnvKey !== undefined) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnvKey;
    } else {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
    
    return Array.from(embeddings[0]);
  } catch (error) {
    // 恢复原始环境变量
    if (originalEnvKey !== undefined) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnvKey;
    } else {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
    throw error;
  }
}

/**
 * 客户端生成向量嵌入（通过 HTTP 调用）
 */
async function generateEmbeddingClient(text: string): Promise<number[]> {
  const baseUrl = window.location.origin;
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`API error: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  return data.embeddings[0];
}

/**
 * 生成单个文本的向量嵌入
 * 在服务器端直接调用 API 函数，在客户端通过 HTTP 调用
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // 检查是否在服务器端
  if (typeof window === 'undefined') {
    return generateEmbeddingServer(text);
  } else {
    return generateEmbeddingClient(text);
  }
}

/**
 * 本地生成单个向量
 */
async function generateEmbeddingLocal(text: string): Promise<number[]> {
  // 动态导入，避免 SSR 问题
  const { pipeline } = await import('@xenova/transformers');

  const embedder = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  );

  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data) as number[];
}

/**
 * 批量生成向量嵌入
 * 优先使用服务器端 API (Google Gemini)，失败则降级到本地 Worker
 */
export async function generateEmbeddingsParallel(
  texts: string[],
  batchSize: number = 10, // 既然有 API，可以适当调回 10
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // 检查是否在服务器端
  const isServer = typeof window === 'undefined';
  
  // 1. 尝试使用服务器端 API (Google Gemini)
  try {
    console.log(`[Embedding] Using API for ${texts.length} texts (${isServer ? 'server-side' : 'client-side'})...`);
    
    if (isServer) {
      // 服务器端：直接调用函数
      const { embedMany } = await import('ai');
      const { google } = await import('@ai-sdk/google');
      
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_API_KEY;
      if (!apiKey) {
        console.error('[Embedding] ❌ API key check failed in batch generation:');
        console.error('[Embedding]   GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'SET' : 'NOT SET');
        console.error('[Embedding]   GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'SET' : 'NOT SET');
        console.error('[Embedding]   GOOGLE_GENERATIVE_API_KEY:', process.env.GOOGLE_GENERATIVE_API_KEY ? 'SET' : 'NOT SET');
        throw new Error('Google API key not configured. Please set GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_GENERATIVE_API_KEY in .env file and restart the server');
      }

      // 分批处理（避免单次请求过大）
      const allEmbeddings: number[][] = [];
      const apiBatchSize = 20;
      const totalBatches = Math.ceil(texts.length / apiBatchSize);

      // 临时设置环境变量
      const originalEnvKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
      
      try {
        for (let i = 0; i < texts.length; i += apiBatchSize) {
          const batch = texts.slice(i, i + apiBatchSize);
          const batchNum = Math.floor(i / apiBatchSize) + 1;
          const batchStartTime = Date.now();
          
          console.log(`[Embedding] Server-side batch ${batchNum}/${totalBatches} (${batch.length} texts)...`);
          
          const { embeddings } = await embedMany({
            model: google.textEmbeddingModel('text-embedding-004'),
            values: batch,
          });
          
          allEmbeddings.push(...embeddings.map(e => Array.from(e)));
          
          console.log(`[Embedding] ✓ Batch ${batchNum} completed in ${Date.now() - batchStartTime}ms`);
          onProgress?.(Math.min(i + apiBatchSize, texts.length), texts.length);
        }
        
        // 恢复原始环境变量
        if (originalEnvKey !== undefined) {
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnvKey;
        } else {
          delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        }
      } catch (error) {
        // 恢复原始环境变量
        if (originalEnvKey !== undefined) {
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnvKey;
        } else {
          delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        }
        throw error;
      }

      console.log(`[Embedding] ✓ All embeddings generated via server-side API`);
      return allEmbeddings;
    } else {
      // 客户端：通过 HTTP 调用
      const allEmbeddings: number[][] = [];
      const apiBatchSize = 20;
      const totalBatches = Math.ceil(texts.length / apiBatchSize);
      const baseUrl = window.location.origin;

      for (let i = 0; i < texts.length; i += apiBatchSize) {
        const batch = texts.slice(i, i + apiBatchSize);
        const batchNum = Math.floor(i / apiBatchSize) + 1;
        const batchStartTime = Date.now();
        
        console.log(`[Embedding] Client-side batch ${batchNum}/${totalBatches} (${batch.length} texts)...`);
        
        const response = await fetch(`${baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: batch }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        allEmbeddings.push(...data.embeddings);
        
        console.log(`[Embedding] ✓ Batch ${batchNum} completed in ${Date.now() - batchStartTime}ms`);
        onProgress?.(Math.min(i + apiBatchSize, texts.length), texts.length);
      }

      console.log(`[Embedding] ✓ All embeddings generated via client-side API`);
      return allEmbeddings;
    }
  } catch (apiError) {
    console.error('[Embedding] ✗ API failed:', apiError);
    console.error('[Embedding] Cannot fallback to local worker - API key configuration required');
    
    throw new Error(
      `Embedding API failed: ${apiError instanceof Error ? apiError.message : String(apiError)}. Please check your GOOGLE_API_KEY configuration.`
    );
  }
}

/**
 * 使用本地 Web Worker 生成向量
 */
async function generateEmbeddingsLocal(
  texts: string[],
  batchSize: number = 5,
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  // 如果文本数量少，直接在主线程处理
  if (texts.length <= batchSize) {
    const embeddings = await Promise.all(
      texts.map((text) => generateEmbedding(text))
    );
    onProgress?.(texts.length, texts.length);
    return embeddings;
  }

  // 使用 Web Worker 处理大批量
  try {
    const worker = new Worker(
      new URL('../workers/embedding.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // 分批处理
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    const allEmbeddings: number[][] = [];
    let processed = 0;

    // 顺序处理批次（避免内存压力）
    for (const batch of batches) {
      const batchEmbeddings = await processBatch(worker, batch);
      allEmbeddings.push(...batchEmbeddings);
      processed += batch.length;
      onProgress?.(processed, texts.length);
    }

    worker.terminate();
    return allEmbeddings;
  } catch (error) {
    // 如果 Web Worker 失败，降级到主线程
    console.warn('Web Worker failed, falling back to main thread:', error);
    const embeddings = await Promise.all(
      texts.map((text) => generateEmbedding(text))
    );
    onProgress?.(texts.length, texts.length);
    return embeddings;
  }
}

/**
 * 处理单个批次
 */
function processBatch(worker: Worker, batch: string[]): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Embedding generation timeout'));
    }, 60000); // 60秒超时

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      if (e.data.type === 'error') {
        reject(new Error(e.data.error));
      } else if (e.data.type === 'success') {
        resolve(e.data.embeddings);
      }
    };

    worker.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };

    worker.postMessage({ type: 'embed', texts: batch });
  });
}

