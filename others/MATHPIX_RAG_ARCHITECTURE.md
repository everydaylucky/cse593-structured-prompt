# Mathpix + RAG 完整架构设计

## 一、整体架构

```
用户上传 PDF
    ↓
[前端] 文件选择 → 上传到 /api/files/process-pdf
    ↓
[后端 API] Mathpix API 解析 PDF → 返回 Markdown/Text
    ↓
[前端] 接收文本 → @langchain/text-splitters 分块（20% 重叠）
    ↓
[前端 Web Worker] @xenova/transformers 并行生成向量
    ↓
[前端] IndexedDB (idb) 存储向量和元数据
    ↓
用户提问 → 向量检索 → LLM 回答
```

---

## 二、技术栈选择

### 1. PDF 解析：Mathpix API ⭐

**为什么选择 Mathpix**：
- ✅ **专业 STEM 文档解析**：擅长数学公式、表格、化学图表
- ✅ **高质量输出**：返回结构化的 Markdown/LaTeX
- ✅ **支持复杂布局**：多栏、表格、公式都能正确处理
- ✅ **API 稳定**：生产环境使用

**参考文档**：[Mathpix API 文档](https://docs.mathpix.com/#process-a-pdf)

**成本考虑**：
- 有免费额度，但有限制
- 按页计费，需要评估成本
- 可以设置 `improve_mathpix: false` 降低隐私成本

---

### 2. 文本分块：@langchain/text-splitters

**选择**：`RecursiveCharacterTextSplitter`
- ✅ 智能语义分割
- ✅ 支持 20% 重叠（`chunkOverlap: 200`）
- ✅ 保持上下文完整性

---

### 3. 向量生成：@xenova/transformers

**模型**：`Xenova/all-MiniLM-L6-v2`
- ✅ 384 维，快速
- ✅ 浏览器端运行，免费
- ✅ 支持批量处理

---

### 4. 向量存储：IndexedDB + idb

**优点**：
- ✅ 浏览器内置，免费
- ✅ 支持大量数据
- ✅ 快速检索

---

## 三、详细架构设计

### 3.1 API 路由设计

#### `/api/files/process-pdf` (POST)

**功能**：接收 PDF 文件，调用 Mathpix API 解析

**请求**：
```typescript
FormData {
  file: File,
  threadId: string,
  options?: {
    formats?: ['text', 'data'],  // Mathpix 返回格式
    improve_mathpix?: boolean,   // 隐私选项
  }
}
```

**响应**：
```typescript
{
  success: boolean,
  fileId: string,
  text: string,              // 提取的文本（Markdown 格式）
  metadata: {
    pageCount: number,
    processedAt: number,
    mathpixRequestId: string,
  },
  error?: string
}
```

**实现要点**：
1. 从 `.env` 读取 `MATHPIX_API_KEY`（需要 `app_id` 和 `app_key`）
2. 上传 PDF 到 Mathpix API
3. 等待处理完成（可能需要轮询状态）
4. 返回解析后的文本

---

### 3.2 前端处理流程

#### 步骤 1：PDF 上传和解析

```typescript
// lib/pdf-processor.ts

export async function processPDFWithMathpix(
  file: File,
  threadId: string
): Promise<{
  fileId: string;
  text: string;
  metadata: any;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('threadId', threadId);
  
  const response = await fetch('/api/files/process-pdf', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('PDF processing failed');
  }
  
  return await response.json();
}
```

---

#### 步骤 2：文本分块（20% 重叠）

```typescript
// lib/text-chunker.ts

import { RecursiveCharacterTextSplitter } from '@langchain/text-splitters';

export async function chunkText(
  text: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Promise<Array<{
  text: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
}>> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize || 1000,
    chunkOverlap: options.chunkOverlap || 200, // 20% 重叠
    separators: ['\n\n', '\n', ' ', ''], // 智能分隔符
  });
  
  const documents = await splitter.createDocuments([text]);
  
  return documents.map((doc, index) => ({
    text: doc.pageContent,
    chunkIndex: index,
    startChar: 0, // 需要计算实际位置
    endChar: 0,
    metadata: doc.metadata,
  }));
}
```

---

#### 步骤 3：向量生成（Web Worker 并行）

```typescript
// lib/vector-generator.ts (主线程)
// workers/embedding.worker.ts (Web Worker)

// 主线程：分发任务到 Web Worker
export async function generateEmbeddingsParallel(
  chunks: string[],
  batchSize: number = 10
): Promise<number[][]> {
  // 创建 Web Worker
  const worker = new Worker(
    new URL('../workers/embedding.worker.ts', import.meta.url),
    { type: 'module' }
  );
  
  // 分批处理
  const batches: string[][] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }
  
  // 并行处理所有批次
  const results = await Promise.all(
    batches.map(batch => processBatch(worker, batch))
  );
  
  worker.terminate();
  return results.flat();
}

async function processBatch(worker: Worker, batch: string[]): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'error') {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.embeddings);
      }
    };
    
    worker.postMessage({ type: 'embed', texts: batch });
  });
}
```

**Web Worker 实现**：
```typescript
// workers/embedding.worker.ts

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
      
      // 批量生成向量
      const embeddings = await Promise.all(
        texts.map(async (text: string) => {
          const output = await embedder(text, {
            pooling: 'mean',
            normalize: true,
          });
          return Array.from(output.data);
        })
      );
      
      self.postMessage({ type: 'success', embeddings });
    } catch (error) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
};
```

---

#### 步骤 4：存储到 IndexedDB

```typescript
// lib/vector-storage.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VectorDB extends DBSchema {
  chunks: {
    key: string;
    value: {
      id: string;
      threadId: string;
      fileId: string;
      text: string;
      embedding: number[];
      chunkIndex: number;
      metadata: any;
      createdAt: number;
    };
    indexes: { 'by-threadId': string; 'by-fileId': string };
  };
  files: {
    key: string;
    value: {
      id: string;
      threadId: string;
      fileName: string;
      fileSize: number;
      pageCount: number;
      chunkCount: number;
      processedAt: number;
      mathpixRequestId: string;
    };
    indexes: { 'by-threadId': string };
  };
}

let db: IDBPDatabase<VectorDB> | null = null;

export async function initVectorDB() {
  if (db) return db;
  
  db = await openDB<VectorDB>('vector-db', 1, {
    upgrade(db) {
      // 创建 chunks 表
      const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
      chunkStore.createIndex('by-threadId', 'threadId');
      chunkStore.createIndex('by-fileId', 'fileId');
      
      // 创建 files 表
      const fileStore = db.createObjectStore('files', { keyPath: 'id' });
      fileStore.createIndex('by-threadId', 'threadId');
    },
  });
  
  return db;
}

export async function storeChunks(
  fileId: string,
  threadId: string,
  chunks: Array<{
    text: string;
    embedding: number[];
    chunkIndex: number;
    metadata: any;
  }>
) {
  const database = await initVectorDB();
  const tx = database.transaction('chunks', 'readwrite');
  
  const chunkPromises = chunks.map((chunk, index) => {
    const id = `${fileId}-chunk-${index}`;
    return tx.store.put({
      id,
      threadId,
      fileId,
      text: chunk.text,
      embedding: chunk.embedding,
      chunkIndex: chunk.chunkIndex,
      metadata: chunk.metadata,
      createdAt: Date.now(),
    });
  });
  
  await Promise.all(chunkPromises);
  await tx.done;
}

export async function storeFileMetadata(
  fileId: string,
  threadId: string,
  metadata: {
    fileName: string;
    fileSize: number;
    pageCount: number;
    chunkCount: number;
    mathpixRequestId: string;
  }
) {
  const database = await initVectorDB();
  await database.put('files', {
    id: fileId,
    threadId,
    ...metadata,
    processedAt: Date.now(),
  });
}
```

---

## 四、性能优化策略

### 4.1 并行处理

1. **PDF 解析**：Mathpix API 支持流式处理，可以逐页处理
2. **向量生成**：使用 Web Worker 并行处理多个块
3. **存储**：批量写入 IndexedDB

### 4.2 缓存策略

1. **模型缓存**：`@xenova/transformers` 会自动缓存模型到浏览器
2. **文件缓存**：已处理的 PDF 不重复处理
3. **向量缓存**：相同文本块不重复生成向量

### 4.3 进度反馈

```typescript
// 使用 EventEmitter 或 Callback 报告进度

interface ProcessingProgress {
  stage: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'complete';
  progress: number; // 0-100
  message?: string;
}

export function processPDFWithProgress(
  file: File,
  threadId: string,
  onProgress: (progress: ProcessingProgress) => void
): Promise<{ fileId: string }> {
  // 实现进度报告
}
```

---

## 五、错误处理和降级方案

### 5.1 Mathpix API 失败

**降级方案**：
1. 尝试使用 `pdfjs-dist` 作为备选
2. 提示用户重试
3. 记录错误日志

```typescript
async function parsePDFWithFallback(file: File): Promise<string> {
  try {
    // 尝试 Mathpix
    return await parseWithMathpix(file);
  } catch (error) {
    console.warn('Mathpix failed, using fallback:', error);
    // 降级到 pdfjs-dist
    return await parseWithPDFJS(file);
  }
}
```

### 5.2 向量生成失败

**策略**：
1. 重试机制（最多 3 次）
2. 跳过失败的块，继续处理其他块
3. 记录失败的块，稍后重试

### 5.3 存储失败

**策略**：
1. 检查 IndexedDB 配额
2. 清理旧数据
3. 提示用户清理浏览器数据

---

## 六、完整流程示例

```typescript
// lib/pdf-rag-pipeline.ts

export async function processPDFToRAG(
  file: File,
  threadId: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{ fileId: string; chunkCount: number }> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    // 1. 上传并解析 PDF (10%)
    onProgress?.({ stage: 'uploading', progress: 0 });
    const { text, metadata } = await processPDFWithMathpix(file, threadId);
    onProgress?.({ stage: 'parsing', progress: 10 });
    
    // 2. 文本分块 (20%)
    onProgress?.({ stage: 'chunking', progress: 20 });
    const chunks = await chunkText(text, {
      chunkSize: 1000,
      chunkOverlap: 200, // 20% 重叠
    });
    onProgress?.({ stage: 'chunking', progress: 30 });
    
    // 3. 生成向量 (50%)
    onProgress?.({ stage: 'embedding', progress: 30 });
    const embeddings = await generateEmbeddingsParallel(
      chunks.map(c => c.text),
      10 // 每批 10 个
    );
    onProgress?.({ stage: 'embedding', progress: 80 });
    
    // 4. 存储到 IndexedDB (20%)
    onProgress?.({ stage: 'storing', progress: 80 });
    await storeChunks(
      fileId,
      threadId,
      chunks.map((chunk, index) => ({
        text: chunk.text,
        embedding: embeddings[index],
        chunkIndex: chunk.chunkIndex,
        metadata: chunk.metadata,
      }))
    );
    
    await storeFileMetadata(fileId, threadId, {
      fileName: file.name,
      fileSize: file.size,
      pageCount: metadata.pageCount,
      chunkCount: chunks.length,
      mathpixRequestId: metadata.mathpixRequestId,
    });
    
    onProgress?.({ stage: 'complete', progress: 100 });
    
    return { fileId, chunkCount: chunks.length };
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw error;
  }
}
```

---

## 七、API 路由实现要点

### 7.1 `/api/files/process-pdf/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const threadId = formData.get('threadId') as string;
    
    if (!file || !threadId) {
      return NextResponse.json(
        { error: 'Missing file or threadId' },
        { status: 400 }
      );
    }
    
    // 读取环境变量
    const appId = process.env.MATHPIX_APP_ID;
    const appKey = process.env.MATHPIX_API_KEY; // 注意：Mathpix 需要 app_id 和 app_key
    
    if (!appId || !appKey) {
      return NextResponse.json(
        { error: 'Mathpix API credentials not configured' },
        { status: 500 }
      );
    }
    
    // 上传 PDF 到 Mathpix
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer]), file.name);
    formData.append('options_json', JSON.stringify({
      formats: ['text', 'data'],
      metadata: {
        improve_mathpix: false, // 隐私选项
      },
    }));
    
    const response = await fetch('https://api.mathpix.com/v3/pdf', {
      method: 'POST',
      headers: {
        'app_id': appId,
        'app_key': appKey,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Mathpix API error: ${error.error || response.statusText}`);
    }
    
    const result = await response.json();
    
    // 提取文本（根据 Mathpix 返回格式）
    const text = extractTextFromMathpixResponse(result);
    
    return NextResponse.json({
      success: true,
      fileId: `file-${Date.now()}`,
      text,
      metadata: {
        pageCount: result.page_count || 0,
        processedAt: Date.now(),
        mathpixRequestId: result.request_id,
      },
    });
  } catch (error) {
    console.error('PDF processing error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function extractTextFromMathpixResponse(result: any): string {
  // 根据 Mathpix 返回格式提取文本
  // 可能是 text 字段或 data 字段
  if (result.text) {
    return result.text;
  }
  if (result.data) {
    // 处理 data 格式
    return result.data.map((item: any) => item.value || '').join('\n');
  }
  return '';
}
```

---

## 八、环境变量配置

### `.env.local`

```bash
# Mathpix API 配置
MATHPIX_APP_ID=your_app_id
MATHPIX_API_KEY=your_app_key

# 注意：Mathpix 需要两个值：
# - app_id: 应用 ID
# - app_key: API 密钥
```

---

## 九、性能优化建议

### 9.1 并行处理

1. **PDF 解析**：如果 Mathpix 支持，可以并行处理多页
2. **向量生成**：使用 Web Worker 池，并行处理多个块
3. **存储**：批量写入 IndexedDB（每批 100 个）

### 9.2 缓存策略

1. **模型缓存**：`@xenova/transformers` 自动缓存到浏览器
2. **文件去重**：检查文件 hash，避免重复处理
3. **增量更新**：只处理新增的页面

### 9.3 内存管理

1. **流式处理**：大文件分页处理
2. **及时释放**：处理完的块及时释放内存
3. **Web Worker 复用**：复用 Worker，避免重复创建

---

## 十、实施步骤

### 阶段 1：基础实现（3-5 天）

1. ✅ 创建 `/api/files/process-pdf` API 路由
2. ✅ 实现 Mathpix API 集成
3. ✅ 实现文本分块（@langchain/text-splitters）
4. ✅ 实现向量生成（@xenova/transformers）
5. ✅ 实现 IndexedDB 存储（idb）

### 阶段 2：性能优化（2-3 天）

1. ✅ 实现 Web Worker 并行处理
2. ✅ 实现进度反馈
3. ✅ 实现错误处理和降级

### 阶段 3：UI 集成（2-3 天）

1. ✅ 文件上传 UI
2. ✅ 处理进度显示
3. ✅ 文件管理面板

---

## 十一、依赖安装

```bash
# PDF 解析（服务器端）
# Mathpix API 通过 HTTP 调用，无需额外库

# 文本分块
npm install @langchain/text-splitters

# 向量生成
npm install @xenova/transformers

# IndexedDB
npm install idb

# 类型定义（如果需要）
npm install -D @types/node
```

---

## 十二、注意事项

1. **Mathpix API 限制**：
   - 有免费额度限制
   - 按页计费
   - 需要评估成本

2. **隐私设置**：
   - 设置 `improve_mathpix: false` 保护隐私
   - 但结果不会出现在 Mathpix Console

3. **错误处理**：
   - Mathpix API 可能失败，需要降级方案
   - 向量生成可能较慢，需要进度反馈

4. **存储限制**：
   - IndexedDB 有容量限制（通常 50MB - 1GB）
   - 需要监控存储使用情况

---

## 十三、参考资源

- [Mathpix API 文档](https://docs.mathpix.com/#process-a-pdf)
- [@langchain/text-splitters 文档](https://js.langchain.com/docs/modules/data_connection/document_transformers/)
- [@xenova/transformers 文档](https://huggingface.co/docs/transformers.js)
- [idb 文档](https://github.com/jakearchibald/idb)

