import type { ModelConfig } from "../registry";

export interface ModelProvider {
  streamText(params: {
    messages: any[];
    system?: string;
    config?: ModelConfig['config'];
  }): Promise<Response>;
}

