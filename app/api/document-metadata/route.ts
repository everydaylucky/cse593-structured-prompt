/**
 * API 路由：生成文档元数据
 * 使用 GPT-4o-mini 分析文档并生成摘要、关键词、主题等
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// 使用 nodejs runtime 以确保可以访问环境变量
export const runtime = 'nodejs';

type DocumentMetadataRequest = {
  text: string;
  fileName: string;
};

type DocumentMetadataResponse = {
  success: boolean;
  metadata?: {
    summary: string;
    keywords: string[];
    topics: string[];
    keyPhrases: string[];
    tableOfContents?: Array<{
      title: string;
      level: number;
      pageNumber?: number;
    }>;
  };
  error?: string;
};

/**
 * 智能采样文本（用于长文档）
 */
function smartSample(text: string, maxLength: number = 8000): string {
  if (text.length <= maxLength) {
    return text;
  }

  const chunkSize = Math.floor(maxLength / 3);
  
  // 前1/3：开头部分（通常包含摘要、目录、引言）
  const start = text.substring(0, chunkSize);
  
  // 中1/3：中间部分（随机采样）
  const middleStart = Math.floor((text.length - chunkSize) / 2);
  const middle = text.substring(middleStart, middleStart + chunkSize);
  
  // 后1/3：结尾部分（通常包含结论）
  const end = text.substring(text.length - chunkSize);
  
  return `${start}\n\n[... middle section ...]\n\n${middle}\n\n[... end section ...]\n\n${end}`;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: DocumentMetadataRequest = await req.json();
    const { text, fileName } = body;

    if (!text || !fileName) {
      return Response.json(
        { success: false, error: "Missing text or fileName" },
        { status: 400 }
      );
    }

    console.log("[Document Metadata API] Generating metadata for:", fileName);
    console.log("[Document Metadata API] Original text length:", text.length);

    // 策略1：目录提取 - 使用文档开头部分（目录通常在开头，需要更多上下文）
    const tocTextLength = Math.min(text.length, 20000); // 使用前20000字符提取目录
    const tocText = text.substring(0, tocTextLength);
    console.log("[Document Metadata API] Using first", tocTextLength, "characters for TOC extraction");

    // 策略2：元数据提取 - 使用智能采样（summary, keywords等）
    let analysisText = text;
    if (text.length >= 10000) {
      analysisText = smartSample(text, 8000);
      console.log("[Document Metadata API] Using smart sampling for metadata, sampled length:", analysisText.length);
    }

    // 先提取目录结构（使用更长的文本）
    const tocPrompt = `You are a document structure analyzer. Extract the COMPLETE table of contents from this document.

IMPORTANT: 
- Read through the ENTIRE provided text to find ALL headings, sections, and chapters
- Include ALL levels of hierarchy (main sections, subsections, sub-subsections, etc.)
- Preserve the exact order as they appear in the document
- Extract page numbers if they are mentioned
- The "level" field indicates hierarchy: 1 = main section/chapter, 2 = subsection, 3 = sub-subsection, etc.

Document: ${fileName}
Text: ${tocText}

Return ONLY valid JSON:
{
  "tableOfContents": [
    {
      "title": "Exact section title as it appears",
      "level": 1,
      "pageNumber": null
    }
  ]
}`;

    // 然后提取其他元数据（使用采样文本）
    const metadataPrompt = `Analyze this document and return ONLY valid JSON:

{
  "summary": "A comprehensive 3-5 sentence summary covering the main content, methodology, and findings",
  "keywords": ["10-15 key terms"],
  "topics": ["3-5 main topics"],
  "keyPhrases": ["5-10 important phrases"]
}

Document: ${fileName}
Text: ${analysisText.substring(0, 6000)}${analysisText.length > 6000 ? '...' : ''}`;

    // 并行提取目录和其他元数据
    console.log("[Document Metadata API] Calling GPT-4o-mini for TOC extraction...");
    const [tocResponse, metadataResponse] = await Promise.all([
      generateText({
        model: openai("gpt-4o-mini"),
        prompt: tocPrompt,
        temperature: 0.2, // 更低温度，更准确的结构提取
      }),
      generateText({
        model: openai("gpt-4o-mini"),
        prompt: metadataPrompt,
        temperature: 0.3,
      }),
    ]);

    console.log("[Document Metadata API] TOC response length:", tocResponse.text.length);
    console.log("[Document Metadata API] Metadata response length:", metadataResponse.text.length);

    // 解析目录结构
    let tableOfContents: Array<{ title: string; level: number; pageNumber?: number }> = [];
    try {
      const tocJsonMatch = tocResponse.text.match(/\{[\s\S]*\}/);
      if (tocJsonMatch) {
        const tocData = JSON.parse(tocJsonMatch[0]);
        tableOfContents = tocData.tableOfContents || [];
        console.log("[Document Metadata API] ✅ Extracted", tableOfContents.length, "TOC entries");
      }
    } catch (error) {
      console.warn("[Document Metadata API] Failed to parse TOC JSON:", error);
    }

    // 解析其他元数据
    let metadata: DocumentMetadataResponse['metadata'];
    try {
      const jsonMatch = metadataResponse.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn("[Document Metadata API] Failed to parse metadata JSON, using fallback extraction");
      metadata = {
        summary: metadataResponse.text.substring(0, 200) || `Document: ${fileName}`,
        keywords: extractKeywords(metadataResponse.text),
        topics: extractTopics(metadataResponse.text),
        keyPhrases: extractPhrases(metadataResponse.text),
      };
    }

    // 验证和清理数据（不截断 summary，让 GPT 决定长度）
    metadata = {
      summary: metadata.summary || `Document: ${fileName}`,
      keywords: (metadata.keywords || []).slice(0, 15),
      topics: (metadata.topics || []).slice(0, 5),
      keyPhrases: (metadata.keyPhrases || []).slice(0, 10),
      tableOfContents: tableOfContents.slice(0, 100), // 最多100个条目，使用从TOC提取的结果
    };

    console.log("[Document Metadata API] ✅ Metadata generated:", {
      summaryLength: metadata.summary.length,
      keywordsCount: metadata.keywords.length,
      topicsCount: metadata.topics.length,
      keyPhrasesCount: metadata.keyPhrases.length,
      tocCount: metadata.tableOfContents?.length || 0,
    });

    return Response.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error("[Document Metadata API] ❌ Error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// 辅助函数：从文本中提取关键词
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  const entries: Array<[string, number]> = [];
  frequency.forEach((count, word) => {
    entries.push([word, count]);
  });
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// 辅助函数：从文本中提取主题
function extractTopics(text: string): string[] {
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
  const phrases = text.match(/\b\w+(?:\s+\w+){1,3}\b/g) || [];
  const uniquePhrases = new Set(phrases);
  const result: string[] = [];
  uniquePhrases.forEach(phrase => {
    result.push(phrase);
  });
  return result.slice(0, 10);
}

