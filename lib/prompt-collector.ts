export const PROMPT_COLLECT_EVENT = "prompt-sidebar:collect";

export type PromptCollectDetail = {
  messageId: string;
  title: string;
  content: string[];
};

export const dispatchPromptCollect = (detail: PromptCollectDetail) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PromptCollectDetail>(PROMPT_COLLECT_EVENT, {
      detail,
    }),
  );
};

