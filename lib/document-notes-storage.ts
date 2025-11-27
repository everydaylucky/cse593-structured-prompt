/**
 * 文档笔记存储
 * 使用 localStorage 存储用户对文档的笔记
 */

export interface DocumentNote {
  fileId: string;
  notes: string;
  updatedAt: number;
}

const NOTES_STORAGE_KEY = 'document-notes';

/**
 * 获取文档笔记
 */
export function getDocumentNote(fileId: string): string {
  if (typeof window === 'undefined') return '';
  
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!stored) return '';
    
    const notes: Record<string, DocumentNote> = JSON.parse(stored);
    return notes[fileId]?.notes || '';
  } catch {
    return '';
  }
}

/**
 * 保存文档笔记
 */
export function saveDocumentNote(fileId: string, notes: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    const allNotes: Record<string, DocumentNote> = stored ? JSON.parse(stored) : {};
    
    allNotes[fileId] = {
      fileId,
      notes,
      updatedAt: Date.now(),
    };
    
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(allNotes));
  } catch (error) {
    console.error('Failed to save document note:', error);
  }
}

/**
 * 获取所有文档笔记
 */
export function getAllDocumentNotes(): Record<string, DocumentNote> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * 删除文档笔记
 */
export function deleteDocumentNote(fileId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!stored) return;
    
    const allNotes: Record<string, DocumentNote> = JSON.parse(stored);
    delete allNotes[fileId];
    
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(allNotes));
  } catch (error) {
    console.error('Failed to delete document note:', error);
  }
}

