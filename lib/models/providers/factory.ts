import { OpenAIProvider } from "./openai";
import { GoogleProvider } from "./google";
import type { ModelProvider } from "./base";
import type { ModelConfig } from "../registry";

/**
 * 模型 Provider 工厂
 * 根据模型配置创建对应的 provider 实例
 */
export function createModelProvider(config: ModelConfig): ModelProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'google':
      return new GoogleProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

