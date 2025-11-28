/**
 * RAG 上下文构建器
 * 根据引用的文档检索相关块并构建上下文
 * 支持查询增强和混合搜索（向量 + 关键词）
 * 支持全文模式和智能模式
 */

import { generateEmbedding } from "./vector-generator";
import { searchSimilarChunks, searchSimilarChunksInFile } from "./vector-search";
import { enhanceQuery, grepSearch, hybridSearch } from "./rag-enhancement";
import { getDocumentRAGModeConfig, type DocumentRAGMode } from "./document-rag-mode-storage";

export interface RAGContext {
  relevantChunks: Array<{
    text: string;
    fileId: string;
    fileName: string;
    score: number;
    chunkIndex: number;
  }>;
  contextText: string;
  isFullText?: boolean; // 是否为全文模式
}

/**
 * 构建全文上下文（获取所有 chunks）
 */
async function buildFullTextContext(
  documentIds: string[],
): Promise<RAGContext> {
  console.log("[RAG] Building full-text context for documents:", documentIds);

  if (documentIds.length === 0) {
    return {
      relevantChunks: [],
      contextText: "",
    };
  }

  // 检查是否在服务器端
  if (typeof window === 'undefined') {
    console.warn("[RAG] ⚠️ Cannot access IndexedDB on server side");
    return {
      relevantChunks: [],
      contextText: "",
      isFullText: false,
    };
  }

  const { getFileMetadata, getChunksByFileId } = await import("./vector-storage");
  const allChunks: Array<{
    text: string;
    fileId: string;
    fileName: string;
    score: number;
    chunkIndex: number;
  }> = [];

  const documentMetadataList: Array<{
    fileId: string;
    fileName: string;
    summary?: string;
    keywords?: string[];
    topics?: string[];
    tableOfContents?: Array<{
      title: string;
      level: number;
      pageNumber?: number;
    }>;
  }> = [];

  for (const fileId of documentIds) {
    try {
      const fileMetadata = await getFileMetadata(fileId);
      if (!fileMetadata) {
        console.error(`[RAG] ❌ File ${fileId} not found in database!`);
        continue;
      }

      // 获取所有 chunks
      const chunks = await getChunksByFileId(fileId);
      const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      allChunks.push(
        ...sortedChunks.map((chunk) => ({
          text: chunk.text,
          fileId: chunk.fileId,
          fileName: fileMetadata.fileName,
          score: 1.0, // 全文模式，所有 chunks 都是相关的
          chunkIndex: chunk.chunkIndex,
        }))
      );

      // 收集元数据
      if (fileMetadata.metadata) {
        documentMetadataList.push({
          fileId,
          fileName: fileMetadata.fileName,
          summary: fileMetadata.metadata.summary,
          keywords: fileMetadata.metadata.keywords,
          topics: fileMetadata.metadata.topics,
          tableOfContents: fileMetadata.metadata.tableOfContents,
        });
      }
    } catch (error) {
      console.error(`[RAG] ❌ Error processing file ${fileId}:`, error);
    }
  }

  // 构建上下文文本
  let contextText = "";

  // 第一部分：文档全局概览
  if (documentMetadataList.length > 0) {
    contextText += "=== DOCUMENT OVERVIEW ===\n\n";
    for (const docMeta of documentMetadataList) {
      contextText += `Document: ${docMeta.fileName}\n`;
      if (docMeta.summary) {
        contextText += `\nSummary:\n${docMeta.summary}\n`;
      }
      if (docMeta.tableOfContents && docMeta.tableOfContents.length > 0) {
        contextText += `\nTable of Contents:\n`;
        for (const item of docMeta.tableOfContents) {
          const indent = "  ".repeat(item.level - 1);
          contextText += `${indent}${item.title}${item.pageNumber ? ` (page ${item.pageNumber})` : ""}\n`;
        }
      }
      if (docMeta.keywords && docMeta.keywords.length > 0) {
        contextText += `\nKeywords: ${docMeta.keywords.join(", ")}\n`;
      }
      if (docMeta.topics && docMeta.topics.length > 0) {
        contextText += `Topics: ${docMeta.topics.join(", ")}\n`;
      }
      contextText += "\n---\n\n";
    }
  }

  // 第二部分：完整文档内容（按文档分组）
  if (allChunks.length > 0) {
    contextText += "=== FULL DOCUMENT CONTENT ===\n\n";
    const chunksByFile = new Map<string, typeof allChunks>();
    for (const chunk of allChunks) {
      if (!chunksByFile.has(chunk.fileId)) {
        chunksByFile.set(chunk.fileId, []);
      }
      chunksByFile.get(chunk.fileId)!.push(chunk);
    }

    for (const [fileId, chunks] of chunksByFile.entries()) {
      const fileName = chunks[0].fileName;
      contextText += `[Document: ${fileName}]\n\n`;
      const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      for (const chunk of sortedChunks) {
        contextText += `${chunk.text}\n\n`;
      }
      contextText += "---\n\n";
    }
  }

  console.log("[RAG] Full-text context built:", {
    chunksCount: allChunks.length,
    totalContextLength: contextText.length,
  });

  return {
    relevantChunks: allChunks,
    contextText,
    isFullText: true, // 标记为全文模式
  };
}

/**
 * 为引用的文档构建 RAG 上下文（增强版）
 * 使用 GPT-4o-mini 进行查询增强和混合搜索
 * 支持全文模式、RAG模式和智能模式
 */
export async function buildRAGContext(
  documentIds: string[],
  userQuery: string,
  options: {
    topK?: number;
    minScore?: number;
    useEnhancement?: boolean; // 是否使用查询增强
    useHybridSearch?: boolean; // 是否使用混合搜索
    mode?: DocumentRAGMode; // 文档处理模式：'full-text' | 'rag' | 'smart'
  } = {}
): Promise<RAGContext> {
  const { 
    topK = 5, 
    minScore = 0.3,
    useEnhancement = true, // 默认启用增强
    useHybridSearch = true, // 默认启用混合搜索
    mode: explicitMode,
  } = options;

  // 如果没有明确指定模式，从配置中获取
  let mode: DocumentRAGMode = explicitMode || 'rag';
  if (!explicitMode && typeof window !== 'undefined') {
    const config = getDocumentRAGModeConfig();
    mode = config.mode;
  }

  console.log("[RAG] Building context for documents:", documentIds);
  console.log("[RAG] User query:", userQuery);
  console.log("[RAG] Mode:", mode);
  console.log("[RAG] Enhancement enabled:", useEnhancement);
  console.log("[RAG] Hybrid search enabled:", useHybridSearch);

  // 全文模式：直接返回所有内容
  if (mode === 'full-text') {
    console.log("[RAG] Using full-text mode");
    return buildFullTextContext(documentIds);
  }

  // 智能模式：根据文档大小决定使用全文还是RAG
  if (mode === 'smart' && typeof window !== 'undefined') {
    const config = getDocumentRAGModeConfig();
    const threshold = config.smartThreshold?.maxTextLength || 50000;

    // 检查文档大小
    const { getChunksByFileId } = await import("./vector-storage");
    let totalTextLength = 0;

    for (const fileId of documentIds) {
      try {
        const chunks = await getChunksByFileId(fileId);
        totalTextLength += chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
      } catch (error) {
        console.warn(`[RAG] Failed to check file size for ${fileId}:`, error);
      }
    }

    const estimatedPages = Math.round(totalTextLength / 2500);
    console.log("[RAG] Smart mode check:", {
      totalTextLength,
      estimatedPages,
      threshold,
      willUseRAG: totalTextLength > threshold,
    });

    // 如果超过阈值，使用 RAG；否则使用全文
    if (totalTextLength > threshold) {
      console.log(`[RAG] Document exceeds threshold (${totalTextLength} > ${threshold}), using RAG mode`);
      // 继续执行 RAG 流程
    } else {
      console.log(`[RAG] Document within threshold (${totalTextLength} <= ${threshold}, ~${estimatedPages} pages), using full-text mode`);
      return buildFullTextContext(documentIds);
    }
  }

  if (documentIds.length === 0) {
    console.log("[RAG] No document IDs provided");
    return {
      relevantChunks: [],
      contextText: "",
      isFullText: false,
    };
  }

  // 步骤1：获取文档结构信息（用于查询增强）
  const documentStructures: Array<{
    fileName: string;
    tableOfContents?: Array<{
      title: string;
      level: number;
      pageNumber?: number;
    }>;
  }> = [];
  
  if (useEnhancement && typeof window !== 'undefined') {
    try {
      const { getFileMetadata } = await import("./vector-storage");
      for (const fileId of documentIds) {
        const fileMetadata = await getFileMetadata(fileId);
        if (fileMetadata && fileMetadata.metadata?.tableOfContents) {
          documentStructures.push({
            fileName: fileMetadata.fileName,
            tableOfContents: fileMetadata.metadata.tableOfContents,
          });
        }
      }
      console.log("[RAG] Document structures loaded:", documentStructures.length);
    } catch (error) {
      console.warn("[RAG] ⚠️ Failed to load document structures:", error);
    }
  }

  // 步骤2：查询增强（使用 GPT-4o-mini，传入文档结构信息）
  let enhancedQuery = userQuery;
  let searchTerms: string[] = [];
  
  if (useEnhancement && typeof window !== 'undefined') {
    try {
      console.log("[RAG] ========== Step 1: Query Enhancement ==========");
      const enhanced = await enhanceQuery(
        userQuery,
        documentStructures.length > 0 ? documentStructures : undefined
      );
      enhancedQuery = enhanced.enhancedQuery;
      searchTerms = enhanced.searchTerms.length > 0 
        ? enhanced.searchTerms 
        : enhanced.keyConcepts.length > 0 
          ? enhanced.keyConcepts 
          : [userQuery]; // 降级到原始查询
      
      console.log("[RAG] ✅ Query enhanced:", {
        original: userQuery,
        enhanced: enhancedQuery,
        searchTerms: searchTerms,
        documentStructuresUsed: documentStructures.length,
      });
    } catch (error) {
      console.warn("[RAG] ⚠️ Query enhancement failed, using original query:", error);
      searchTerms = [userQuery];
    }
  } else {
    searchTerms = [userQuery];
  }

  // 步骤3：生成查询向量（使用增强后的查询）
  console.log("[RAG] ========== Step 2: Generating query embedding ==========");
  console.log("[RAG] Using enhanced query for embedding:", enhancedQuery);
  const queryEmbedding = await generateEmbedding(enhancedQuery);
  console.log("[RAG] Query embedding generated, dimension:", queryEmbedding.length);

  // 步骤4：为每个文档检索相关块，并收集文档元数据
  const allVectorResults: Array<{
    text: string;
    fileId: string;
    fileName: string;
    score: number;
    chunkIndex: number;
  }> = [];
  
  const allChunksForGrep: Array<{ text: string; fileId: string; chunkIndex: number }> = [];

  // 收集所有文档的元数据（用于构建全局概览）
  const documentMetadataList: Array<{
    fileId: string;
    fileName: string;
    summary?: string;
    keywords?: string[];
    topics?: string[];
    tableOfContents?: Array<{
      title: string;
      level: number;
      pageNumber?: number;
    }>;
  }> = [];

  for (const fileId of documentIds) {
    try {
      console.log(`[RAG] ========== Processing file: ${fileId} ==========`);
      
      // 检查是否在服务器端
      const isServer = typeof window === 'undefined';
      
      if (isServer) {
        console.warn(`[RAG] ⚠️ Cannot access IndexedDB on server side for file ${fileId}`);
        continue;
      }
      
      // 客户端：获取文件元数据和所有块
      const { getFileMetadata, getChunksByFileId } = await import("./vector-storage");
      const fileMetadata = await getFileMetadata(fileId);
      
      if (!fileMetadata) {
        console.error(`[RAG] ❌ File ${fileId} not found in database!`);
        continue;
      }

      // 收集文档元数据（用于构建全局概览）
      if (fileMetadata.metadata) {
        documentMetadataList.push({
          fileId,
          fileName: fileMetadata.fileName,
          summary: fileMetadata.metadata.summary,
          keywords: fileMetadata.metadata.keywords,
          topics: fileMetadata.metadata.topics,
          tableOfContents: fileMetadata.metadata.tableOfContents,
        });
        console.log(`[RAG] Collected metadata for ${fileMetadata.fileName}:`, {
          hasSummary: !!fileMetadata.metadata.summary,
          keywordsCount: fileMetadata.metadata.keywords?.length || 0,
          topicsCount: fileMetadata.metadata.topics?.length || 0,
          tocCount: fileMetadata.metadata.tableOfContents?.length || 0,
        });
      }
      
      // 3a. 向量相似度搜索
      console.log(`[RAG] Step 3a: Vector similarity search for file ${fileId}`);
      const vectorResults = await searchSimilarChunksInFile(
        queryEmbedding,
        fileId,
        topK * 2, // 获取更多结果用于混合搜索
        minScore
      );
      
      const vectorChunks = vectorResults.map((result) => ({
        text: result.chunk.text,
        fileId: result.chunk.fileId,
        fileName: fileMetadata.fileName,
        score: result.score,
        chunkIndex: result.chunk.chunkIndex,
      }));
      
      allVectorResults.push(...vectorChunks);
      
      // 3b. 如果需要混合搜索，获取所有块用于关键词搜索
      if (useHybridSearch && searchTerms.length > 0) {
        console.log(`[RAG] Step 3b: Preparing chunks for keyword search`);
        const allChunks = await getChunksByFileId(fileId);
        allChunksForGrep.push(
          ...allChunks.map(chunk => ({
            text: chunk.text,
            fileId: chunk.fileId,
            chunkIndex: chunk.chunkIndex,
          }))
        );
      }
      
      console.log(`[RAG] Search results for file ${fileId}:`, {
        vectorResultsCount: vectorResults.length,
        topScore: vectorResults[0]?.score || "N/A",
      });
    } catch (error) {
      console.error(`[RAG] Failed to retrieve chunks for file ${fileId}:`, error);
    }
  }

  console.log(`[RAG] Total vector results: ${allVectorResults.length}`);

  // 步骤4：混合搜索（结合向量搜索和关键词搜索）
  let finalChunks: Array<{
    text: string;
    fileId: string;
    fileName: string;
    score: number;
    chunkIndex: number;
  }> = [];

  if (useHybridSearch && searchTerms.length > 0 && allChunksForGrep.length > 0) {
    console.log("[RAG] ========== Step 4: Hybrid Search ==========");
    
    // 关键词搜索
    const grepResults = await grepSearch(allChunksForGrep, searchTerms);
    
    // 混合搜索结果
    const hybridResults = await hybridSearch(
      allVectorResults,
      grepResults,
      {
        vectorWeight: 0.7,
        keywordWeight: 0.3,
        topK: topK * documentIds.length,
      }
    );
    
    finalChunks = hybridResults.map(r => ({
      text: r.text,
      fileId: r.fileId,
      fileName: allVectorResults.find(v => v.fileId === r.fileId && v.chunkIndex === r.chunkIndex)?.fileName || r.fileId,
      score: r.score,
      chunkIndex: r.chunkIndex,
    }));
    
    console.log(`[RAG] ✅ Hybrid search completed: ${finalChunks.length} chunks`);
  } else {
    // 仅使用向量搜索
    console.log("[RAG] Using vector search only (hybrid search disabled or no search terms)");
    finalChunks = allVectorResults;
  }

  // 按分数排序并去重
  const uniqueChunks = finalChunks
    .sort((a, b) => b.score - a.score)
    .filter(
      (chunk, index, self) =>
        index === self.findIndex((c) => c.text === chunk.text && c.chunkIndex === chunk.chunkIndex)
    )
    .slice(0, topK * documentIds.length); // 每个文档最多 topK 个块

  // 构建上下文文本（包含文档全局概览和相关chunks）
  let contextText = "";

  // 第一部分：文档全局概览
  if (documentMetadataList.length > 0) {
    contextText += "=== DOCUMENT OVERVIEW ===\n\n";
    
    for (const docMeta of documentMetadataList) {
      contextText += `Document: ${docMeta.fileName}\n`;
      
      // 添加摘要
      if (docMeta.summary) {
        contextText += `\nSummary:\n${docMeta.summary}\n`;
      }
      
      // 添加目录结构
      if (docMeta.tableOfContents && docMeta.tableOfContents.length > 0) {
        contextText += `\nTable of Contents:\n`;
        for (const item of docMeta.tableOfContents) {
          const indent = "  ".repeat(item.level - 1);
          contextText += `${indent}${item.title}${item.pageNumber ? ` (page ${item.pageNumber})` : ""}\n`;
        }
      }
      
      // 添加关键词和主题
      if (docMeta.keywords && docMeta.keywords.length > 0) {
        contextText += `\nKeywords: ${docMeta.keywords.join(", ")}\n`;
      }
      
      if (docMeta.topics && docMeta.topics.length > 0) {
        contextText += `Topics: ${docMeta.topics.join(", ")}\n`;
      }
      
      contextText += "\n---\n\n";
    }
  }

  // 第二部分：相关文档片段（按文档分组）
  if (uniqueChunks.length > 0) {
    contextText += "=== RELEVANT DOCUMENT EXCERPTS ===\n\n";
    
    // 按文档分组chunks
    const chunksByFile = new Map<string, typeof uniqueChunks>();
    for (const chunk of uniqueChunks) {
      if (!chunksByFile.has(chunk.fileId)) {
        chunksByFile.set(chunk.fileId, []);
      }
      chunksByFile.get(chunk.fileId)!.push(chunk);
    }
    
    // 为每个文档输出相关chunks
    for (const [fileId, chunks] of chunksByFile.entries()) {
      const fileName = chunks[0].fileName;
      contextText += `[Document: ${fileName}]\n\n`;
      
      // 按chunkIndex排序，保持文档顺序
      const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      for (const chunk of sortedChunks) {
        contextText += `[Excerpt ${chunk.chunkIndex + 1}]\n${chunk.text}\n\n`;
      }
      
      contextText += "---\n\n";
    }
  }

  console.log("[RAG] Context text built:", {
    overviewLength: documentMetadataList.length > 0 ? contextText.split("=== RELEVANT DOCUMENT EXCERPTS ===")[0].length : 0,
    chunksLength: uniqueChunks.length,
    totalContextLength: contextText.length,
  });

  return {
    relevantChunks: uniqueChunks,
    contextText,
    isFullText: false, // RAG 模式
  };
}

/**
 * 构建增强的消息内容（包含 RAG 上下文）
 */
export function buildEnhancedMessage(
  userQuery: string,
  ragContext: RAGContext
): string {
  const isFullText = ragContext.isFullText || false;
  if (ragContext.contextText.length === 0) {
    return userQuery;
  }

  if (isFullText) {
    // 全文模式的提示
    return `You are analyzing the following document(s). The complete document content is provided below.

${ragContext.contextText}

---

User Question: ${userQuery}

Instructions:
1. Review the document overview to understand the overall structure and main topics
2. Use the full document content to answer the question comprehensively
3. Provide a detailed answer based on the complete document
4. If the information is not in the documents, please say so clearly`;
  }

  // RAG 模式的提示
  return `You are analyzing the following document(s). First, review the document overview to understand the overall structure and main topics. Then, examine the relevant excerpts to find specific information.

${ragContext.contextText}

---

User Question: ${userQuery}

Instructions:
1. Use the document overview to understand the document's structure and main themes
2. Refer to the relevant excerpts for specific details
3. Provide a comprehensive answer that considers both the overall document context and the specific relevant sections
4. If the information is not in the documents, please say so clearly`;
}

