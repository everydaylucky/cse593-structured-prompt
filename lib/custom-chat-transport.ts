import { DefaultChatTransport, type UIMessage } from "ai";
import { parseDocumentsFromMessage } from '@/lib/document-parser';
import { buildRAGContext } from '@/lib/rag-context-builder';

/**
 * A custom chat transport that extends the default transport to build RAG context
 * on the client-side before sending the request to the server.
 */
export class CustomChatTransport extends DefaultChatTransport<UIMessage> {
  constructor(options: ConstructorParameters<typeof DefaultChatTransport>[0]) {
    super(options);
    // Log when the transport is instantiated
    console.log('[Client Transport] CustomChatTransport constructor() called');
  }

  /**
   * Overrides the default fetch method to intercept the request, build RAG context,
   * and then send the modified request.
   */
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    console.log('[Client Transport] ========== fetch() INTERCEPTED ==========');
    
    const modifiedInit = { ...init };

    // We can only modify the body if it's present, on the client side, and is a string
    if (modifiedInit.body && typeof window !== 'undefined' && typeof modifiedInit.body === 'string') {
      try {
        const body = JSON.parse(modifiedInit.body);
        const messages = body.messages as UIMessage[] | undefined;

        // Check if there are messages and the last one is from the user
        if (messages && messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === 'user') {
            // Build RAG context and add it to the request body
            const ragContext = await this.buildRAGContextForMessages(messages);
            if (ragContext) {
              body.ragContext = ragContext;
              modifiedInit.body = JSON.stringify(body);
              console.log('[Client Transport] ✅ Request body updated with RAG context');
            }
          }
        }
      } catch (error) {
        console.error('[Client Transport] ❌ Error processing body for RAG:', error);
      }
    } else {
      console.log('[Client Transport] Body not processed for RAG:', {
        hasBody: !!modifiedInit.body,
        isClient: typeof window !== 'undefined',
        isString: typeof modifiedInit.body === 'string',
      });
    }

    // Call the original fetch method with the (potentially modified) init object.
    return super.fetch(input, modifiedInit);
  }

  /**
   * Helper method to build RAG context.
   */
  private async buildRAGContextForMessages(messages: UIMessage[]): Promise<any> {
    if (messages.length === 0) return null;
    
    const lastMessage = messages[messages.length - 1]!;
    
    console.log('[Client Transport] ✅ Processing user message for RAG...');
    let messageText = '';
    const lastMessageAny = lastMessage as any;

    // Extract text from message parts or content
    if (Array.isArray(lastMessageAny.parts)) {
      const textPart = lastMessageAny.parts.find((p: any) => p.type === 'text');
      messageText = textPart?.text || '';
    } else if (lastMessageAny.content) {
      messageText = typeof lastMessageAny.content === 'string' ? lastMessageAny.content : '';
    }

    if (!messageText) return null;

    // Parse for document mentions
    const docParsed = parseDocumentsFromMessage(messageText);
    if (docParsed.hasDocumentMention && docParsed.documents.length > 0) {
      console.log('[Client Transport] ✅ Found document mentions, building RAG context for:', docParsed.documents.map(d => d.fileId));
      const userQuery = docParsed.cleanedContent || messageText;
      
      const ragContext = await buildRAGContext(
        docParsed.documents.map(d => d.fileId),
        userQuery,
        { topK: 5, minScore: 0.3 }
      );

      if (ragContext.contextText.length > 0) {
        console.log('[Client Transport] ✅ RAG context built successfully, chunks:', ragContext.relevantChunks.length);
        return ragContext;
      } else {
        console.warn('[Client Transport] ⚠️ RAG context is empty (no relevant chunks found)');
      }
    } else {
      console.log('[Client Transport] No document mentions found in the last message.');
    }
    
    return null;
  }
}
