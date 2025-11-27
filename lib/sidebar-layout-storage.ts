/**
 * 侧边栏布局存储
 * 存储用户的布局偏好（单栏/双栏模式）
 */

export type SidebarLayoutMode = 'combined' | 'threads-only' | 'documents-only';

const LAYOUT_STORAGE_KEY = 'sidebar-layout-mode';

/**
 * 获取当前布局模式
 */
export function getSidebarLayoutMode(): SidebarLayoutMode {
  if (typeof window === 'undefined') return 'combined';
  
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    return (stored as SidebarLayoutMode) || 'combined';
  } catch {
    return 'combined';
  }
}

/**
 * 保存布局模式
 */
export function saveSidebarLayoutMode(mode: SidebarLayoutMode): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
  } catch (error) {
    console.error('Failed to save sidebar layout mode:', error);
  }
}

