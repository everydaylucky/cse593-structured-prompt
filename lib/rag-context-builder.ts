/**
 * RAG 上下文构建器
 * 根据引用的文档检索相关块并构建上下文
 * 支持查询增强和混合搜索（向量 + 关键词）
 */

import { generateEmbedding } from "./vector-generator";
import { searchSimilarChunks, searchSimilarChunksInFile } from "./vector-search";
import { enhanceQuery, grepSearch, hybridSearch } from "./rag-enhancement";

export interface RAGContext {
  relevantChunks: Array<{
    text: string;
    fileId: string;
    fileName: string;
    score: number;
    chunkIndex: number;
  }>;
  contextText: string;
}

/**
 * 为引用的文档构建 RAG 上下文（增强版）
 * 使用 GPT-4o-mini 进行查询增强和混合搜索
 */
export async function buildRAGContext(
  documentIds: string[],
  userQuery: string,
  options: {
    topK?: number;
    minScore?: number;
    useEnhancement?: boolean; // 是否使用查询增强
    useHybridSearch?: boolean; // 是否使用混合搜索
  } = {}
): Promise<RAGContext> {
  const { 
    topK = 5, 
    minScore = 0.3,
    useEnhancement = true, // 默认启用增强
    useHybridSearch = true, // 默认启用混合搜索
  } = options;

  console.log("[RAG] Building context for documents:", documentIds);
  console.log("[RAG] User query:", userQuery);
  console.log("[RAG] Enhancement enabled:", useEnhancement);
  console.log("[RAG] Hybrid search enabled:", useHybridSearch);

  if (documentIds.length === 0) {
    console.log("[RAG] No document IDs provided");
    return {
      relevantChunks: [],
      contextText: "",
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

  // 步骤4：为每个文档检索相关块
  const allVectorResults: Array<{
    text: string;
    fileId: string;
    fileName: string;
    score: number;
    chunkIndex: number;
  }> = [];
  
  const allChunksForGrep: Array<{ text: string; fileId: string; chunkIndex: number }> = [];

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

  // 构建上下文文本
  const contextText = uniqueChunks
    .map(
      (chunk, index) =>
        `[Document ${index + 1}: ${chunk.fileName}]\n${chunk.text}`
    )
    .join("\n\n---\n\n");

  return {
    relevantChunks: uniqueChunks,
    contextText,
  };
}

/**
 * 构建增强的消息内容（包含 RAG 上下文）
 */
export function buildEnhancedMessage(
  userQuery: string,
  ragContext: RAGContext
): string {
  if (ragContext.contextText.length === 0) {
    return userQuery;
  }

  return `Based on the following documents:

${ragContext.contextText}

---

Question: ${userQuery}

Please answer the question based on the provided documents. If the information is not in the documents, please say so.`;
}

