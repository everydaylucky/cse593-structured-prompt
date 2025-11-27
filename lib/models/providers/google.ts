import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import type { ModelProvider } from "./base";
import type { ModelConfig } from "../registry";

export class GoogleProvider implements ModelProvider {
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

    const model = google(this.config.modelId, {
      apiKey,
    });

    const result = streamText({
      model,
      messages: convertToModelMessages(params.messages),
      system: params.system,
      maxTokens: params.config?.maxTokens,
      temperature: params.config?.temperature,
      // Google 特定配置
      ...(this.config.config?.safetySettings && {
        safetySettings: this.config.config.safetySettings
      }),
    });

    return result.toUIMessageStreamResponse();
  }
}

