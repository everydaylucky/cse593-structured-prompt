import { streamText, UIMessage, convertToModelMessages } from "ai";
import chatPrompt from "@/data/chatPrompt.json";
import { parseModelFromMessage } from "@/lib/models/message-parser";
import { parseDocumentsFromMessage } from "@/lib/document-parser";
import { createModelProvider } from "@/lib/models/providers/factory";
import { buildRAGContext, buildEnhancedMessage, type RAGContext } from "@/lib/rag-context-builder";
import { getModelConfigOverride, mergeModelConfig } from "@/lib/models/model-config-storage";

const systemPrompt = chatPrompt.lines.join("\n");

type ChatRequestBody = {
  messages: UIMessage[];
  userStudyMode?: boolean;
  documentIds?: string[]; // 引用的文档 ID（可选，也可以从消息中解析）
  ragContext?: RAGContext; // 客户端构建的 RAG 上下文（可选）
};

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log("[Server] ========== POST /api/chat received ==========");
  console.log("[Server] Request timestamp:", new Date().toISOString());
  console.log("[Server] Request headers:", {
    'content-type': req.headers.get('content-type'),
    'content-length': req.headers.get('content-length'),
  });
  
  // 读取body（只能读取一次）
  const body = await req.json();
  
  // 记录原始body信息（用于调试）
  const bodyString = JSON.stringify(body);
  console.log("[Server] Parsed body length:", bodyString.length);
  console.log("[Server] Parsed body preview (first 500 chars):", bodyString.substring(0, 500));
  const {
    messages,
    userStudyMode = true,
    documentIds: requestDocumentIds,
    ragContext: clientRAGContext,
  }: ChatRequestBody = body;

  console.log("[Server] ========== RAG Debug Start ==========");
  console.log("[Server] Request body keys:", Object.keys(body));
  console.log("[Server] Full request body summary:", JSON.stringify({
    messagesCount: messages.length,
    userStudyMode,
    requestDocumentIds,
    lastMessageRole: messages[messages.length - 1]?.role,
    hasClientRAGContext: !!clientRAGContext,
    clientRAGContextChunks: clientRAGContext?.relevantChunks?.length || 0,
    clientRAGContextType: typeof clientRAGContext,
    clientRAGContextKeys: clientRAGContext ? Object.keys(clientRAGContext) : [],
  }, null, 2));
  
  // 详细检查ragContext
  if (clientRAGContext) {
    console.log("[Server] ✅ Client RAG context received!");
    console.log("[Server] RAG context structure:", {
      hasRelevantChunks: !!clientRAGContext.relevantChunks,
      chunksCount: clientRAGContext.relevantChunks?.length || 0,
      hasContextText: !!clientRAGContext.contextText,
      contextTextLength: clientRAGContext.contextText?.length || 0,
      contextTextPreview: clientRAGContext.contextText?.substring(0, 200) || '',
    });
    if (clientRAGContext.relevantChunks && clientRAGContext.relevantChunks.length > 0) {
      console.log("[Server] First chunk sample:", {
        fileId: clientRAGContext.relevantChunks[0].fileId,
        fileName: clientRAGContext.relevantChunks[0].fileName,
        score: clientRAGContext.relevantChunks[0].score,
        textPreview: clientRAGContext.relevantChunks[0].text.substring(0, 100),
      });
    }
  } else {
    console.log("[Server] ❌ No client RAG context in request body");
    console.log("[Server] Checking if ragContext exists but is falsy:", {
      ragContextInBody: 'ragContext' in body,
      ragContextValue: body.ragContext,
      ragContextType: typeof body.ragContext,
    });
  }

  // 从最后一条用户消息中解析模型和文档
  const lastMessage = messages[messages.length - 1];
  const lastMessageAny = lastMessage as any;
  
  console.log("[Chat API] Last message full structure:", JSON.stringify(lastMessageAny, null, 2));
  
  // 提取消息文本 - 支持多种格式（content 或 parts）
  let messageText = "";
  
  // 优先检查 parts（assistant-ui 使用的格式）
  if (Array.isArray(lastMessageAny.parts)) {
    const textPart = lastMessageAny.parts.find((part: any) => part.type === "text");
    if (textPart) {
      messageText = textPart.text || "";
      console.log("[Chat API] Message has parts array, found text part:", messageText);
    } else {
      console.warn("[Chat API] Message has parts array but no text part found");
      // 尝试从所有 parts 中提取文本
      messageText = lastMessageAny.parts
        .map((part: any) => {
          if (typeof part === "string") return part;
          if (part?.text) return part.text;
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }
  }
  // 如果没有 parts，检查 content
  else if (typeof lastMessageAny.content === "string") {
    messageText = lastMessageAny.content;
    console.log("[Chat API] Message content is string:", messageText);
  } else if (Array.isArray(lastMessageAny.content)) {
    // 查找 text 类型的 part
    const textPart = lastMessageAny.content.find((part: any) => part.type === "text");
    if (textPart) {
      messageText = textPart.text || "";
      console.log("[Chat API] Message content is array, found text part:", messageText);
    } else {
      console.warn("[Chat API] Message content is array but no text part found:", lastMessageAny.content);
      // 尝试从其他 part 中提取文本
      messageText = lastMessageAny.content
        .map((part: any) => {
          if (typeof part === "string") return part;
          if (part?.text) return part.text;
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }
  } else if (lastMessageAny.content) {
    // 尝试直接访问 text 属性
    messageText = lastMessageAny.content.text || String(lastMessageAny.content) || "";
    console.log("[Chat API] Message content is object, extracted:", messageText);
  } else {
    console.error("[Chat API] Cannot extract message text from:", lastMessageAny);
  }

  console.log("[Chat API] Original message text extracted:", messageText);
  console.log("[Chat API] Message text length:", messageText.length);
  console.log("[Chat API] Message text contains #:", messageText.includes("#"));
  console.log("[Chat API] Message text contains file-:", messageText.includes("file-"));
  console.log("[Chat API] Message type:", typeof lastMessageAny.content);
  console.log("[Chat API] Message content structure:", JSON.stringify(lastMessageAny.content, null, 2));

  const modelParsed = parseModelFromMessage(messageText);
  console.log("[Chat API] Model parsed:", {
    modelId: modelParsed.model.id,
    hasModelMention: modelParsed.hasModelMention,
    cleanedContent: modelParsed.cleanedContent,
  });

  const docParsed = parseDocumentsFromMessage(messageText);
  console.log("[Chat API] Document parsed:", {
    hasDocumentMention: docParsed.hasDocumentMention,
    documents: docParsed.documents,
    documentsCount: docParsed.documents.length,
    cleanedContent: docParsed.cleanedContent,
  });
  console.log("[Chat API] Document IDs extracted:", docParsed.documents.map((d) => d.fileId));
  console.log("[Chat API] Document objects detail:", JSON.stringify(docParsed.documents, null, 2));

  // 使用请求中的 documentIds 或从消息中解析的
  const parsedDocumentIds = docParsed.documents.map((d) => d.fileId);
  const documentIds = requestDocumentIds || parsedDocumentIds;

  console.log("[Chat API] Final document IDs to use:", documentIds);
  console.log("[Chat API] Request documentIds:", requestDocumentIds);
  console.log("[Chat API] Parsed documentIds:", parsedDocumentIds);
  console.log("[Chat API] Document IDs length check:", {
    requestDocumentIdsLength: requestDocumentIds?.length || 0,
    parsedDocumentIdsLength: parsedDocumentIds.length,
    finalDocumentIdsLength: documentIds.length,
  });

  // 创建对应的 provider
  const provider = createModelProvider(modelParsed.model);

  // 构建 RAG 上下文（如果有引用的文档）
  let enhancedContent = modelParsed.cleanedContent;
  let ragContext = null;

  // 优先使用客户端发送的 RAG 上下文（客户端可以访问 IndexedDB）
  if (clientRAGContext) {
    console.log("[Chat API] Using client-provided RAG context:", {
      chunksCount: clientRAGContext.relevantChunks.length,
      contextLength: clientRAGContext.contextText.length,
    });
    ragContext = clientRAGContext;
    const userQuery = docParsed.cleanedContent || modelParsed.cleanedContent;
    if (ragContext.contextText.length > 0) {
      enhancedContent = buildEnhancedMessage(userQuery, ragContext);
      console.log("[Chat API] Enhanced content created from client RAG context, length:", enhancedContent.length);
    }
  } else if (documentIds.length > 0) {
    try {
      console.log("[Chat API] ========== Starting RAG Process ==========");
      console.log("[Chat API] Building RAG context for documents:", documentIds);
      const userQuery = docParsed.cleanedContent || modelParsed.cleanedContent;
      console.log("[Chat API] User query for RAG:", userQuery);
      console.log("[Chat API] User query length:", userQuery.length);
      
      ragContext = await buildRAGContext(
        documentIds,
        userQuery,
        { topK: 5, minScore: 0.3 } // 降低 minScore 以便获取更多相关块
      );

      console.log("[Chat API] RAG context built successfully:", {
        chunksCount: ragContext.relevantChunks.length,
        contextLength: ragContext.contextText.length,
        chunks: ragContext.relevantChunks.map(c => ({
          fileId: c.fileId,
          fileName: c.fileName,
          score: c.score,
          textPreview: c.text.substring(0, 50) + "...",
        })),
      });

      if (ragContext.contextText.length > 0) {
        enhancedContent = buildEnhancedMessage(userQuery, ragContext);
        console.log("[Chat API] Enhanced content created, length:", enhancedContent.length);
        console.log("[Chat API] Enhanced content preview:", enhancedContent.substring(0, 200) + "...");
      } else {
        console.warn("[Chat API] ⚠️ RAG context is empty, using original query");
        console.warn("[Chat API] This might mean:");
        console.warn("[Chat API]   1. No chunks found in database for these file IDs");
        console.warn("[Chat API]   2. All chunks scored below minScore threshold");
        console.warn("[Chat API]   3. Files were not processed/embedded");
      }
    } catch (error) {
      console.error("[Chat API] ❌ RAG context building failed:", error);
      console.error("[Chat API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
      // 继续执行，不使用 RAG
    }
  } else {
    console.log("[Chat API] ⚠️ No documents referenced, skipping RAG");
    console.log("[Chat API] Document IDs check:", {
      requestDocumentIds,
      parsedDocumentIds: docParsed.documents.map((d) => d.fileId),
      finalDocumentIds: documentIds,
    });
  }

  // 清理消息内容（移除 @mention 和 #mention 部分）
  const cleanedMessages = messages.map((msg: any, index: number) => {
    // 只清理最后一条用户消息
    if (index === messages.length - 1 && msg.role === "user") {
      // 优先处理 parts 格式（assistant-ui 使用的格式）
      if (Array.isArray(msg.parts)) {
        const textPartIndex = msg.parts.findIndex((part: any) => part.type === "text");
        if (textPartIndex !== -1) {
          return {
            ...msg,
            parts: msg.parts.map((part: any, partIndex: number) =>
              partIndex === textPartIndex ? { ...part, text: enhancedContent } : part
            ),
          };
        }
      }
      // 处理 content 格式
      const msgContent = (msg as any).content;
      if (typeof msgContent === "string") {
        return {
          ...msg,
          content: enhancedContent,
        };
      }
      // 处理多部分消息
      if (Array.isArray(msgContent)) {
        const textPart = msgContent.find((part: any) => part.type === "text");
        if (textPart) {
          return {
            ...msg,
            content: msgContent.map((part: any) =>
              part.type === "text" ? { ...part, text: enhancedContent } : part
            ),
          };
        }
      }
    }
    return msg;
  });

  // 获取用户自定义配置并合并
  const userConfigOverride = getModelConfigOverride(modelParsed.model.id);
  const mergedConfig = mergeModelConfig(modelParsed.model.config, userConfigOverride);

  console.log("[Chat API] Final enhanced content:", enhancedContent);
  console.log("[Chat API] Messages to send:", JSON.stringify(cleanedMessages.map((m: any) => {
    const content = m.content;
    return {
      role: m.role,
      contentPreview: typeof content === 'string' 
        ? content.substring(0, 100) 
        : content ? JSON.stringify(content).substring(0, 100) : "undefined",
    };
  }), null, 2));
  console.log("[Chat API] ========== RAG Debug End ==========");

  // 调用 provider
  return provider.streamText({
    messages: cleanedMessages,
    system: userStudyMode ? systemPrompt : undefined,
    config: mergedConfig,
  });
}
