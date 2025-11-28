/**
 * 分块配置存储
 */

export interface ChunkingConfig {
  chunkSizeTokens: number; // 512-1024
  chunkOverlapRatio: number; // 0.15-0.20
  minChunkSizeTokens: number;
  maxChunkSizeTokens: number;
  preserveSentences: boolean;
  preserveSections: boolean;
}

const STORAGE_KEY = 'chunking-config';

const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSizeTokens: 768, // Middle of 512-1024 range
  chunkOverlapRatio: 0.175, // 17.5% (middle of 15-20%)
  minChunkSizeTokens: 512,
  maxChunkSizeTokens: 1024,
  preserveSentences: true,
  preserveSections: true,
};

export function getChunkingConfig(): ChunkingConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ChunkingConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('Failed to load chunking config:', error);
  }

  return DEFAULT_CONFIG;
}

export function saveChunkingConfig(config: Partial<ChunkingConfig>): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = getChunkingConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save chunking config:', error);
  }
}

