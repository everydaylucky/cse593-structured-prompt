/**
 * 模型配置存储
 * 使用 localStorage 存储用户自定义的模型配置
 */

import type { ModelConfig } from './registry';

export interface ModelConfigOverride {
  modelId: string;
  config: Partial<ModelConfig['config']>;
}

const CONFIG_STORAGE_KEY = 'model-config-overrides';

/**
 * 获取模型配置覆盖
 */
export function getModelConfigOverride(modelId: string): Partial<ModelConfig['config']> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) return null;
    
    const overrides: Record<string, ModelConfigOverride> = JSON.parse(stored);
    return overrides[modelId]?.config || null;
  } catch {
    return null;
  }
}

/**
 * 保存模型配置覆盖
 */
export function saveModelConfigOverride(
  modelId: string,
  config: Partial<ModelConfig['config']>
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    const allOverrides: Record<string, ModelConfigOverride> = stored ? JSON.parse(stored) : {};
    
    allOverrides[modelId] = {
      modelId,
      config,
    };
    
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(allOverrides));
  } catch (error) {
    console.error('Failed to save model config override:', error);
  }
}

/**
 * 获取所有模型配置覆盖
 */
export function getAllModelConfigOverrides(): Record<string, ModelConfigOverride> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * 删除模型配置覆盖
 */
export function deleteModelConfigOverride(modelId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) return;
    
    const allOverrides: Record<string, ModelConfigOverride> = JSON.parse(stored);
    delete allOverrides[modelId];
    
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(allOverrides));
  } catch (error) {
    console.error('Failed to delete model config override:', error);
  }
}

/**
 * 合并默认配置和用户覆盖配置
 */
export function mergeModelConfig(
  defaultConfig: ModelConfig['config'] | undefined,
  override: Partial<ModelConfig['config']> | null
): ModelConfig['config'] | undefined {
  if (!override && !defaultConfig) return undefined;
  
  return {
    ...defaultConfig,
    ...override,
  };
}

