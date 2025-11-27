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
 * 包含所有 OpenAI 和 Google Gemini 模型
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  // OpenAI Models

  {
    id: 'o1',
    displayName: 'O1',
    description: 'OpenAI O1 (200k context, reasoning)',
    provider: 'openai',
    modelId: 'o1',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🧠',
    config: {
      maxTokens: 16384,
      temperature: 0.7,
    }
  },
  {
    id: 'o1-mini',
    displayName: 'O1 Mini',
    description: 'OpenAI O1 Mini (200k context, reasoning)',
    provider: 'openai',
    modelId: 'o1-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🧠',
    config: {
      maxTokens: 16384,
      temperature: 0.7,
    }
  },
  {
    id: 'o3-mini',
    displayName: 'O3 Mini',
    description: 'OpenAI O3 Mini (200k context, reasoning)',
    provider: 'openai',
    modelId: 'o3-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🧠',
    config: {
      maxTokens: 16384,
      temperature: 0.7,
    }
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'OpenAI GPT-4o (128k context, 16k output)',
    provider: 'openai',
    modelId: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🚀',
    default: true,
    config: {
      maxTokens: 16384,
      temperature: 0.7,
    }
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    description: 'OpenAI GPT-4o Mini (128k context, 16k output)',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🚀',
    default: true,
    config: {
      maxTokens: 16384,
      temperature: 0.7,
    }
  },
  {
    id: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    description: 'OpenAI GPT-4 Turbo (128k context, 4k output)',
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🚀',
    config: {
      maxTokens: 4096,
      temperature: 0.7,
    }
  },
  {
    id: 'gpt-4',
    displayName: 'GPT-4',
    description: 'OpenAI GPT-4 (8k context, 8k output)',
    provider: 'openai',
    modelId: 'gpt-4',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🚀',
    config: {
      maxTokens: 8192,
      temperature: 0.7,
    }
  },
  {
    id: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    description: 'OpenAI GPT-3.5 Turbo (16k context, 4k output)',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    apiKeyEnv: 'OPENAI_API_KEY',
    icon: '🚀',
    config: {
      maxTokens: 4096,
      temperature: 0.7,
    }
  },
  // Google Gemini Models - Gemini 2.5 Series
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Google Gemini 2.5 Pro (1M context, 65k output)',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 65536,
      temperature: 0.8,
    }
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Google Gemini 2.5 Flash (1M context, 65k output)',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 65536,
      temperature: 0.8,
    }
  },
  {
    id: 'gemini-2.5-flash-lite-preview',
    displayName: 'Gemini 2.5 Flash Lite (Preview)',
    description: 'Google Gemini 2.5 Flash Lite Preview (1M context)',
    provider: 'google',
    modelId: 'gemini-2.5-flash-lite-preview',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 65536,
      temperature: 0.8,
    }
  },
  // Google Gemini Models - Gemini 3.0 Series
  {
    id: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro (Preview)',
    description: 'Google Gemini 3 Pro Preview (200k context)',
    provider: 'google',
    modelId: 'gemini-3-pro-preview',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 8192,
      temperature: 0.8,
    }
  },
  // Google Gemini Models - Gemini 1.5 Series
  {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Google Gemini 1.5 Pro',
    provider: 'google',
    modelId: 'gemini-1.5-pro',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 8192,
      temperature: 0.8,
    }
  },
  {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Google Gemini 1.5 Flash',
    provider: 'google',
    modelId: 'gemini-1.5-flash',
    apiKeyEnv: 'GOOGLE_API_KEY',
    icon: '⭐',
    config: {
      maxTokens: 8192,
      temperature: 0.8,
    }
  },
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

