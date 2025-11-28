/**
 * 文档处理模型配置存储
 */

export interface DocumentProcessingConfig {
  summaryModel: string; // Model for generating summaries
  tocModel: string; // Model for extracting table of contents
  keywordsModel: string; // Model for extracting keywords
  queryEnhancementModel: string; // Model for query enhancement
}

const STORAGE_KEY = 'document-processing-config';

const DEFAULT_CONFIG: DocumentProcessingConfig = {
  summaryModel: 'openai/gpt-4o-mini',
  tocModel: 'openai/gpt-4o-mini',
  keywordsModel: 'openai/gpt-4o-mini',
  queryEnhancementModel: 'openai/gpt-4o-mini',
};

export function getDocumentProcessingConfig(): DocumentProcessingConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DocumentProcessingConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('Failed to load document processing config:', error);
  }

  return DEFAULT_CONFIG;
}

export function saveDocumentProcessingConfig(
  config: Partial<DocumentProcessingConfig>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = getDocumentProcessingConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save document processing config:', error);
  }
}

