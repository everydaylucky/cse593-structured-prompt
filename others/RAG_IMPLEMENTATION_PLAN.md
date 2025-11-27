# 向量化 + RAG 实现方案

## 一、架构设计

### 1.1 整体架构

```
用户上传 PDF
    ↓
[前端] 文件上传到 /api/files/upload
    ↓
[后端] 解析 PDF → 分块 → 生成向量嵌入
    ↓
[存储] 向量存储到 IndexedDB（本地）或 Google Drive（可选）
    ↓
用户提问
    ↓
[检索] 向量相似度搜索 → 找到相关块
    ↓
[生成] 相关块 + 用户问题 → LLM → 回答
```

---

## 二、技术选型

### 2.1 向量数据库（免费方案）

#### 方案 A：IndexedDB + 本地向量计算 ⭐ **推荐**

**优点**：
- ✅ **完全免费**：浏览器内置，无需服务器
- ✅ **隐私保护**：数据完全本地，不上传
- ✅ **离线可用**：不依赖网络
- ✅ **容量大**：通常支持 50MB - 1GB

**实现**：
- 使用 `@xenova/transformers` 在浏览器端生成向量（免费）
- 使用 `IndexedDB` 存储向量和元数据
- 使用 `hnswlib-wasm` 或 `faiss-wasm` 进行向量搜索

**限制**：
- 向量计算在浏览器端，大文件可能较慢
- 存储容量受浏览器限制

#### 方案 B：Chroma（本地部署）

**优点**：
- ✅ **开源免费**：MIT 许可证
- ✅ **轻量级**：可以本地运行
- ✅ **API 简单**：易于集成

**实现**：
- 在 Next.js API 路由中运行 Chroma
- 或使用 Chroma 的 JavaScript 客户端

**限制**：
- 需要服务器端运行
- 需要额外的存储空间

#### 方案 C：Google Drive + 向量文件存储

**优点**：
- ✅ **免费存储**：15GB 免费空间
- ✅ **跨设备同步**：可以在不同设备访问
- ✅ **参考 Cursor**：类似 Cursor 的设计

**实现**：
- 使用 Google Drive API 存储原始文件和向量数据
- 向量数据以 JSON 格式存储在 Drive 中
- 需要用户授权 Google Drive 访问

**限制**：
- 需要网络连接
- 需要 Google 账户授权

---

### 2.2 嵌入模型（免费方案）

#### 方案 A：浏览器端嵌入模型 ⭐ **推荐**

**使用 `@xenova/transformers`**：
- 完全在浏览器运行，无需 API 调用
- 支持多种模型：`Xenova/all-MiniLM-L6-v2`（384 维）
- 免费，无需 API key

```typescript
import { pipeline } from '@xenova/transformers';

const generateEmbedding = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

const embedding = await generateEmbedding(text, {
  pooling: 'mean',
  normalize: true
});
```

#### 方案 B：OpenAI Embeddings API

**优点**：
- 质量高：`text-embedding-3-small` 或 `text-embedding-3-large`
- 速度快：服务器端计算

**缺点**：
- 需要 API key
- 有费用（但很便宜：$0.02 / 1M tokens）

#### 方案 C：Google Gemini Embeddings

**优点**：
- 免费额度高
- 与 Gemini 模型集成好

---

### 2.3 PDF 解析

**使用 `pdf-parse` 或 `pdfjs-dist`**：
- 在服务器端解析 PDF
- 提取文本和元数据（页码、章节等）

---

## 三、实现方案（推荐：IndexedDB + 浏览器端嵌入）

### 3.1 数据结构

```typescript
// lib/vector-storage.ts

export interface VectorChunk {
  id: string;                    // chunk ID
  threadId: string;              // 所属 thread
  fileId: string;                // 所属文件
  text: string;                  // 原始文本
  embedding: number[];           // 向量嵌入（384 维）
  metadata: {
    page?: number;               // PDF 页码
    chunkIndex: number;          // 块索引
    startChar?: number;          // 起始字符位置
    endChar?: number;            // 结束字符位置
  };
  createdAt: number;
}

export interface FileVectorIndex {
  id: string;                    // file ID
  threadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl?: string;              // 原始文件 URL（如果存储在云端）
  chunks: VectorChunk[];
  uploadedAt: number;
  processedAt: number;
  embeddingModel: string;       // 使用的嵌入模型
}
```

---

### 3.2 核心实现

#### 步骤 1：创建向量存储模块

```typescript
// lib/vector-storage.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';

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

// 存储向量块
export async function storeChunks(chunks: VectorChunk[]) {
  const database = await initVectorDB();
  const tx = database.transaction('chunks', 'readwrite');
  await Promise.all(chunks.map(chunk => tx.store.put(chunk)));
  await tx.done;
}

// 搜索相似块
export async function searchSimilarChunks(
  queryEmbedding: number[],
  threadId: string,
  topK: number = 5
): Promise<VectorChunk[]> {
  const database = await initVectorDB();
  const chunks = await database
    .transaction('chunks')
    .store
    .index('by-threadId')
    .getAll(threadId);
  
  // 计算余弦相似度
  const scored = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  
  // 排序并返回 topK
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.chunk);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

---

#### 步骤 2：创建 PDF 解析和向量化 API

```typescript
// app/api/files/process/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { pipeline } from '@xenova/transformers';
import pdf from 'pdf-parse';

// 初始化嵌入模型（缓存）
let embedder: any = null;
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const threadId = formData.get('threadId') as string;
  
  if (!file || !threadId) {
    return NextResponse.json({ error: 'Missing file or threadId' }, { status: 400 });
  }
  
  try {
    // 1. 解析 PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdf(buffer);
    const text = pdfData.text;
    
    // 2. 分块（每块 1000 字符，重叠 200 字符）
    const chunks = splitTextIntoChunks(text, {
      chunkSize: 1000,
      overlap: 200,
    });
    
    // 3. 生成向量嵌入
    const embedder = await getEmbedder();
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const output = await embedder(chunk.text, {
          pooling: 'mean',
          normalize: true,
        });
        const embedding = Array.from(output.data);
        
        return {
          id: `chunk-${Date.now()}-${index}`,
          threadId,
          fileId: `file-${Date.now()}`,
          text: chunk.text,
          embedding,
          metadata: {
            chunkIndex: index,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
          },
          createdAt: Date.now(),
        };
      })
    );
    
    // 4. 存储到 IndexedDB（前端调用）
    // 这里返回数据，由前端存储
    
    return NextResponse.json({
      fileId: `file-${Date.now()}`,
      fileName: file.name,
      chunks: chunksWithEmbeddings,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}

function splitTextIntoChunks(
  text: string,
  options: { chunkSize: number; overlap: number }
): Array<{ text: string; startChar: number; endChar: number }> {
  const chunks: Array<{ text: string; startChar: number; endChar: number }> = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + options.chunkSize, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      text: chunkText,
      startChar: start,
      endChar: end,
    });
    
    start = end - options.overlap;
  }
  
  return chunks;
}
```

---

#### 步骤 3：前端向量存储和检索

```typescript
// lib/vector-client.ts

import { initVectorDB, storeChunks, searchSimilarChunks } from './vector-storage';
import { pipeline } from '@xenova/transformers';

// 初始化嵌入模型（浏览器端）
let embedder: any = null;
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

// 处理上传的文件
export async function processUploadedFile(
  file: File,
  threadId: string
): Promise<string> {
  // 1. 上传文件到服务器处理
  const formData = new FormData();
  formData.append('file', file);
  formData.append('threadId', threadId);
  
  const response = await fetch('/api/files/process', {
    method: 'POST',
    body: formData,
  });
  
  const { fileId, chunks } = await response.json();
  
  // 2. 存储到 IndexedDB
  await storeChunks(chunks);
  
  // 3. 存储文件索引
  const db = await initVectorDB();
  await db.put('files', {
    id: fileId,
    threadId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    chunks: chunks.map(c => c.id),
    uploadedAt: Date.now(),
    processedAt: Date.now(),
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  });
  
  return fileId;
}

// 检索相关块
export async function retrieveRelevantChunks(
  query: string,
  threadId: string,
  topK: number = 5
): Promise<Array<{ text: string; metadata: any }>> {
  // 1. 生成查询向量
  const embedder = await getEmbedder();
  const output = await embedder(query, {
    pooling: 'mean',
    normalize: true,
  });
  const queryEmbedding = Array.from(output.data);
  
  // 2. 搜索相似块
  const chunks = await searchSimilarChunks(queryEmbedding, threadId, topK);
  
  // 3. 返回文本和元数据
  return chunks.map(chunk => ({
    text: chunk.text,
    metadata: chunk.metadata,
  }));
}
```

---

#### 步骤 4：集成到聊天 API

```typescript
// app/api/chat/route.ts (修改)

import { retrieveRelevantChunks } from '@/lib/vector-client';

export async function POST(req: Request) {
  const { messages, userStudyMode = true, threadId }: ChatRequestBody = await req.json();
  
  const lastMessage = messages[messages.length - 1];
  const userQuery = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : lastMessage.content?.find((part: any) => part.type === 'text')?.text || '';
  
  // 如果有 threadId，尝试检索相关文档块
  let contextChunks: string[] = [];
  if (threadId) {
    try {
      const chunks = await retrieveRelevantChunks(userQuery, threadId, 5);
      contextChunks = chunks.map(c => c.text);
    } catch (error) {
      console.error('Vector retrieval failed:', error);
      // 继续执行，不使用 RAG
    }
  }
  
  // 构建增强的消息
  const enhancedMessages = contextChunks.length > 0
    ? [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          content: [
            `基于以下文档内容回答：\n\n${contextChunks.join('\n\n---\n\n')}\n\n问题：${userQuery}`,
          ],
        },
      ]
    : messages;
  
  // 继续原有的处理逻辑...
  const provider = createModelProvider(parsed.model);
  return provider.streamText({
    messages: enhancedMessages,
    system: userStudyMode ? systemPrompt : undefined,
    config: parsed.model.config,
  });
}
```

---

## 四、UI 集成

### 4.1 文件上传 UI

在 `attachment.tsx` 中扩展，显示文件处理状态：

```typescript
// components/assistant-ui/file-upload-status.tsx

export function FileUploadStatus({ fileId, status }: { fileId: string; status: 'uploading' | 'processing' | 'ready' | 'error' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {status === 'uploading' && <Loader2 className="animate-spin" />}
      {status === 'processing' && <FileText className="animate-pulse" />}
      {status === 'ready' && <CheckCircle className="text-green-500" />}
      {status === 'error' && <XCircle className="text-red-500" />}
      <span>
        {status === 'uploading' && '上传中...'}
        {status === 'processing' && '处理中（生成向量索引）...'}
        {status === 'ready' && '已就绪，可以提问'}
        {status === 'error' && '处理失败'}
      </span>
    </div>
  );
}
```

### 4.2 文件管理面板

在侧边栏或对话页面显示已上传的文件：

```typescript
// components/assistant-ui/file-manager.tsx

export function FileManager({ threadId }: { threadId: string }) {
  const [files, setFiles] = useState<FileVectorIndex[]>([]);
  
  useEffect(() => {
    loadFiles(threadId).then(setFiles);
  }, [threadId]);
  
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">已上传文件</h3>
      {files.map(file => (
        <div key={file.id} className="flex items-center gap-2 p-2 rounded border">
          <FileText className="size-4" />
          <span className="text-sm flex-1">{file.fileName}</span>
          <span className="text-xs text-muted-foreground">
            {file.chunks.length} 块
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## 五、存储方案选择

### 5.1 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **IndexedDB（本地）** | 免费、隐私、离线 | 容量限制、不跨设备 | 个人使用、隐私敏感 |
| **Google Drive** | 免费 15GB、跨设备 | 需要授权、需要网络 | 多设备使用、参考 Cursor |
| **混合方案** | 灵活、可切换 | 实现复杂 | 需要灵活性的场景 |

### 5.2 推荐方案：IndexedDB + 可选 Google Drive

**默认使用 IndexedDB**：
- 完全本地，隐私保护
- 无需授权，开箱即用

**可选启用 Google Drive**：
- 用户可以选择同步到 Google Drive
- 实现跨设备访问
- 参考 Cursor 的设计

---

## 六、Google Drive 集成（可选）

### 6.1 实现步骤

1. **设置 Google Drive API**：
   - 在 Google Cloud Console 创建项目
   - 启用 Drive API
   - 创建 OAuth 2.0 凭证

2. **前端授权**：
```typescript
// lib/google-drive.ts

export async function authorizeGoogleDrive() {
  // 使用 Google Identity Services 进行授权
  // 获取 access_token
}

export async function uploadToDrive(file: File, vectors: VectorChunk[]) {
  // 上传文件到 Drive
  // 存储向量数据为 JSON 文件
}
```

3. **存储结构**：
```
Google Drive/
  └── structify/
      └── [threadId]/
          ├── files/
          │   └── [fileId].pdf
          └── vectors/
              └── [fileId].vectors.json
```

---

## 七、实施优先级

### 阶段 1：基础实现（1-2 周）
1. ✅ 实现 IndexedDB 向量存储
2. ✅ 实现 PDF 解析和分块
3. ✅ 集成浏览器端嵌入模型
4. ✅ 实现向量检索
5. ✅ 集成到聊天 API

### 阶段 2：UI 优化（1 周）
1. ✅ 文件上传状态显示
2. ✅ 文件管理面板
3. ✅ 检索结果预览

### 阶段 3：高级功能（可选，2-3 周）
1. ⭐ Google Drive 集成
2. ⭐ 本地文件系统集成（Electron）
3. ⭐ 向量缓存和优化
4. ⭐ 多文件检索

---

## 八、依赖安装

```bash
# 向量存储
npm install idb

# 嵌入模型（浏览器端）
npm install @xenova/transformers

# PDF 解析
npm install pdf-parse

# Google Drive（可选）
npm install googleapis
```

---

## 九、注意事项

1. **性能优化**：
   - 大文件分块处理，避免阻塞
   - 向量计算使用 Web Worker
   - 缓存嵌入模型，避免重复加载

2. **存储限制**：
   - IndexedDB 通常支持 50MB - 1GB
   - 超过限制时提示用户或使用 Google Drive

3. **隐私保护**：
   - 所有数据默认本地存储
   - Google Drive 集成需要用户明确授权

4. **错误处理**：
   - 文件解析失败时的降级方案
   - 向量检索失败时的回退（直接使用文件）

---

## 十、参考资源

- **@xenova/transformers**: https://huggingface.co/docs/transformers.js
- **IndexedDB API**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Google Drive API**: https://developers.google.com/drive/api
- **Cursor 设计参考**: 观察 Cursor 的文件管理界面

