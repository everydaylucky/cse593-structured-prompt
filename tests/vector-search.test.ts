/**
 * 向量搜索测试
 */

import { cosineSimilarity, searchSimilarChunks } from '../lib/vector-search';
import { VectorChunk } from '../lib/vector-storage';

// Mock vector storage
jest.mock('../lib/vector-storage', () => ({
  getChunksByThreadId: jest.fn(),
}));

describe('Vector Search', () => {
  test('should calculate cosine similarity correctly', () => {
    const vec1 = [1, 0, 0];
    const vec2 = [1, 0, 0];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(1.0, 5); // Identical vectors

    const vec3 = [0, 1, 0];
    const similarity2 = cosineSimilarity(vec1, vec3);
    expect(similarity2).toBeCloseTo(0.0, 5); // Orthogonal vectors
  });

  test('should handle zero vectors', () => {
    const vec1 = [0, 0, 0];
    const vec2 = [1, 0, 0];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBe(0);
  });

  test('should throw error for different length vectors', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2];
    expect(() => cosineSimilarity(vec1, vec2)).toThrow();
  });

  test('should search similar chunks', async () => {
    const { getChunksByThreadId } = require('../lib/vector-storage');
    
    const mockChunks: VectorChunk[] = [
      {
        id: 'chunk-1',
        threadId: 'thread-1',
        fileId: 'file-1',
        text: 'This is about machine learning',
        embedding: [0.9, 0.1, 0.0],
        chunkIndex: 0,
        createdAt: Date.now(),
      },
      {
        id: 'chunk-2',
        threadId: 'thread-1',
        fileId: 'file-1',
        text: 'This is about cooking',
        embedding: [0.1, 0.9, 0.0],
        chunkIndex: 1,
        createdAt: Date.now(),
      },
      {
        id: 'chunk-3',
        threadId: 'thread-1',
        fileId: 'file-1',
        text: 'This is about AI',
        embedding: [0.8, 0.2, 0.0],
        chunkIndex: 2,
        createdAt: Date.now(),
      },
    ];

    getChunksByThreadId.mockResolvedValue(mockChunks);

    // Query vector similar to machine learning chunk
    const queryEmbedding = [0.95, 0.05, 0.0];
    const results = await searchSimilarChunks(queryEmbedding, 'thread-1', 2);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.text).toContain('machine learning');
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  test('should filter by min score', async () => {
    const { getChunksByThreadId } = require('../lib/vector-storage');
    
    const mockChunks: VectorChunk[] = [
      {
        id: 'chunk-1',
        threadId: 'thread-1',
        fileId: 'file-1',
        text: 'Relevant text',
        embedding: [0.9, 0.1],
        chunkIndex: 0,
        createdAt: Date.now(),
      },
      {
        id: 'chunk-2',
        threadId: 'thread-1',
        fileId: 'file-1',
        text: 'Irrelevant text',
        embedding: [0.1, 0.9],
        chunkIndex: 1,
        createdAt: Date.now(),
      },
    ];

    getChunksByThreadId.mockResolvedValue(mockChunks);

    const queryEmbedding = [0.95, 0.05];
    const results = await searchSimilarChunks(queryEmbedding, 'thread-1', 5, 0.7);

    // Only high similarity chunks should be returned
    results.forEach((result) => {
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });
  });
});

