/**
 * Token 计数工具
 * 支持多种模型的 token 计数
 */

/**
 * 估算文本的 token 数量
 * 使用启发式方法：英文 ≈ 4 字符/token，中文 ≈ 2 字符/token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // 统计中文字符（包括中文标点）
  const chineseChars = (text.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g) || []).length;
  
  // 统计其他字符（主要是英文、数字、标点等）
  const otherChars = text.length - chineseChars;
  
  // 估算 tokens
  // 中文：约 2 字符/token
  // 英文/其他：约 4 字符/token
  const chineseTokens = Math.ceil(chineseChars / 2);
  const otherTokens = Math.ceil(otherChars / 4);
  
  return chineseTokens + otherTokens;
}

/**
 * 将 token 数量转换为字符数（用于分块）
 * 使用保守估算，确保不超过 token 限制
 */
export function tokensToChars(tokens: number, chineseRatio: number = 0.3): number {
  // 假设混合内容：30% 中文，70% 英文
  // 平均：1 token ≈ 3 字符（保守估算）
  return Math.floor(tokens * 3);
}

/**
 * 将字符数转换为 token 数量
 */
export function charsToTokens(chars: number, chineseRatio: number = 0.3): number {
  // 混合内容：1 token ≈ 3 字符
  return Math.ceil(chars / 3);
}

/**
 * 检测文本中的中文比例
 */
export function detectChineseRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g) || []).length;
  return chineseChars / text.length;
}

