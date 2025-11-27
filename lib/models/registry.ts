/**
 * 模型配置注册表
 * 这是单一配置源 - 添加新模型只需在这里添加配置
 */

export interface ModelConfig {
  id: string;                    // "@gpt-5", "@gemini-2.5-pro" (不包含 @ 符号)
  displayName: string;           // "GPT-5"
  description?: string;          // 模型描述
  provider: 'openai' | 'google';
  modelId: string;               // 实际 API 模型 ID
  apiKeyEnv: string;             // 环境变量名
  icon?: string;                 // 图标 emoji 或 URL
  category?: string;             // 分类（如 "text", "code"）
  default?: boolean;             // 默认模型
  // 模型特定配置
  config?: {
    maxTokens?: number;
    temperature?: number;
    // OpenAI 特定
    responseFormat?: 'text' | 'json_object';
    // Google 特定
    safetySettings?: any;
  };
}

/**
 * 模型注册表 - 单一配置源
 * 添加新模型只需在这里添加配置项
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'gpt-5',
    displayName: 'GPT-5',
    description: 'OpenAI GPT-5 model',
    provider: 'openai',
    modelId: 'gpt-5-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🤖',
    default: true,
    config: {
      maxTokens: 4096,
      temperature: 0.7,
    }
  },
  {
    id: 'gpt-5-codex',
    displayName: 'GPT-5 Codex',
    description: 'OpenAI GPT-5 optimized for code',
    provider: 'openai',
    modelId: 'gpt-5-codex',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '💻',
    category: 'code',
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Google Gemini 2.5 Pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 8192,
      temperature: 0.8,
    }
  },
  {
    id: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro',
    description: 'Google Gemini 3 Pro',
    provider: 'google',
    modelId: 'gemini-3-pro',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
  }
];

/**
 * 根据 ID 获取模型配置
 */
export function getModelConfig(id: string): ModelConfig | null {
  return MODEL_REGISTRY.find(m => m.id === id) || null;
}

/**
 * 获取默认模型
 */
export function getDefaultModel(): ModelConfig {
  return MODEL_REGISTRY.find(m => m.default) || MODEL_REGISTRY[0];
}

/**
 * 搜索模型（用于 @mention 搜索框）
 */
export function searchModels(query: string): ModelConfig[] {
  if (!query) {
    return MODEL_REGISTRY;
  }
  
  const lowerQuery = query.toLowerCase();
  return MODEL_REGISTRY.filter(m => 
    m.id.toLowerCase().includes(lowerQuery) ||
    m.displayName.toLowerCase().includes(lowerQuery) ||
    m.description?.toLowerCase().includes(lowerQuery)
  );
}

