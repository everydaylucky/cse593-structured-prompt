# PDF 在对话上下文中的处理策略分析

## 问题核心

**关键问题**：在一次对话中上传了 PDF 并问问题，后续的新请求是否还会把 PDF 再上传一遍给 API？

**答案**：**不会重复上传文件本身，但会根据 API 的特性采用不同的策略。**

---

## 主流中间商的实现策略

### 1. OpenAI Files API 策略 ⭐

**工作原理**：
1. **首次上传**：使用 `openai.files.create()` 上传文件，获得 `file_id`
2. **文件持久化**：文件存储在 OpenAI 服务器上，`file_id` 可以长期使用
3. **后续引用**：在后续消息中，只需引用 `file_id`，无需重新上传文件内容

**实现示例**：

```typescript
// 第一次上传 PDF（只执行一次）
const file = await openai.files.create({
  file: pdfBuffer,
  purpose: 'assistants',
});
const fileId = file.id; // 例如: "file-abc123"

// 第一次消息：包含文件
const response1 = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这个 PDF' },
        { type: 'file', file_id: fileId } // 引用文件 ID
      ]
    }
  ]
});

// 后续消息：仍然引用同一个 file_id（不重新上传）
const response2 = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这个 PDF' },
        { type: 'file', file_id: fileId } // 同一个 file_id
      ]
    },
    {
      role: 'assistant',
      content: response1.choices[0].message.content
    },
    {
      role: 'user',
      content: '这个 PDF 的第二页说了什么？' // 新问题
      // 注意：这里仍然需要包含 file_id，因为模型需要访问文件
    }
  ]
});
```

**关键点**：
- ✅ **文件只上传一次**，获得 `file_id`
- ✅ **后续消息只需引用 `file_id`**，不重新上传文件内容
- ⚠️ **但每次 API 调用仍需要包含 `file_id`**，因为模型需要访问文件内容
- ⚠️ **文件内容会占用 token**，但不会重复上传文件本身

---

### 2. Google Gemini File API 策略 ⭐

**工作原理**：
1. **首次上传**：使用 `uploadFile()` 上传文件，获得 `fileUri`
2. **文件持久化**：文件存储在 Google 服务器上，`fileUri` 可以长期使用
3. **后续引用**：在后续消息中，只需引用 `fileUri`，无需重新上传

**实现示例**：

```typescript
// 第一次上传 PDF（只执行一次）
const file = await genai.uploadFile({
  fileData: pdfBuffer,
  mimeType: 'application/pdf',
});
const fileUri = file.uri; // 例如: "gs://bucket/file-abc123"

// 第一次消息：包含文件
const response1 = await model.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        { text: '请分析这个 PDF' },
        { fileData: { mimeType: 'application/pdf', fileUri } }
      ]
    }
  ]
});

// 后续消息：仍然引用同一个 fileUri（不重新上传）
const response2 = await model.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        { text: '请分析这个 PDF' },
        { fileData: { mimeType: 'application/pdf', fileUri } } // 同一个 fileUri
      ]
    },
    {
      role: 'model',
      parts: [{ text: response1.response.text() }]
    },
    {
      role: 'user',
      parts: [
        { text: '这个 PDF 的第二页说了什么？' },
        { fileData: { mimeType: 'application/pdf', fileUri } } // 仍然需要 fileUri
      ]
    }
  ]
});
```

**关键点**：
- ✅ **文件只上传一次**，获得 `fileUri`
- ✅ **后续消息只需引用 `fileUri`**，不重新上传文件内容
- ⚠️ **但每次 API 调用仍需要包含 `fileUri`**，因为模型需要访问文件
- ⚠️ **文件内容会占用 token**，但不会重复上传文件本身

---

### 3. Poe 等中间商的优化策略 🚀

**高级策略**：**向量化 + RAG（检索增强生成）**

**工作原理**：
1. **首次上传**：
   - 解析 PDF，提取文本和图像
   - 将文本分块（chunking）
   - 为每个块生成向量嵌入（embedding）
   - 存储在向量数据库中

2. **后续请求**：
   - **不重新上传 PDF**
   - **不每次都发送整个 PDF 给模型**
   - 根据用户问题，从向量数据库中检索**最相关的文本块**
   - 只将相关块 + 用户问题发送给模型

**实现示例**：

```typescript
// 第一次上传 PDF（只执行一次）
async function uploadPDF(pdfFile: File) {
  // 1. 解析 PDF
  const text = await extractTextFromPDF(pdfFile);
  
  // 2. 分块
  const chunks = splitTextIntoChunks(text, { chunkSize: 1000 });
  
  // 3. 生成嵌入并存储
  const embeddings = await generateEmbeddings(chunks);
  await vectorDB.store({
    fileId: pdfFile.id,
    chunks: chunks.map((chunk, i) => ({
      text: chunk,
      embedding: embeddings[i],
      metadata: { page: i }
    }))
  });
  
  return { fileId: pdfFile.id };
}

// 第一次消息：包含整个 PDF（可选，用于初始理解）
const response1 = await model.generateContent({
  contents: [
    { text: '请分析这个 PDF' },
    { fileData: { fileUri } }
  ]
});

// 后续消息：只检索相关块，不发送整个 PDF
async function handleFollowUpQuestion(question: string, fileId: string) {
  // 1. 检索相关块
  const relevantChunks = await vectorDB.search({
    query: question,
    fileId: fileId,
    topK: 5 // 只取最相关的 5 个块
  });
  
  // 2. 只发送相关块 + 问题给模型
  const response = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: `基于以下文档片段回答：\n${relevantChunks.join('\n\n')}` },
          { text: `问题：${question}` }
        ]
      }
    ]
    // 注意：这里不包含 fileUri，因为只发送了相关文本块
  });
  
  return response;
}
```

**优势**：
- ✅ **大幅减少 token 使用**：只发送相关块，而不是整个 PDF
- ✅ **提高响应速度**：减少需要处理的内容
- ✅ **降低成本**：token 使用量显著降低
- ✅ **提高准确性**：只关注与问题相关的部分

---

## 三种策略对比

| 策略 | 首次上传 | 后续请求 | Token 使用 | 成本 | 复杂度 |
|------|---------|---------|-----------|------|--------|
| **OpenAI Files API** | 上传一次，获得 `file_id` | 引用 `file_id`，但每次仍包含文件 | 高（每次包含整个文件） | 中等 | 低 |
| **Google Gemini File API** | 上传一次，获得 `fileUri` | 引用 `fileUri`，但每次仍包含文件 | 高（每次包含整个文件） | 中等 | 低 |
| **向量化 + RAG** | 解析、分块、嵌入、存储 | 检索相关块，只发送相关部分 | 低（只发送相关块） | 低 | 高 |

---

## 实际实现建议

### 方案 1：简单实现（适合小文件）

**适用于**：PDF < 10MB，对话轮次 < 10 轮

```typescript
// 在 thread 中存储 file_id
interface Thread {
  id: string;
  messages: Message[];
  files: Array<{
    id: string;        // file_id 或 fileUri
    name: string;
    uploadedAt: number;
  }>;
}

// 每次 API 调用都包含 file_id
async function sendMessage(threadId: string, text: string) {
  const thread = getThread(threadId);
  const messages = buildMessages(thread.messages);
  
  // 如果 thread 中有文件，在第一条用户消息中包含文件
  if (thread.files.length > 0) {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      firstUserMessage.content.push(
        ...thread.files.map(f => ({ type: 'file', file_id: f.id }))
      );
    }
  }
  
  return await api.chat.completions.create({ messages });
}
```

**优点**：
- 实现简单
- 不需要额外的存储和检索系统

**缺点**：
- 每次 API 调用都包含文件，token 使用量大
- 成本较高

---

### 方案 2：智能实现（推荐）⭐

**适用于**：PDF > 10MB，对话轮次 > 10 轮，需要成本优化

```typescript
// 1. 首次上传：解析并存储
async function uploadPDF(pdfFile: File, threadId: string) {
  // 上传到 API 获取 file_id
  const fileId = await uploadToAPI(pdfFile);
  
  // 可选：解析并存储到向量数据库（用于智能检索）
  if (pdfFile.size > 10 * 1024 * 1024) { // > 10MB
    const chunks = await parseAndChunkPDF(pdfFile);
    await vectorDB.store(threadId, chunks);
  }
  
  // 存储到 thread
  await addFileToThread(threadId, {
    id: fileId,
    name: pdfFile.name,
    uploadedAt: Date.now(),
    hasVectorIndex: pdfFile.size > 10 * 1024 * 1024
  });
  
  return fileId;
}

// 2. 发送消息：智能选择策略
async function sendMessage(threadId: string, text: string) {
  const thread = getThread(threadId);
  const files = thread.files;
  
  if (files.length === 0) {
    // 没有文件，正常发送
    return await sendNormalMessage(thread, text);
  }
  
  // 检查是否使用向量检索
  const useVectorSearch = files.some(f => f.hasVectorIndex);
  
  if (useVectorSearch) {
    // 使用向量检索：只发送相关块
    const relevantChunks = await vectorDB.search(threadId, text, { topK: 5 });
    return await sendMessageWithChunks(thread, text, relevantChunks);
  } else {
    // 小文件：直接包含 file_id（但只在第一次包含，后续通过上下文传递）
    const isFirstMessage = thread.messages.length === 0;
    if (isFirstMessage) {
      return await sendMessageWithFiles(thread, text, files);
    } else {
      // 后续消息：不包含文件，依赖对话上下文
      return await sendNormalMessage(thread, text);
    }
  }
}
```

**优点**：
- 成本优化：大文件使用向量检索，小文件依赖上下文
- 响应速度快：只处理相关内容
- 准确性高：相关块更精准

**缺点**：
- 实现复杂：需要向量数据库
- 需要额外的存储空间

---

## 关键结论

### ✅ **文件不会重复上传**
- 文件只上传一次，获得 `file_id` 或 `fileUri`
- 后续消息只需引用这个 ID，不重新上传文件内容

### ⚠️ **但文件内容仍会占用 token**
- 如果每次 API 调用都包含 `file_id`，模型仍需要处理文件内容
- 这会占用 token，产生费用

### 🚀 **最佳实践：向量化 + RAG**
- 首次上传时解析 PDF，生成向量索引
- 后续请求只检索相关块，不发送整个文件
- 大幅降低 token 使用和成本

---

## 实现优先级

1. **第一阶段**：简单实现（方案 1）
   - 文件上传一次，获得 `file_id`
   - 每次消息包含 `file_id`（或只在第一次包含）

2. **第二阶段**：优化实现（方案 2）
   - 添加向量数据库
   - 实现智能检索
   - 只发送相关块

---

## 参考实现

### OpenAI Files API 文档
- https://platform.openai.com/docs/api-reference/files
- 文件上传后可以长期使用，不需要重复上传

### Google Gemini File API 文档
- https://ai.google.dev/gemini-api/docs/upload-files
- 文件上传后获得 `fileUri`，可以重复使用

### 向量数据库选择
- **Pinecone**：托管服务，易于集成
- **Weaviate**：开源，可自托管
- **Chroma**：轻量级，适合小项目
- **Qdrant**：高性能，开源

