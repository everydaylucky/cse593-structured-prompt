/**
 * 向量存储管理
 * 使用 IndexedDB 存储向量数据
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface VectorChunk {
  id: string;
  threadId: string;
  fileId: string;
  text: string;
  embedding: number[];
  chunkIndex: number;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface FileVectorIndex {
  id: string;
  threadId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  chunkCount: number;
  processedAt: number;
  mathpixRequestId?: string;
  embeddingModel?: string;
  folderId?: string; // 所属文件夹 ID
  metadata?: {
    title?: string; // Generated document title
    summary?: string;
    keywords?: string[];
    topics?: string[];
    keyPhrases?: string[];
    tableOfContents?: Array<{
      title: string;
      level: number; // 1 = 一级标题, 2 = 二级标题, etc.
      pageNumber?: number; // 如果可提取的话
      approximateChunkIndex?: number; // 估算的 chunk 索引（用于跳转）
      startChar?: number; // 目录条目在文档中的起始字符位置
      endChar?: number; // 目录条目在文档中的结束字符位置
    }>; // 文档目录结构
    entities?: {
      persons?: string[];
      organizations?: string[];
      locations?: string[];
      dates?: string[];
      other?: {
        emails?: string[];
        urls?: string[];
        currencies?: string[];
        percentages?: string[];
      };
    };
  }; // 文档元数据（由 GPT-4o-mini 生成 + 本地实体识别）
}

interface VectorDB extends DBSchema {
  chunks: {
    key: string;
    value: VectorChunk;
    indexes: { 'by-threadId': string; 'by-fileId': string };
  };
  files: {
    key: string;
    value: FileVectorIndex;
    indexes: { 'by-threadId': string };
  };
}

let db: IDBPDatabase<VectorDB> | null = null;

/**
 * 初始化向量数据库
 */
export async function initVectorDB(): Promise<IDBPDatabase<VectorDB>> {
  // 检查是否在服务器端（IndexedDB 是浏览器 API）
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is not available on server side. Vector storage operations must be performed on client side.');
  }

  if (db) return db;

  db = await openDB<VectorDB>('vector-db', 1, {
    upgrade(db) {
      // 创建 chunks 表
      if (!db.objectStoreNames.contains('chunks')) {
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunkStore.createIndex('by-threadId', 'threadId');
        chunkStore.createIndex('by-fileId', 'fileId');
      }

      // 创建 files 表
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-threadId', 'threadId');
      }
    },
  });

  return db;
}

/**
 * 存储向量块
 */
export async function storeChunks(
  fileId: string,
  threadId: string,
  chunks: Array<{
    text: string;
    embedding: number[];
    chunkIndex: number;
    metadata?: Record<string, any>;
  }>
): Promise<void> {
  const database = await initVectorDB();
  const tx = database.transaction('chunks', 'readwrite');

  const chunkPromises = chunks.map((chunk) => {
    const id = `${fileId}-chunk-${chunk.chunkIndex}`;
    return tx.store.put({
      id,
      threadId,
      fileId,
      text: chunk.text,
      embedding: chunk.embedding,
      chunkIndex: chunk.chunkIndex,
      metadata: chunk.metadata || {},
      createdAt: Date.now(),
    });
  });

  await Promise.all(chunkPromises);
  await tx.done;
}

/**
 * 存储文件元数据
 */
export async function storeFileMetadata(
  fileId: string,
  threadId: string,
  metadata: {
    fileName: string;
    fileSize: number;
    pageCount: number;
    chunkCount: number;
    mathpixRequestId?: string;
    embeddingModel?: string;
    folderId?: string;
    metadata?: FileVectorIndex['metadata']; // 文档分析元数据
  }
): Promise<void> {
  const database = await initVectorDB();
  const fileData: FileVectorIndex = {
    id: fileId,
    threadId,
    fileName: metadata.fileName,
    fileSize: metadata.fileSize,
    pageCount: metadata.pageCount,
    chunkCount: metadata.chunkCount,
    mathpixRequestId: metadata.mathpixRequestId,
    embeddingModel: metadata.embeddingModel,
    folderId: metadata.folderId,
    metadata: metadata.metadata, // 文档分析元数据
    processedAt: Date.now(),
  };
  
  console.log("[VectorStorage] Storing file metadata:", {
    fileId,
    fileName: fileData.fileName,
    hasMetadata: !!fileData.metadata,
    metadataKeys: fileData.metadata ? Object.keys(fileData.metadata) : [],
    hasSummary: !!fileData.metadata?.summary,
    hasEntities: !!fileData.metadata?.entities,
  });
  
  await database.put('files', fileData);
}

/**
 * 获取文件的所有块
 */
export async function getChunksByFileId(fileId: string): Promise<VectorChunk[]> {
  const database = await initVectorDB();
  const index = database.transaction('chunks').store.index('by-fileId');
  return await index.getAll(fileId);
}

/**
 * 获取线程的所有块
 */
export async function getChunksByThreadId(threadId: string): Promise<VectorChunk[]> {
  const database = await initVectorDB();
  const index = database.transaction('chunks').store.index('by-threadId');
  return await index.getAll(threadId);
}

/**
 * 获取文件元数据
 */
export async function getFileMetadata(fileId: string): Promise<FileVectorIndex | undefined> {
  const database = await initVectorDB();
  return await database.get('files', fileId);
}

/**
 * 获取线程的所有文件
 */
export async function getFilesByThreadId(threadId: string): Promise<FileVectorIndex[]> {
  const database = await initVectorDB();
  const index = database.transaction('files').store.index('by-threadId');
  return await index.getAll(threadId);
}

/**
 * 删除文件及其所有块
 */
export async function deleteFile(fileId: string): Promise<void> {
  const database = await initVectorDB();
  const tx = database.transaction(['chunks', 'files'], 'readwrite');

  // 删除所有块
  const index = tx.objectStore('chunks').index('by-fileId');
  const chunks = await index.getAll(fileId);
  await Promise.all(chunks.map((chunk) => tx.objectStore('chunks').delete(chunk.id)));

  // 删除文件元数据
  await tx.objectStore('files').delete(fileId);

  await tx.done;
}

/**
 * 更新文件元数据
 */
export async function updateFileMetadata(
  fileId: string,
  updates: Partial<Pick<FileVectorIndex, 'fileName' | 'folderId'>>
): Promise<void> {
  const database = await initVectorDB();
  const file = await database.get('files', fileId);
  
  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }

  await database.put('files', {
    ...file,
    ...updates,
  });
}

/**
 * 删除线程的所有数据
 */
export async function deleteThreadData(threadId: string): Promise<void> {
  const database = await initVectorDB();
  const tx = database.transaction(['chunks', 'files'], 'readwrite');

  // 删除所有块
  const chunks = await getChunksByThreadId(threadId);
  await Promise.all(chunks.map((chunk) => tx.objectStore('chunks').delete(chunk.id)));

  // 删除所有文件
  const files = await getFilesByThreadId(threadId);
  await Promise.all(files.map((file) => tx.objectStore('files').delete(file.id)));

  await tx.done;
}

