import { getModelConfig, getDefaultModel, type ModelConfig } from "./registry";

/**
 * 解析消息中的模型 mention
 * 规则：只有消息的第一个字符是 @ 时才解析模型
 * 
 * @param messageText 消息文本
 * @returns 解析结果：模型配置和清理后的消息内容
 */
export interface ParsedMessage {
  model: ModelConfig;
  cleanedContent: string;
  hasModelMention: boolean;
}

export function parseModelFromMessage(messageText: string): ParsedMessage {
  const trimmed = messageText.trim();
  
  // 检查消息是否以 @ 开头
  if (!trimmed.startsWith('@')) {
    // 不是以 @ 开头，使用默认模型
    return {
      model: getDefaultModel(),
      cleanedContent: messageText,
      hasModelMention: false,
    };
  }

  // 提取 @ 后的内容（直到第一个空格或换行）
  const afterAt = trimmed.substring(1);
  const spaceIndex = afterAt.search(/[\s\n]/);
  const modelId = spaceIndex === -1 
    ? afterAt 
    : afterAt.substring(0, spaceIndex);

  // 查找模型配置
  const model = getModelConfig(modelId);
  
  if (model) {
    // 找到模型，移除 @mention 部分
    const mentionLength = 1 + modelId.length; // @ + modelId
    const cleanedContent = messageText.substring(mentionLength).trim();
    
    return {
      model,
      cleanedContent,
      hasModelMention: true,
    };
  }

  // @ 开头但模型未找到，使用默认模型（保留原始消息）
  return {
    model: getDefaultModel(),
    cleanedContent: messageText,
    hasModelMention: false,
  };
}

/**
 * 检查文本是否应该触发模型搜索弹出框
 * 规则：只有光标在消息开头且输入了 @ 时才触发
 * 如果已经有完整的 @mention（后面有空格），则不触发
 */
export function shouldShowModelPopover(
  text: string,
  cursorPosition: number
): { show: boolean; query: string } {
  const textBeforeCursor = text.substring(0, cursorPosition);
  const trimmedBefore = textBeforeCursor.trimStart();
  
  // 检查是否在消息开头（考虑前导空格）
  const isAtStart = textBeforeCursor.length === trimmedBefore.length;
  
  if (!isAtStart) {
    return { show: false, query: '' };
  }
  
  // 检查是否以 @ 开头
  if (!trimmedBefore.startsWith('@')) {
    return { show: false, query: '' };
  }
  
  // 提取 @ 后的内容
  const afterAt = trimmedBefore.substring(1);
  const spaceIndex = afterAt.search(/[\s\n]/);
  
  // 如果 @ 后面已经有内容且后面有空格，说明已经有完整的 mention
  if (spaceIndex !== -1 && spaceIndex > 0) {
    // 检查光标是否在空格后面，如果是，说明 mention 已经完成，不触发
    const afterSpace = afterAt.substring(spaceIndex + 1);
    // 如果空格后面有内容，说明 mention 已完成
    if (afterSpace.length > 0) {
      return { show: false, query: '' };
    }
  }
  
  // 提取查询内容（@ 后到空格或换行的内容）
  const query = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
  
  // 如果查询内容为空（只有 @），也显示
  return { show: true, query };
}

