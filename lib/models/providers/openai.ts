import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { ModelProvider } from "./base";
import type { ModelConfig } from "../registry";

export class OpenAIProvider implements ModelProvider {
  constructor(private config: ModelConfig) {}

  async streamText(params: {
    messages: any[];
    system?: string;
    config?: ModelConfig['config'];
  }): Promise<Response> {
    const apiKey = process.env[this.config.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key: ${this.config.apiKeyEnv}`);
    }

    const model = openai(this.config.modelId, {
      apiKey,
    });

    const result = streamText({
      model,
      messages: convertToModelMessages(params.messages),
      system: params.system,
      maxTokens: params.config?.maxTokens,
      temperature: params.config?.temperature,
      // OpenAI 特定配置
      ...(params.config?.responseFormat && {
        responseFormat: { type: params.config.responseFormat }
      }),
    });

    return result.toUIMessageStreamResponse();
  }
}

