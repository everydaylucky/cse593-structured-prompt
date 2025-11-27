# PDF 解析、分块、向量化工具推荐

## 一、PDF 解析库（JavaScript/TypeScript）

### 1. **pdfjs-dist** ⭐⭐⭐⭐⭐ **最推荐**

**GitHub**: https://github.com/mozilla/pdf.js  
**npm**: `npm install pdfjs-dist`

**优点**：
- ✅ **Mozilla 官方维护**，稳定可靠
- ✅ **浏览器端和 Node.js 都支持**
- ✅ **性能优秀**，广泛使用
- ✅ **TypeScript 支持良好**
- ✅ **完全免费**

**使用示例**：
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// 设置 worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function extractTextFromPDF(buffer: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}
```

**适用场景**：浏览器端和服务器端都可用，推荐用于 Next.js 项目

---

### 2. **pdf-parse** ⭐⭐⭐⭐

**npm**: `npm install pdf-parse`

**优点**：
- ✅ **简单易用**，API 简洁
- ✅ **纯 Node.js**，适合服务器端
- ✅ **轻量级**

**缺点**：
- ⚠️ 只支持 Node.js，不支持浏览器

**使用示例**：
```typescript
import pdf from 'pdf-parse';

async function extractText(buffer: Buffer) {
  const data = await pdf(buffer);
  return data.text;
}
```

**适用场景**：Next.js API 路由（服务器端）

---

### 3. **pdf-lib** ⭐⭐⭐

**npm**: `npm install pdf-lib`

**优点**：
- ✅ 支持创建和修改 PDF
- ✅ 浏览器和 Node.js 都支持

**缺点**：
- ⚠️ 文本提取功能不如 pdfjs-dist 强大

**适用场景**：需要修改 PDF 的场景

---

## 二、文本分块库（带 20% 重叠）

### 1. **@langchain/text-splitters** ⭐⭐⭐⭐⭐ **最推荐**

**npm**: `npm install @langchain/text-splitters`

**优点**：
- ✅ **LangChain 官方库**，成熟稳定
- ✅ **支持多种分块策略**（RecursiveCharacterTextSplitter, MarkdownTextSplitter 等）
- ✅ **内置重叠支持**
- ✅ **TypeScript 支持**

**使用示例**：
```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/text-splitters';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,        // 每块 1000 字符
  chunkOverlap: 200,      // 重叠 200 字符（20%）
  separators: ['\n\n', '\n', ' ', ''], // 分隔符优先级
});

const chunks = await splitter.createDocuments([text]);
// chunks 是 Document 对象数组，每个有 pageContent 和 metadata
```

**适用场景**：需要智能分块，保持语义完整性

---

### 2. **自定义实现** ⭐⭐⭐⭐

**优点**：
- ✅ **完全控制**，可以根据需求定制
- ✅ **无依赖**，轻量级
- ✅ **易于理解**

**实现示例**：
```typescript
interface Chunk {
  text: string;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
}

function splitTextWithOverlap(
  text: string,
  chunkSize: number = 1000,
  overlapPercent: number = 0.2
): Chunk[] {
  const chunks: Chunk[] = [];
  const overlap = Math.floor(chunkSize * overlapPercent);
  const step = chunkSize - overlap;
  
  let start = 0;
  let chunkIndex = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      text: chunkText,
      startIndex: start,
      endIndex: end,
      chunkIndex: chunkIndex++,
    });
    
    start += step;
  }
  
  return chunks;
}
```

**适用场景**：简单场景，不需要复杂的语义分割

---

## 三、向量嵌入生成（免费/低成本）

### 1. **@xenova/transformers** ⭐⭐⭐⭐⭐ **最推荐（浏览器端）**

**npm**: `npm install @xenova/transformers`

**优点**：
- ✅ **完全免费**，浏览器端运行
- ✅ **无需 API key**
- ✅ **支持多种模型**：`Xenova/all-MiniLM-L6-v2`（384 维，快速）
- ✅ **离线可用**

**使用示例**：
```typescript
import { pipeline } from '@xenova/transformers';

// 初始化（只执行一次，会缓存模型）
const generateEmbedding = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

// 生成向量
const output = await generateEmbedding(text, {
  pooling: 'mean',
  normalize: true,
});

const embedding = Array.from(output.data); // 384 维向量
```

**模型选择**：
- `Xenova/all-MiniLM-L6-v2`: 384 维，快速，适合大多数场景
- `Xenova/all-mpnet-base-v2`: 768 维，更准确但更慢

**适用场景**：浏览器端，完全免费，隐私保护

---

### 2. **OpenAI Embeddings API** ⭐⭐⭐⭐

**优点**：
- ✅ **质量高**：`text-embedding-3-small`（1536 维）或 `text-embedding-3-large`（3072 维）
- ✅ **速度快**：服务器端计算
- ✅ **稳定可靠**

**缺点**：
- ⚠️ 需要 API key
- ⚠️ 有费用（但很便宜：$0.02 / 1M tokens）

**使用示例**：
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text,
});

const embedding = response.data[0].embedding; // 1536 维向量
```

**适用场景**：需要高质量嵌入，预算充足

---

### 3. **Google Gemini Embeddings** ⭐⭐⭐

**优点**：
- ✅ 免费额度高
- ✅ 与 Gemini 模型集成好

**缺点**：
- ⚠️ API 相对较新，文档较少

---

## 四、向量搜索库（IndexedDB）

### 1. **自定义实现（余弦相似度）** ⭐⭐⭐⭐⭐ **推荐**

**优点**：
- ✅ **完全免费**，无依赖
- ✅ **简单高效**
- ✅ **易于理解**

**实现示例**：
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function searchSimilarChunks(
  queryEmbedding: number[],
  chunks: VectorChunk[],
  topK: number = 5
): Promise<VectorChunk[]> {
  const scored = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.chunk);
}
```

**适用场景**：小到中等规模（< 10,000 块）

---

### 2. **hnswlib-wasm** ⭐⭐⭐⭐

**npm**: `npm install hnswlib-wasm`

**优点**：
- ✅ **高性能**：HNSW 算法，适合大规模搜索
- ✅ **WASM 实现**，浏览器端运行
- ✅ **开源免费**

**缺点**：
- ⚠️ 需要额外的构建步骤

**适用场景**：大规模向量搜索（> 10,000 块）

---

### 3. **faiss-wasm** ⭐⭐⭐

**npm**: `npm install faiss-wasm`

**优点**：
- ✅ Facebook 的 FAISS 库的 WASM 版本
- ✅ 性能优秀

**缺点**：
- ⚠️ 包体积较大
- ⚠️ 配置复杂

**适用场景**：需要极致性能的大规模搜索

---

## 五、完整解决方案推荐

### 方案 A：浏览器端全流程（推荐）⭐

**技术栈**：
- PDF 解析：`pdfjs-dist`
- 文本分块：`@langchain/text-splitters`
- 向量生成：`@xenova/transformers`
- 向量存储：`IndexedDB` + 自定义余弦相似度搜索

**优点**：
- ✅ 完全免费
- ✅ 隐私保护（数据不上传）
- ✅ 离线可用

**安装**：
```bash
npm install pdfjs-dist @langchain/text-splitters @xenova/transformers idb
```

---

### 方案 B：服务器端处理（高性能）

**技术栈**：
- PDF 解析：`pdf-parse`（Node.js API 路由）
- 文本分块：`@langchain/text-splitters`
- 向量生成：`@xenova/transformers` 或 OpenAI Embeddings API
- 向量存储：`IndexedDB`（前端）或 Chroma（服务器）

**优点**：
- ✅ 处理速度快
- ✅ 可以处理大文件

**安装**：
```bash
npm install pdf-parse @langchain/text-splitters @xenova/transformers idb
```

---

## 六、GitHub 参考项目

### 1. **vercel/ai-chatbot** ⭐⭐⭐⭐⭐

**GitHub**: https://github.com/vercel/ai-chatbot  
**特点**：
- Vercel 官方示例
- Next.js + TypeScript
- 包含 RAG 实现示例

---

### 2. **langchain-ai/langchainjs** ⭐⭐⭐⭐⭐

**GitHub**: https://github.com/langchain-ai/langchainjs  
**特点**：
- LangChain 官方 TypeScript 实现
- 包含完整的 RAG 示例
- 文档完善

---

### 3. **mendableai/firecrawl-rag** ⭐⭐⭐⭐

**GitHub**: https://github.com/mendableai/firecrawl-rag  
**特点**：
- 完整的 RAG 实现
- 包含 PDF 处理示例

---

## 七、成本对比

| 方案 | PDF 解析 | 分块 | 向量生成 | 向量搜索 | 总成本 |
|------|---------|------|---------|---------|--------|
| **方案 A（浏览器端）** | 免费 | 免费 | 免费 | 免费 | **$0** |
| **方案 B（服务器端）** | 免费 | 免费 | $0.02/1M tokens | 免费 | **~$0.02/1M tokens** |

**结论**：方案 A 完全免费，推荐用于个人项目。

---

## 八、实施建议

### 阶段 1：快速原型（1-2 天）

1. 使用 `pdfjs-dist` 解析 PDF
2. 使用自定义函数实现简单分块（20% 重叠）
3. 使用 `@xenova/transformers` 生成向量
4. 使用 `IndexedDB` 存储
5. 使用余弦相似度搜索

### 阶段 2：优化（1 周）

1. 集成 `@langchain/text-splitters` 实现智能分块
2. 优化向量搜索性能
3. 添加缓存机制

### 阶段 3：高级功能（可选）

1. 集成 `hnswlib-wasm` 提升搜索性能
2. 添加多文件支持
3. 实现增量更新

---

## 九、快速开始代码

```typescript
// 1. 安装依赖
// npm install pdfjs-dist @langchain/text-splitters @xenova/transformers idb

// 2. PDF 解析
import * as pdfjsLib from 'pdfjs-dist';
const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
const text = await extractTextFromPDF(pdf);

// 3. 文本分块（20% 重叠）
import { RecursiveCharacterTextSplitter } from '@langchain/text-splitters';
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200, // 20%
});
const chunks = await splitter.createDocuments([text]);

// 4. 生成向量
import { pipeline } from '@xenova/transformers';
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const embedding = await embedder(chunk.text, { pooling: 'mean', normalize: true });

// 5. 存储到 IndexedDB
import { openDB } from 'idb';
const db = await openDB('vector-db', 1, { /* ... */ });
await db.put('chunks', { id, text: chunk.text, embedding: Array.from(embedding.data) });

// 6. 搜索
const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });
const results = await searchSimilarChunks(Array.from(queryEmbedding.data), chunks, 5);
```

---

## 十、总结

**最推荐的组合**：
1. **PDF 解析**：`pdfjs-dist`（浏览器端）或 `pdf-parse`（服务器端）
2. **文本分块**：`@langchain/text-splitters`（RecursiveCharacterTextSplitter，20% 重叠）
3. **向量生成**：`@xenova/transformers`（浏览器端，免费）
4. **向量存储**：`IndexedDB`（使用 `idb` 库）
5. **向量搜索**：自定义余弦相似度（小规模）或 `hnswlib-wasm`（大规模）

**总成本**：$0（完全免费）

**实施难度**：中等（1-2 周可以完成基础实现）

