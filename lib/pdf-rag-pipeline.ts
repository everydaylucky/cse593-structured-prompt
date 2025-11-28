/**
 * PDF RAG 完整流程
 * 整合 PDF 解析、分块、向量生成、存储
 */

import { processPDF } from './pdf-processor';
import { chunkText, type TextChunk } from './text-chunker';
import { generateEmbeddingsParallel } from './vector-generator';
import { storeChunks, storeFileMetadata } from './vector-storage';
import { generateDocumentMetadata } from './rag-enhancement';
import { extractEntitiesFast } from './entity-extractor';

/**
 * 将目录条目与chunks匹配
 * 确保每个chunk都归属于某个目录条目
 */
function matchTOCWithChunks(
  toc: Array<{ title: string; level: number; pageNumber?: number }>,
  chunks: TextChunk[],
  fullText: string
): Array<{ title: string; level: number; pageNumber?: number; approximateChunkIndex?: number; startChar?: number; endChar?: number }> {
  if (toc.length === 0 || chunks.length === 0) {
    return toc.map(item => ({ ...item }));
  }

  // 步骤1：在完整文本中查找每个目录条目的位置
  const tocWithPositions: Array<{
    title: string;
    level: number;
    pageNumber?: number;
    charPosition?: number; // 在文档中的字符位置
  }> = [];

  const fullTextLower = fullText.toLowerCase();

  for (const item of toc) {
    let charPosition: number | undefined;

    // 策略1：尝试在文本中直接查找标题
    const titleLower = item.title.toLowerCase();
    const titleSearch = titleLower.trim();
    
    // 尝试多种匹配方式
    const searchPatterns = [
      titleSearch, // 完整标题
      titleSearch.replace(/^\d+\.?\s*/, ''), // 去除开头的序号
      titleSearch.replace(/^[^\w]+/, ''), // 去除开头的非字母字符
    ];

    for (const pattern of searchPatterns) {
      if (pattern.length < 3) continue; // 太短的标题跳过
      
      const index = fullTextLower.indexOf(pattern);
      if (index !== -1) {
        charPosition = index;
        break;
      }
    }

    // 策略2：如果找不到，基于页码估算（如果有页码）
    if (charPosition === undefined && item.pageNumber) {
      // 假设平均每页的字符数（可以根据文档总长度和页数估算）
      const avgCharsPerPage = fullText.length / 100; // 粗略估算，实际应该用真实页数
      charPosition = Math.floor(item.pageNumber * avgCharsPerPage);
    }

    tocWithPositions.push({
      ...item,
      charPosition,
    });
  }

  // 步骤2：为每个目录条目找到对应的chunk范围
  // 每个目录条目应该包含从它开始到下一个同级或更高级目录条目之间的所有chunks
  const result: Array<{
    title: string;
    level: number;
    pageNumber?: number;
    approximateChunkIndex?: number;
    startChar?: number;
    endChar?: number;
  }> = [];

  for (let i = 0; i < tocWithPositions.length; i++) {
    const currentItem = tocWithPositions[i];
    const nextItem = tocWithPositions[i + 1];

    // 确定当前目录条目的范围
    const startChar = currentItem.charPosition ?? 0;
    const endChar = nextItem?.charPosition ?? fullText.length;

    // 找到这个范围内的第一个chunk
    let firstChunkIndex: number | undefined;
    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      // chunk的开始位置在当前目录条目的范围内，或者chunk跨越了当前目录条目的开始位置
      if (chunk.startChar >= startChar && chunk.startChar < endChar) {
        firstChunkIndex = j;
        break;
      }
      // 如果chunk跨越了目录条目的开始位置
      if (chunk.startChar < startChar && chunk.endChar > startChar) {
        firstChunkIndex = j;
        break;
      }
    }

    // 如果找不到，找最接近的chunk
    if (firstChunkIndex === undefined) {
      let closestChunkIndex = 0;
      let minDistance = Math.abs(chunks[0].startChar - startChar);
      for (let j = 1; j < chunks.length; j++) {
        const distance = Math.abs(chunks[j].startChar - startChar);
        if (distance < minDistance) {
          minDistance = distance;
          closestChunkIndex = j;
        }
      }
      firstChunkIndex = closestChunkIndex;
    }

    result.push({
      title: currentItem.title,
      level: currentItem.level,
      pageNumber: currentItem.pageNumber,
      approximateChunkIndex: firstChunkIndex,
      startChar: startChar,
      endChar: endChar,
    });
  }

  // 验证匹配结果：确保每个chunk只归属于一个目录条目
  const chunkAssignments = new Map<number, number>(); // chunkIndex -> tocEntryIndex
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const nextItem = result[i + 1];
    const startChar = item.startChar ?? 0;
    const endChar = item.endChar ?? fullText.length;
    
    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      const chunkCenter = (chunk.startChar + chunk.endChar) / 2;
      
      if (chunkCenter >= startChar && chunkCenter < endChar) {
        if (chunkAssignments.has(j)) {
          console.warn(`[TOC Matching] Chunk ${j} is assigned to multiple TOC entries: ${chunkAssignments.get(j)} and ${i}`);
        } else {
          chunkAssignments.set(j, i);
        }
      }
    }
  }

  console.log(`[TOC Matching] Matched ${result.length} TOC entries with chunks. Coverage:`, {
    totalChunks: chunks.length,
    tocEntries: result.length,
    chunksWithTOC: chunkAssignments.size,
    coverage: `${((chunkAssignments.size / chunks.length) * 100).toFixed(1)}%`,
  });

  // 为每个目录条目添加统计信息（用于调试）
  result.forEach((item, index) => {
    const nextItem = result[index + 1];
    const startChar = item.startChar ?? 0;
    const endChar = item.endChar ?? fullText.length;
    let chunkCount = 0;
    
    for (const chunk of chunks) {
      const chunkCenter = (chunk.startChar + chunk.endChar) / 2;
      if (chunkCenter >= startChar && chunkCenter < endChar) {
        chunkCount++;
      }
    }
    
    console.log(`[TOC Matching] "${item.title}": chunks ${chunkCount}, range [${startChar}, ${endChar})`);
  });

  return result;
}

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
    console.log(`[PDF RAG] Step 1/6: Uploading and parsing PDF...`);
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

    // 2. 文档预处理：生成元数据和实体识别 (5%)
    console.log(`[PDF RAG] Step 2/6: Analyzing document and extracting entities...`);
    onProgress?.({
      stage: 'parsing',
      progress: 12,
      message: 'Analyzing document...',
    });

    const preprocessingStartTime = Date.now();
    
    // 2a. 快速实体识别（同步，无token消耗）
    console.log(`[PDF RAG] Extracting entities (fast, local)...`);
    const entities = extractEntitiesFast(text);
    console.log(`[PDF RAG] ✓ Entities extracted in ${Date.now() - preprocessingStartTime}ms:`, {
      persons: entities.persons.length,
      organizations: entities.organizations.length,
      locations: entities.locations.length,
      dates: entities.dates.length,
    });

    // 2b. GPT-4o-mini 文档分析（异步，不阻塞后续流程）
    let documentMetadata: Awaited<ReturnType<typeof generateDocumentMetadata>> | null = null;
    const metadataPromise = generateDocumentMetadata(text, file.name)
      .then(metadata => {
        documentMetadata = metadata;
        console.log(`[PDF RAG] ✓ Document metadata generated`);
        return metadata;
      })
      .catch(error => {
        console.error(`[PDF RAG] ⚠️ Document metadata generation failed:`, error);
        return null;
      });

    onProgress?.({
      stage: 'parsing',
      progress: 15,
      message: 'Document analysis in progress...',
    });

    // 3. 文本分块 (20%)
    console.log(`[PDF RAG] Step 3/6: Chunking text...`);
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

    // 4. 生成向量 (50%)
    console.log(`[PDF RAG] Step 4/6: Generating embeddings for ${chunks.length} chunks...`);
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

    // 5. 存储到 IndexedDB (20%)
    console.log(`[PDF RAG] Step 5/6: Storing ${chunks.length} chunks to IndexedDB...`);
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

    // 6. 等待文档元数据生成完成（如果还在进行中）
    if (!documentMetadata) {
      console.log(`[PDF RAG] Waiting for document metadata generation...`);
      documentMetadata = await metadataPromise;
    }

    // 6a. 将目录条目与chunks匹配
    let matchedTOC = documentMetadata?.tableOfContents || [];
    if (matchedTOC.length > 0 && chunks.length > 0) {
      console.log(`[PDF RAG] Matching ${matchedTOC.length} TOC entries with ${chunks.length} chunks...`);
      matchedTOC = matchTOCWithChunks(matchedTOC, chunks, text);
      console.log(`[PDF RAG] ✓ Matched TOC entries with chunks`);
    }

    console.log(`[PDF RAG] Step 6/6: Storing file metadata with document analysis...`);
    await storeFileMetadata(fileId, threadId, {
      fileName: file.name,
      fileSize: file.size,
      pageCount: metadata.pageCount,
      chunkCount: chunks.length,
      mathpixRequestId: metadata.mathpixRequestId,
      embeddingModel: 'text-embedding-004',
      metadata: {
        // GPT-4o-mini 生成的元数据
        summary: documentMetadata?.summary,
        keywords: documentMetadata?.keywords || [],
        topics: documentMetadata?.topics || [],
        keyPhrases: documentMetadata?.keyPhrases || [],
        tableOfContents: matchedTOC,
        // 本地实体识别结果
        entities: {
          persons: entities.persons,
          organizations: entities.organizations,
          locations: entities.locations,
          dates: entities.dates,
          other: {
            emails: entities.emails,
            urls: entities.urls,
            currencies: entities.currencies,
            percentages: entities.percentages,
          },
        },
      },
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

