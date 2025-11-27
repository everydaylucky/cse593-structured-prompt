/**
 * PDF RAG 完整流程
 * 整合 PDF 解析、分块、向量生成、存储
 */

import { processPDF } from './pdf-processor';
import { chunkText, type TextChunk } from './text-chunker';
import { generateEmbeddingsParallel } from './vector-generator';
import { storeChunks, storeFileMetadata } from './vector-storage';

export interface ProcessingProgress {
  stage: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'complete';
  progress: number; // 0-100
  message?: string;
}

export interface ProcessPDFResult {
  fileId: string;
  chunkCount: number;
  fileName: string;
  fileSize: number;
  parserId?: string;
}

/**
 * 处理 PDF 到 RAG 的完整流程
 */
export async function processPDFToRAG(
  file: File,
  threadId: string,
  onProgress?: (progress: ProcessingProgress) => void,
  options?: {
    parserId?: string;
    useFallback?: boolean;
  }
): Promise<ProcessPDFResult> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();

  console.log(`[PDF RAG] Starting processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

  try {
    // 1. 上传并解析 PDF (10%)
    console.log(`[PDF RAG] Step 1/5: Uploading and parsing PDF...`);
    onProgress?.({
      stage: 'uploading',
      progress: 0,
      message: 'Uploading PDF...',
    });

    const parseStartTime = Date.now();
    const { text, metadata } = await processPDF(file, threadId, {
      parserId: options?.parserId,
      useFallback: options?.useFallback !== false, // 默认启用降级
    });
    console.log(`[PDF RAG] ✓ PDF parsed in ${Date.now() - parseStartTime}ms. Text length: ${text.length} chars, Pages: ${metadata.pageCount}`);

    onProgress?.({
      stage: 'parsing',
      progress: 10,
      message: 'PDF parsed successfully',
    });

    // 2. 文本分块 (20%)
    console.log(`[PDF RAG] Step 2/5: Chunking text...`);
    onProgress?.({
      stage: 'chunking',
      progress: 20,
      message: 'Chunking text...',
    });

    // 直接调用 chunkText，它内部已经会定期让出主线程
    const chunkStartTime = Date.now();
    console.log(`[PDF RAG] Starting chunking: text length=${text.length}`);
    const chunks = await chunkText(text, {
      chunkSize: 1000,
      chunkOverlap: 200, // 20% 重叠
    });
    console.log(`[PDF RAG] ✓ Chunking completed in ${Date.now() - chunkStartTime}ms. Created ${chunks.length} chunks`);

    onProgress?.({
      stage: 'chunking',
      progress: 30,
      message: `Created ${chunks.length} chunks`,
    });

    // 3. 生成向量 (50%)
    console.log(`[PDF RAG] Step 3/5: Generating embeddings for ${chunks.length} chunks...`);
    onProgress?.({
      stage: 'embedding',
      progress: 30,
      message: 'Generating embeddings...',
    });

    // 节流进度更新，避免频繁渲染
    let lastProgressUpdate = 0;
    const embeddingStartTime = Date.now();
    const embeddings = await generateEmbeddingsParallel(
      chunks.map((c) => c.text),
      20, // API 可以处理更大的批次
      (current, total) => {
        const now = Date.now();
        // 每 200ms 更新一次进度，避免过度渲染
        if (now - lastProgressUpdate > 200 || current === total) {
          const progress = 30 + Math.floor((current / total) * 50);
          console.log(`[PDF RAG] Embedding progress: ${current}/${total} (${progress}%)`);
          onProgress?.({
            stage: 'embedding',
            progress,
            message: `Generating embeddings: ${current}/${total}`,
          });
          lastProgressUpdate = now;
        }
      }
    );
    console.log(`[PDF RAG] ✓ Embeddings generated in ${Date.now() - embeddingStartTime}ms`);

    // 4. 存储到 IndexedDB (20%)
    console.log(`[PDF RAG] Step 4/5: Storing ${chunks.length} chunks to IndexedDB...`);
    onProgress?.({
      stage: 'storing',
      progress: 80,
      message: 'Storing vectors...',
    });

    // 分批写入 IndexedDB，避免一次性写入太多数据导致卡顿
    const chunkData = chunks.map((chunk, index) => ({
      text: chunk.text,
      embedding: embeddings[index],
      chunkIndex: chunk.chunkIndex,
      metadata: {
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        ...chunk.metadata,
      },
    }));

    const writeBatchSize = 50; // 每批写入 50 个
    const storeStartTime = Date.now();
    const totalBatches = Math.ceil(chunkData.length / writeBatchSize);
    console.log(`[PDF RAG] Writing ${totalBatches} batches (${writeBatchSize} chunks per batch)...`);
    
    for (let i = 0; i < chunkData.length; i += writeBatchSize) {
      const batch = chunkData.slice(i, i + writeBatchSize);
      const batchNum = Math.floor(i / writeBatchSize) + 1;
      const batchStartTime = Date.now();
      
      console.log(`[PDF RAG] Writing batch ${batchNum}/${totalBatches}...`);
      await storeChunks(fileId, threadId, batch);
      console.log(`[PDF RAG] ✓ Batch ${batchNum} written in ${Date.now() - batchStartTime}ms`);
      
      // 更新进度
      const progress = 80 + Math.floor((i / chunkData.length) * 15);
      onProgress?.({
        stage: 'storing',
        progress,
        message: `Storing vectors: ${Math.min(i + writeBatchSize, chunkData.length)}/${chunkData.length}`,
      });

      // 让出主线程，避免阻塞
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    console.log(`[PDF RAG] ✓ All chunks stored in ${Date.now() - storeStartTime}ms`);

    console.log(`[PDF RAG] Step 5/5: Storing file metadata...`);
    await storeFileMetadata(fileId, threadId, {
      fileName: file.name,
      fileSize: file.size,
      pageCount: metadata.pageCount,
      chunkCount: chunks.length,
      mathpixRequestId: metadata.mathpixRequestId,
      embeddingModel: 'text-embedding-004', // 更新为实际使用的模型
    });

    const totalTime = Date.now() - startTime;
    console.log(`[PDF RAG] ✓ Processing complete in ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log(`[PDF RAG] Summary: ${chunks.length} chunks, ${metadata.pageCount} pages, ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Processing complete!',
    });

    return {
      fileId,
      chunkCount: chunks.length,
      fileName: file.name,
      fileSize: file.size,
      parserId: metadata.parserId,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[PDF RAG] ✗ Processing failed after ${totalTime}ms:`, error);
    throw error;
  }
}

