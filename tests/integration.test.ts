/**
 * 集成测试
 * 测试完整的 PDF RAG 流程
 */

import { processPDFToRAG } from '../lib/pdf-rag-pipeline';
import { searchSimilarChunks } from '../lib/vector-search';
import { generateEmbedding } from '../lib/vector-generator';

// Mock dependencies
jest.mock('../lib/pdf-processor', () => ({
  processPDFWithMathpix: jest.fn(),
}));

jest.mock('../lib/vector-generator', () => ({
  generateEmbedding: jest.fn(),
  generateEmbeddingsParallel: jest.fn(),
}));

jest.mock('../lib/vector-storage', () => ({
  storeChunks: jest.fn(),
  storeFileMetadata: jest.fn(),
  getChunksByThreadId: jest.fn(),
}));

describe('PDF RAG Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process PDF through complete pipeline', async () => {
    const { processPDFWithMathpix } = require('../lib/pdf-processor');
    const { generateEmbeddingsParallel } = require('../lib/vector-generator');
    const { storeChunks, storeFileMetadata } = require('../lib/vector-storage');

    // Mock PDF processing
    processPDFWithMathpix.mockResolvedValue({
      fileId: 'test-file-1',
      text: 'This is a test PDF content. It has multiple sentences.',
      metadata: {
        pageCount: 1,
        processedAt: Date.now(),
        mathpixRequestId: 'req-123',
      },
    });

    // Mock embedding generation
    generateEmbeddingsParallel.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    // Mock storage
    storeChunks.mockResolvedValue(undefined);
    storeFileMetadata.mockResolvedValue(undefined);

    const mockFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });

    const progressCallback = jest.fn();

    const result = await processPDFToRAG(
      mockFile,
      'test-thread-1',
      progressCallback
    );

    expect(result).toHaveProperty('fileId');
    expect(result).toHaveProperty('chunkCount');
    expect(processPDFWithMathpix).toHaveBeenCalled();
    expect(generateEmbeddingsParallel).toHaveBeenCalled();
    expect(storeChunks).toHaveBeenCalled();
    expect(storeFileMetadata).toHaveBeenCalled();
    expect(progressCallback).toHaveBeenCalled();
  });

  test('should report progress through stages', async () => {
    const { processPDFWithMathpix } = require('../lib/pdf-processor');
    const { generateEmbeddingsParallel } = require('../lib/vector-generator');
    const { storeChunks, storeFileMetadata } = require('../lib/vector-storage');

    processPDFWithMathpix.mockResolvedValue({
      fileId: 'test-file-1',
      text: 'Test content',
      metadata: {
        pageCount: 1,
        processedAt: Date.now(),
        mathpixRequestId: 'req-123',
      },
    });

    generateEmbeddingsParallel.mockResolvedValue([[0.1, 0.2, 0.3]]);
    storeChunks.mockResolvedValue(undefined);
    storeFileMetadata.mockResolvedValue(undefined);

    const progressCallback = jest.fn();
    const mockFile = new File(['test'], 'test.pdf', {
      type: 'application/pdf',
    });

    await processPDFToRAG(mockFile, 'test-thread-1', progressCallback);

    // Check that progress was reported for different stages
    const stages = progressCallback.mock.calls.map((call) => call[0].stage);
    expect(stages).toContain('uploading');
    expect(stages).toContain('parsing');
    expect(stages).toContain('chunking');
    expect(stages).toContain('embedding');
    expect(stages).toContain('storing');
    expect(stages).toContain('complete');
  });

  test('should handle errors gracefully', async () => {
    const { processPDFWithMathpix } = require('../lib/pdf-processor');

    processPDFWithMathpix.mockRejectedValue(
      new Error('Mathpix API error')
    );

    const mockFile = new File(['test'], 'test.pdf', {
      type: 'application/pdf',
    });

    await expect(
      processPDFToRAG(mockFile, 'test-thread-1')
    ).rejects.toThrow();
  });
});

