# RAG 增强架构文档

## 概述

这是一个多阶段的 RAG（检索增强生成）优化系统，使用 GPT-4o-mini 进行查询增强和混合检索，提升文档检索的准确性和相关性。

## 架构流程

### 阶段1：文档预处理（可选，未来实现）

在 PDF 处理时，使用 GPT-4o-mini 生成文档元数据：

```typescript
generateDocumentMetadata(documentText, fileName)
```

**生成内容**：
- **摘要**：2-3 句话的文档摘要
- **关键词**：10-15 个最重要的术语
- **主题**：3-5 个主要主题
- **关键短语**：5-10 个重要短语或概念

**存储位置**：`FileVectorIndex.metadata`

### 阶段2：查询增强（已实现）

在检索前，使用 GPT-4o-mini 增强用户查询：

```typescript
enhanceQuery(userQuery)
```

**增强内容**：
- **增强查询**：更适合文档检索的查询版本
- **关键概念**：从查询中提取的核心概念
- **同义词**：相关术语和同义词
- **搜索词**：用于关键词匹配的术语

**使用场景**：
- 用户查询："这个文档写了一些什么"
- 增强后："文档主要内容、核心主题、关键信息、文档概述"

### 阶段3：混合检索（已实现）

结合两种检索方式：

#### 3a. 向量相似度搜索
- 使用增强后的查询生成 embedding
- 计算与文档块的余弦相似度
- 返回 topK 个最相关的块

#### 3b. 关键词/Grep 搜索
- 使用增强查询提取的搜索词
- 在文档块中进行精确匹配
- 计算匹配分数（考虑词频和词长）

#### 3c. 混合评分
```typescript
finalScore = vectorScore * 0.7 + keywordScore * 0.3
```

**权重可配置**：
- `vectorWeight`: 向量搜索权重（默认 0.7）
- `keywordWeight`: 关键词搜索权重（默认 0.3）

## 实现细节

### 文件结构

```
lib/
├── rag-context-builder.ts    # 主 RAG 上下文构建器（已更新）
├── rag-enhancement.ts        # 增强功能模块（新增）
├── vector-search.ts          # 向量搜索（现有）
└── vector-storage.ts         # 向量存储（已更新，支持元数据）
```

### 关键函数

#### `buildRAGContext()` - 增强版

```typescript
buildRAGContext(
  documentIds: string[],
  userQuery: string,
  options: {
    topK?: number;
    minScore?: number;
    useEnhancement?: boolean;  // 启用查询增强
    useHybridSearch?: boolean; // 启用混合搜索
  }
)
```

**流程**：
1. 查询增强（如果启用）
2. 生成查询 embedding（使用增强后的查询）
3. 向量相似度搜索
4. 关键词搜索（如果启用混合搜索）
5. 混合评分和排序
6. 返回 topK 个最相关的块

#### `enhanceQuery()` - 查询增强

```typescript
enhanceQuery(userQuery: string): Promise<EnhancedQuery>
```

使用 GPT-4o-mini 分析用户查询，生成：
- 增强的查询文本
- 关键概念列表
- 同义词列表
- 搜索词列表

#### `grepSearch()` - 关键词搜索

```typescript
grepSearch(
  chunks: Chunk[],
  searchTerms: string[]
): Promise<ScoredChunk[]>
```

在文档块中搜索关键词，计算匹配分数：
- 匹配次数
- 词长权重
- 归一化分数（0-1）

#### `hybridSearch()` - 混合搜索

```typescript
hybridSearch(
  vectorResults: ScoredChunk[],
  grepResults: ScoredChunk[],
  options: {
    vectorWeight?: number;
    keywordWeight?: number;
    topK?: number;
  }
): Promise<ScoredChunk[]>
```

合并向量搜索结果和关键词搜索结果：
- 计算综合分数
- 去重
- 返回 topK 个结果

## 使用示例

### 基本使用（默认启用增强）

```typescript
const ragContext = await buildRAGContext(
  ['file-123', 'file-456'],
  '这个文档写了一些什么',
  {
    topK: 5,
    minScore: 0.3,
    // useEnhancement: true,  // 默认启用
    // useHybridSearch: true,  // 默认启用
  }
);
```

### 仅使用向量搜索

```typescript
const ragContext = await buildRAGContext(
  ['file-123'],
  '用户查询',
  {
    useHybridSearch: false, // 禁用混合搜索
  }
);
```

### 仅使用关键词搜索

```typescript
const ragContext = await buildRAGContext(
  ['file-123'],
  '用户查询',
  {
    useEnhancement: true,   // 需要增强来提取搜索词
    useHybridSearch: true,  // 启用混合搜索
    // 但可以调整权重，使关键词权重更高
  }
);
```

## 性能考虑

### 查询增强
- **延迟**：~500-1000ms（GPT-4o-mini API 调用）
- **成本**：每次查询 ~$0.0001-0.0003
- **优化**：可以缓存常见查询的增强结果

### 混合搜索
- **向量搜索**：O(n) 其中 n 是文档块数量
- **关键词搜索**：O(n*m) 其中 n 是块数量，m 是搜索词数量
- **优化**：可以并行执行两种搜索

## 未来改进

1. **文档预处理**：在 PDF 处理时生成元数据
2. **缓存机制**：缓存查询增强结果
3. **并行处理**：并行执行向量搜索和关键词搜索
4. **自适应权重**：根据查询类型自动调整权重
5. **语义索引**：使用 GPT-4o-mini 生成更丰富的文档索引

## 配置选项

可以在 `buildRAGContext` 的 options 中配置：

```typescript
{
  topK: 5,                    // 每个文档返回的块数量
  minScore: 0.3,              // 最小相似度分数
  useEnhancement: true,       // 是否使用查询增强
  useHybridSearch: true,      // 是否使用混合搜索
}
```

在 `hybridSearch` 中可以配置权重：

```typescript
{
  vectorWeight: 0.7,         // 向量搜索权重
  keywordWeight: 0.3,         // 关键词搜索权重
  topK: 10,                   // 最终返回的块数量
}
```

## 日志输出

系统会输出详细的日志，方便调试：

- `[RAG Enhancement]` - 增强相关日志
- `[RAG]` - RAG 构建相关日志
- `[VectorSearch]` - 向量搜索相关日志

## 注意事项

1. **API 调用**：查询增强需要调用 GPT-4o-mini API，会产生延迟和成本
2. **客户端限制**：增强功能需要在客户端执行（可以访问 IndexedDB）
3. **错误处理**：如果增强失败，会降级到原始查询
4. **性能**：混合搜索会增加计算时间，但提升检索质量

