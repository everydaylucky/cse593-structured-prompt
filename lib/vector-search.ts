/**
 * 向量搜索工具
 * 使用余弦相似度搜索相关块
 */

import { getChunksByThreadId, type VectorChunk } from './vector-storage';

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * 搜索相似块
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  threadId: string,
  topK: number = 5,
  minScore: number = 0.5
): Promise<Array<{ chunk: VectorChunk; score: number }>> {
  const chunks = await getChunksByThreadId(threadId);

  if (chunks.length === 0) {
    return [];
  }

  // 计算所有块的相似度
  const scored = chunks
    .filter(chunk => chunk.embedding.length === queryEmbedding.length)
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

  // 过滤低分，排序并返回 topK
  return scored
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * 搜索特定文件的相似块
 */
export async function searchSimilarChunksInFile(
  queryEmbedding: number[],
  fileId: string,
  topK: number = 5,
  minScore: number = 0.5
): Promise<Array<{ chunk: VectorChunk; score: number }>> {
  const { getChunksByFileId } = await import('./vector-storage');
  const chunks = await getChunksByFileId(fileId);

  console.log(`[VectorSearch] Searching in file ${fileId}:`, {
    totalChunks: chunks.length,
    queryEmbeddingLength: queryEmbedding.length,
    topK,
    minScore,
  });

  if (chunks.length === 0) {
    console.warn(`[VectorSearch] ⚠️ No chunks found for file ${fileId}`);
    return [];
  }

  // 计算所有块的相似度
  const scored = chunks
    .filter(chunk => {
      const lengthMatch = chunk.embedding.length === queryEmbedding.length;
      if (!lengthMatch) {
        console.warn(`[VectorSearch] Dimension mismatch: chunk embedding length ${chunk.embedding.length} vs query ${queryEmbedding.length}`);
      }
      return lengthMatch;
    })
    .map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        chunk,
        score,
      };
    });

  // 记录所有 scores（包括低于 minScore 的）
  const allScores = scored.map(s => s.score).sort((a, b) => b - a);
  console.log(`[VectorSearch] All similarity scores for file ${fileId}:`, {
    totalScored: scored.length,
    topScores: allScores.slice(0, 10),
    minScore: allScores[allScores.length - 1],
    maxScore: allScores[0],
    scoresAboveMin: allScores.filter(s => s >= minScore).length,
    scoresBelowMin: allScores.filter(s => s < minScore).length,
  });

  // 过滤低分，排序并返回 topK
  const filtered = scored
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(`[VectorSearch] Final results for file ${fileId}:`, {
    filteredCount: filtered.length,
    scores: filtered.map(r => r.score),
    chunkIndices: filtered.map(r => r.chunk.chunkIndex),
  });

  return filtered;
}

