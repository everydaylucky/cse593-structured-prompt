/**
 * Web Worker for embedding generation
 * 在后台线程中生成向量，避免阻塞主线程
 */

import { pipeline } from '@xenova/transformers';

let embedder: any = null;

self.onmessage = async (e) => {
  const { type, texts } = e.data;

  if (type === 'embed') {
    try {
      // 懒加载模型（只加载一次）
      if (!embedder) {
        embedder = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        );
      }

      // 批量生成向量（改为顺序处理以降低内存压力）
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        const output = await embedder(text, {
          pooling: 'mean',
          normalize: true,
        });
        embeddings.push(Array.from(output.data) as number[]);
        
        // 给 GC 一点时间
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      self.postMessage({ type: 'success', embeddings });
    } catch (error: any) {
      self.postMessage({
        type: 'error',
        error: error?.message || 'Unknown error',
      });
    }
  }
};

