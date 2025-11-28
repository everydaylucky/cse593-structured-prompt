/**
 * 文档 RAG 模式设置存储
 * 控制文档引用时是使用全文、RAG 还是智能模式
 */

export type DocumentRAGMode = 'full-text' | 'rag' | 'smart';

export interface DocumentRAGModeConfig {
  mode: DocumentRAGMode;
  smartThreshold?: {
    maxTextLength?: number; // 超过这个字符数使用 RAG（默认 50000，约 15-20 页）
  };
}

const STORAGE_KEY = 'document-rag-mode-config';

const DEFAULT_CONFIG: DocumentRAGModeConfig = {
  mode: 'smart',
  smartThreshold: {
    maxTextLength: 50000, // 超过 50000 字符使用 RAG（约 15-20 页）
  },
};

export function getDocumentRAGModeConfig(): DocumentRAGModeConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DocumentRAGModeConfig;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        smartThreshold: {
          maxTextLength: parsed.smartThreshold?.maxTextLength ?? DEFAULT_CONFIG.smartThreshold?.maxTextLength,
        },
      };
    }
  } catch (error) {
    console.error('Failed to load document RAG mode config:', error);
  }

  return DEFAULT_CONFIG;
}

export function saveDocumentRAGModeConfig(config: DocumentRAGModeConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save document RAG mode config:', error);
  }
}

