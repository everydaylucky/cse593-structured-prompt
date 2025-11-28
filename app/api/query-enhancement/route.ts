/**
 * API 路由：增强用户查询
 * 使用 GPT-4o-mini 增强用户查询，支持文档结构信息
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = 'nodejs';

type QueryEnhancementRequest = {
  userQuery: string;
  documentStructures?: Array<{
    fileName: string;
    tableOfContents?: Array<{
      title: string;
      level: number;
      pageNumber?: number;
    }>;
  }>;
};

type QueryEnhancementResponse = {
  success: boolean;
  enhanced?: {
    originalQuery: string;
    enhancedQuery: string;
    keyConcepts: string[];
    synonyms: string[];
    searchTerms: string[];
    suggestedSections?: string[];
  };
  error?: string;
};

export async function POST(req: Request): Promise<Response> {
  try {
    const body: QueryEnhancementRequest = await req.json();
    const { userQuery, documentStructures } = body;

    if (!userQuery) {
      return Response.json(
        { success: false, error: "Missing userQuery" },
        { status: 400 }
      );
    }

    console.log("[Query Enhancement API] Enhancing query:", userQuery);
    console.log("[Query Enhancement API] Document structures:", documentStructures?.length || 0);

    let structureContext = "";
    if (documentStructures && documentStructures.length > 0) {
      structureContext = "\n\nDocument Structure Information:\n";
      for (const doc of documentStructures) {
        structureContext += `\nDocument: ${doc.fileName}\n`;
        if (doc.tableOfContents && doc.tableOfContents.length > 0) {
          structureContext += "Table of Contents:\n";
          for (const item of doc.tableOfContents) {
            const indent = "  ".repeat(item.level - 1);
            structureContext += `${indent}${item.title}${item.pageNumber ? ` (page ${item.pageNumber})` : ""}\n`;
          }
        } else {
          structureContext += "  (No table of contents available)\n";
        }
      }
      structureContext += "\nBased on the document structure above, identify which sections or chapters are most likely to contain information relevant to the user's query. Use this information to guide your search term selection and query enhancement.";
    }

    const prompt = `You are a search query enhancement assistant. Given a user's question and document structure information, provide:

1. An enhanced version of the query that is more suitable for document retrieval
2. Key concepts extracted from the query
3. Synonyms and related terms
4. Search terms for keyword matching
5. If document structure is provided, suggest which sections might be most relevant

User query: "${userQuery}"${structureContext}

Return your response as a JSON object:
{
  "enhancedQuery": "enhanced version of the query",
  "keyConcepts": ["concept1", "concept2", ...],
  "synonyms": ["synonym1", "synonym2", ...],
  "searchTerms": ["term1", "term2", ...],
  "suggestedSections": ["section title 1", "section title 2", ...]
}`;

    console.log("[Query Enhancement API] Calling GPT-4o-mini...");
    const { text: responseText } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: prompt,
      temperature: 0.3,
    });

    console.log("[Query Enhancement API] GPT-4o-mini response received, length:", responseText.length);

    let enhanced: QueryEnhancementResponse['enhanced'];
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        enhanced = {
          originalQuery: userQuery,
          enhancedQuery: parsed.enhancedQuery || userQuery,
          keyConcepts: parsed.keyConcepts || [],
          synonyms: parsed.synonyms || [],
          searchTerms: parsed.searchTerms || parsed.suggestedSections || [],
          suggestedSections: parsed.suggestedSections || [],
        };
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn("[Query Enhancement API] Failed to parse JSON, using fallback");
      enhanced = {
        originalQuery: userQuery,
        enhancedQuery: userQuery,
        keyConcepts: [],
        synonyms: [],
        searchTerms: [userQuery],
      };
    }

    console.log("[Query Enhancement API] ✅ Query enhanced:", {
      original: userQuery,
      enhanced: enhanced.enhancedQuery,
      searchTermsCount: enhanced.searchTerms.length,
      suggestedSectionsCount: enhanced.suggestedSections?.length || 0,
    });

    return Response.json({
      success: true,
      enhanced,
    });
  } catch (error) {
    console.error("[Query Enhancement API] ❌ Error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

