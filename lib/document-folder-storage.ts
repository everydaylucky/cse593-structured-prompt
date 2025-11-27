/**
 * Document 文件夹存储
 * 用于组织文档的文件夹系统
 */

export interface DocumentFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string; // 父文件夹 ID
  type: "folder";
  isExpanded?: boolean;
}

const FOLDERS_KEY = "structify-document-folders";

export function getDocumentFolders(): DocumentFolder[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(FOLDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveDocumentFolders(folders: DocumentFolder[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error("Failed to save document folders:", error);
  }
}

export function createDocumentFolder(name: string, parentId?: string): DocumentFolder {
  return {
    id: `doc-folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    parentId,
    type: "folder",
    isExpanded: true,
  };
}

export function updateDocumentFolder(folderId: string, updates: Partial<DocumentFolder>): void {
  const folders = getDocumentFolders();
  const index = folders.findIndex(f => f.id === folderId);
  if (index !== -1) {
    folders[index] = { ...folders[index], ...updates, updatedAt: Date.now() };
    saveDocumentFolders(folders);
  }
}

export function deleteDocumentFolder(folderId: string): void {
  const folders = getDocumentFolders();
  const filtered = folders.filter(f => f.id !== folderId);
  saveDocumentFolders(filtered);
}

