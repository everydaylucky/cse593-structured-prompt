/**
 * 向量存储测试
 */

import {
  initVectorDB,
  storeChunks,
  storeFileMetadata,
  getChunksByFileId,
  getChunksByThreadId,
  getFileMetadata,
  getFilesByThreadId,
  deleteFile,
  deleteThreadData,
} from '../lib/vector-storage';

// Mock IndexedDB for testing
const mockDB: any = {
  chunks: new Map(),
  files: new Map(),
};

// Mock idb
jest.mock('idb', () => ({
  openDB: jest.fn(async () => {
    return {
      transaction: (stores: string[]) => ({
        objectStore: (store: string) => ({
          put: async (value: any) => {
            mockDB[store].set(value.id, value);
          },
          get: async (key: string) => mockDB[store].get(key),
          delete: async (key: string) => mockDB[store].delete(key),
          index: (indexName: string) => ({
            getAll: async (key: string) => {
              const results: any[] = [];
              for (const value of mockDB[store].values()) {
                if (value[indexName] === key) {
                  results.push(value);
                }
              }
              return results;
            },
          }),
        }),
        store: {
          index: (indexName: string) => ({
            getAll: async (key: string) => {
              const results: any[] = [];
              for (const value of mockDB.chunks.values()) {
                if (value[indexName] === key) {
                  results.push(value);
                }
              }
              return results;
            },
          }),
        },
        done: Promise.resolve(),
      }),
      get: async (store: string, key: string) => mockDB[store].get(key),
      put: async (store: string, value: any) => {
        mockDB[store].set(value.id, value);
      },
    };
  }),
}));

describe('Vector Storage', () => {
  beforeEach(() => {
    mockDB.chunks.clear();
    mockDB.files.clear();
  });

  test('should initialize database', async () => {
    const db = await initVectorDB();
    expect(db).toBeDefined();
  });

  test('should store chunks', async () => {
    const fileId = 'test-file-1';
    const threadId = 'test-thread-1';
    const chunks = [
      {
        text: 'Test chunk 1',
        embedding: [0.1, 0.2, 0.3],
        chunkIndex: 0,
        metadata: {},
      },
      {
        text: 'Test chunk 2',
        embedding: [0.4, 0.5, 0.6],
        chunkIndex: 1,
        metadata: {},
      },
    ];

    await storeChunks(fileId, threadId, chunks);

    const storedChunks = await getChunksByFileId(fileId);
    expect(storedChunks.length).toBe(2);
    expect(storedChunks[0].text).toBe('Test chunk 1');
    expect(storedChunks[1].text).toBe('Test chunk 2');
  });

  test('should store file metadata', async () => {
    const fileId = 'test-file-1';
    const threadId = 'test-thread-1';
    const metadata = {
      fileName: 'test.pdf',
      fileSize: 1024,
      pageCount: 10,
      chunkCount: 5,
      mathpixRequestId: 'req-123',
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    };

    await storeFileMetadata(fileId, threadId, metadata);

    const stored = await getFileMetadata(fileId);
    expect(stored).toBeDefined();
    expect(stored?.fileName).toBe('test.pdf');
    expect(stored?.pageCount).toBe(10);
  });

  test('should get chunks by thread ID', async () => {
    const threadId = 'test-thread-1';
    const fileId1 = 'test-file-1';
    const fileId2 = 'test-file-2';

    await storeChunks(fileId1, threadId, [
      {
        text: 'Chunk from file 1',
        embedding: [0.1, 0.2],
        chunkIndex: 0,
      },
    ]);

    await storeChunks(fileId2, threadId, [
      {
        text: 'Chunk from file 2',
        embedding: [0.3, 0.4],
        chunkIndex: 0,
      },
    ]);

    const chunks = await getChunksByThreadId(threadId);
    expect(chunks.length).toBe(2);
  });

  test('should get files by thread ID', async () => {
    const threadId = 'test-thread-1';

    await storeFileMetadata('file-1', threadId, {
      fileName: 'file1.pdf',
      fileSize: 1000,
      pageCount: 5,
      chunkCount: 3,
    });

    await storeFileMetadata('file-2', threadId, {
      fileName: 'file2.pdf',
      fileSize: 2000,
      pageCount: 10,
      chunkCount: 6,
    });

    const files = await getFilesByThreadId(threadId);
    expect(files.length).toBe(2);
  });

  test('should delete file and its chunks', async () => {
    const fileId = 'test-file-1';
    const threadId = 'test-thread-1';

    await storeChunks(fileId, threadId, [
      {
        text: 'Test chunk',
        embedding: [0.1, 0.2],
        chunkIndex: 0,
      },
    ]);

    await storeFileMetadata(fileId, threadId, {
      fileName: 'test.pdf',
      fileSize: 1000,
      pageCount: 1,
      chunkCount: 1,
    });

    await deleteFile(fileId);

    const chunks = await getChunksByFileId(fileId);
    const file = await getFileMetadata(fileId);

    expect(chunks.length).toBe(0);
    expect(file).toBeUndefined();
  });
});

