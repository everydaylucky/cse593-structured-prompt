/**
 * RAG 增强模块
 * 使用 GPT-4o-mini 进行文档预处理、查询增强和混合检索
 */

export interface DocumentMetadata {
  title?: string; // Generated document title
  summary: string;
  keywords: string[];
  topics: string[];
  keyPhrases: string[];
  tableOfContents?: Array<{
    title: string;
    level: number;
    pageNumber?: number;
  }>;
}

export interface EnhancedQuery {
  originalQuery: string;
  enhancedQuery: string;
  keyConcepts: string[];
  synonyms: string[];
  searchTerms: string[];
}

/**
 * 使用 GPT-4o-mini 生成文档摘要和元数据
 * 通过 API 路由调用，确保可以访问服务器端的 OPENAI_API_KEY
 */
export async function generateDocumentMetadata(
  documentText: string,
  fileName: string
): Promise<DocumentMetadata> {
  console.log("[RAG Enhancement] Generating document metadata for:", fileName);
  console.log("[RAG Enhancement] Original text length:", documentText.length);

  try {
    // 获取自定义 prompt（客户端）
    const { getSummaryPrompt } = await import("./summary-prompt-config-storage");
    const customPrompt = getSummaryPrompt();

    // 调用 API 路由（服务器端处理，可以访问 .env）
    const response = await fetch("/api/document-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: documentText,
        fileName: fileName,
        customPrompt: customPrompt, // 传递自定义 prompt
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to generate metadata: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.metadata) {
      throw new Error("Invalid response from metadata API");
    }

    const metadata: DocumentMetadata = {
      title: data.metadata.title, // Generated document title
      summary: data.metadata.summary || `Document: ${fileName}`,
      keywords: data.metadata.keywords || [],
      topics: data.metadata.topics || [],
      keyPhrases: data.metadata.keyPhrases || [],
      tableOfContents: data.metadata.tableOfContents || [],
    };

    console.log("[RAG Enhancement] ✅ Document metadata generated:", {
      summaryLength: metadata.summary.length,
      keywordsCount: metadata.keywords.length,
      topicsCount: metadata.topics.length,
      keyPhrasesCount: metadata.keyPhrases.length,
    });

    return metadata;
  } catch (error) {
    console.error("[RAG Enhancement] ❌ Failed to generate metadata:", error);
    // 返回默认值
    return {
      summary: `Document: ${fileName}`,
      keywords: [],
      topics: [],
      keyPhrases: [],
    };
  }
}

/**
 * 使用 GPT-4o-mini 增强用户查询
 * @param userQuery 用户查询
 * @param documentStructures 文档结构信息（目录），用于指导搜索方向
 */
export async function enhanceQuery(
  userQuery: string,
  documentStructures?: Array<{
    fileName: string;
    tableOfContents?: Array<{
      title: string;
      level: number;
      pageNumber?: number;
    }>;
  }>
): Promise<EnhancedQuery> {
  console.log("[RAG Enhancement] Enhancing user query:", userQuery);
  console.log("[RAG Enhancement] Document structures provided:", documentStructures?.length || 0);

  try {
    // 调用 API 路由（服务器端处理，可以访问 .env）
    const response = await fetch("/api/query-enhancement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userQuery,
        documentStructures,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to enhance query: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.enhanced) {
      throw new Error("Invalid response from query enhancement API");
    }

    const enhanced: EnhancedQuery = {
      originalQuery: data.enhanced.originalQuery || userQuery,
      enhancedQuery: data.enhanced.enhancedQuery || userQuery,
      keyConcepts: data.enhanced.keyConcepts || [],
      synonyms: data.enhanced.synonyms || [],
      searchTerms: data.enhanced.searchTerms || [],
    };

    console.log("[RAG Enhancement] ✅ Query enhanced:", {
      original: userQuery,
      enhanced: enhanced.enhancedQuery,
      conceptsCount: enhanced.keyConcepts.length,
      searchTermsCount: enhanced.searchTerms.length,
      documentStructuresUsed: documentStructures?.length || 0,
    });

    return enhanced;
  } catch (error) {
    console.error("[RAG Enhancement] ❌ Failed to enhance query:", error);
    return {
      originalQuery: userQuery,
      enhancedQuery: userQuery,
      keyConcepts: [],
      synonyms: [],
      searchTerms: [],
    };
  }
}

/**
 * 基于关键词的 Grep 搜索
 */
export async function grepSearch(
  chunks: Array<{ text: string; fileId: string; chunkIndex: number }>,
  searchTerms: string[]
): Promise<Array<{ text: string; fileId: string; chunkIndex: number; matchScore: number }>> {
  if (searchTerms.length === 0) {
    return [];
  }

  console.log("[RAG Enhancement] Performing grep search with terms:", searchTerms);

  const results: Array<{
    text: string;
    fileId: string;
    chunkIndex: number;
    matchScore: number;
  }> = [];

  for (const chunk of chunks) {
    const text = chunk.text.toLowerCase();
    let matchScore = 0;
    let matchCount = 0;

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      // 计算匹配次数
      const matches = (text.match(new RegExp(lowerTerm, "g")) || []).length;
      if (matches > 0) {
        matchCount++;
        matchScore += matches * (term.length / 10); // 长词权重更高
      }
    }

    if (matchCount > 0) {
      // 归一化分数 (0-1)
      const normalizedScore = Math.min(matchScore / searchTerms.length, 1);
      results.push({
        text: chunk.text,
        fileId: chunk.fileId,
        chunkIndex: chunk.chunkIndex,
        matchScore: normalizedScore,
      });
    }
  }

  // 按匹配分数排序
  results.sort((a, b) => b.matchScore - a.matchScore);

  console.log("[RAG Enhancement] Grep search results:", {
    totalChunks: chunks.length,
    matchedChunks: results.length,
    topScores: results.slice(0, 5).map(r => r.matchScore),
  });

  return results;
}

/**
 * 混合检索：结合向量搜索和关键词搜索
 */
export async function hybridSearch(
  vectorResults: Array<{ text: string; fileId: string; score: number; chunkIndex: number }>,
  grepResults: Array<{ text: string; fileId: string; matchScore: number; chunkIndex: number }>,
  options: {
    vectorWeight?: number;
    keywordWeight?: number;
    topK?: number;
  } = {}
): Promise<Array<{ text: string; fileId: string; score: number; chunkIndex: number }>> {
  const { vectorWeight = 0.7, keywordWeight = 0.3, topK = 10 } = options;

  console.log("[RAG Enhancement] Performing hybrid search:", {
    vectorResultsCount: vectorResults.length,
    grepResultsCount: grepResults.length,
    vectorWeight,
    keywordWeight,
  });

  // 创建合并结果映射
  const combinedMap = new Map<
    string,
    { text: string; fileId: string; chunkIndex: number; vectorScore: number; keywordScore: number }
  >();

  // 添加向量搜索结果
  for (const result of vectorResults) {
    const key = `${result.fileId}-${result.chunkIndex}`;
    combinedMap.set(key, {
      text: result.text,
      fileId: result.fileId,
      chunkIndex: result.chunkIndex,
      vectorScore: result.score,
      keywordScore: 0,
    });
  }

  // 添加关键词搜索结果
  for (const result of grepResults) {
    const key = `${result.fileId}-${result.chunkIndex}`;
    const existing = combinedMap.get(key);
    if (existing) {
      existing.keywordScore = result.matchScore;
    } else {
      combinedMap.set(key, {
        text: result.text,
        fileId: result.fileId,
        chunkIndex: result.chunkIndex,
        vectorScore: 0,
        keywordScore: result.matchScore,
      });
    }
  }

  // 计算综合分数并排序
  const combined = Array.from(combinedMap.values())
    .map((item) => ({
      text: item.text,
      fileId: item.fileId,
      chunkIndex: item.chunkIndex,
      score: item.vectorScore * vectorWeight + item.keywordScore * keywordWeight,
      vectorScore: item.vectorScore,
      keywordScore: item.keywordScore,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log("[RAG Enhancement] ✅ Hybrid search completed:", {
    combinedCount: combined.length,
    topScores: combined.slice(0, 5).map(r => ({
      score: r.score,
      vectorScore: r.vectorScore,
      keywordScore: r.keywordScore,
    })),
  });

  return combined;
}

// 辅助函数：从文本中提取关键词
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// 辅助函数：从文本中提取主题
function extractTopics(text: string): string[] {
  // 简单实现：查找大写字母开头的短语
  const topics = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  const uniqueTopics = new Set(topics);
  const result: string[] = [];
  uniqueTopics.forEach(topic => {
    result.push(topic);
  });
  return result.slice(0, 5);
}

// 辅助函数：从文本中提取短语
function extractPhrases(text: string): string[] {
  // 提取2-4个词的短语
  const phrases = text.match(/\b\w+(?:\s+\w+){1,3}\b/g) || [];
  const uniquePhrases = new Set(phrases);
  const result: string[] = [];
  uniquePhrases.forEach(phrase => {
    result.push(phrase);
  });
  return result.slice(0, 10);
}

