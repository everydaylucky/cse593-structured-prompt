/**
 * Thread 文件夹存储
 * 类似 prompt collection 的文件夹系统
 */

export interface ThreadFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string; // 父文件夹 ID
  type: "folder";
  isExpanded?: boolean;
}

const FOLDERS_KEY = "structify-thread-folders";

export function getThreadFolders(): ThreadFolder[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(FOLDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveThreadFolders(folders: ThreadFolder[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error("Failed to save thread folders:", error);
  }
}

export function createThreadFolder(name: string, parentId?: string): ThreadFolder {
  return {
    id: `thread-folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    parentId,
    type: "folder",
    isExpanded: true,
  };
}

export function updateThreadFolder(folderId: string, updates: Partial<ThreadFolder>): void {
  const folders = getThreadFolders();
  const index = folders.findIndex(f => f.id === folderId);
  if (index !== -1) {
    folders[index] = { ...folders[index], ...updates, updatedAt: Date.now() };
    saveThreadFolders(folders);
  }
}

export function deleteThreadFolder(folderId: string): void {
  const folders = getThreadFolders();
  const filtered = folders.filter(f => f.id !== folderId);
  saveThreadFolders(filtered);
}

