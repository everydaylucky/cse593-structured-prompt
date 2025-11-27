import { streamText, UIMessage, convertToModelMessages } from "ai";
import chatPrompt from "@/data/chatPrompt.json";
import { parseModelFromMessage } from "@/lib/models/message-parser";
import { createModelProvider } from "@/lib/models/providers/factory";

const systemPrompt = chatPrompt.lines.join("\n");

type ChatRequestBody = {
  messages: UIMessage[];
  userStudyMode?: boolean;
};

export async function POST(req: Request) {
  const { messages, userStudyMode = true }: ChatRequestBody = await req.json();
  
  // 从最后一条用户消息中解析模型
  // 规则：只有消息开头是 @ 时才解析模型，否则使用默认模型
  const lastMessage = messages[messages.length - 1];
  const parsed = parseModelFromMessage(
    typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : lastMessage.content?.find((part: any) => part.type === 'text')?.text || ''
  );
  
  // 创建对应的 provider
  const provider = createModelProvider(parsed.model);
  
  // 如果消息中有模型 mention，清理消息内容（移除 @mention 部分）
  const cleanedMessages = parsed.hasModelMention
    ? messages.map((msg: any, index: number) => {
        // 只清理最后一条用户消息
        if (index === messages.length - 1 && msg.role === 'user') {
          if (typeof msg.content === 'string') {
            return {
              ...msg,
              content: parsed.cleanedContent,
            };
          }
          // 处理多部分消息
          const textPart = msg.content?.find((part: any) => part.type === 'text');
          if (textPart) {
            return {
              ...msg,
              content: msg.content.map((part: any) =>
                part.type === 'text'
                  ? { ...part, text: parsed.cleanedContent }
                  : part
              ),
            };
          }
        }
        return msg;
      })
    : messages;
  
  // 调用 provider
  return provider.streamText({
    messages: cleanedMessages,
    system: userStudyMode ? systemPrompt : undefined,
    config: parsed.model.config,
  });
}
