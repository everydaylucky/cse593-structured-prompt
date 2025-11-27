import type { SummarySnapshot } from "@/components/assistant-ui/prompt-card";

export interface PromptItem {
  id: string;
  title: string;
  content: string[];
  isEditing?: boolean;
  isIncluded: boolean;
  summarySnapshot?: SummarySnapshot;
  // 来源消息信息（当从对话拖入时记录）
  sourceMessageId?: string;        // 来源消息的 ID
  sourceThreadId?: string;         // 来源线程的 ID（支持跨线程）
  sourceMessageRole?: "user" | "assistant";  // 来源消息的角色
  sourceMessageTimestamp?: number;  // 来源消息的时间戳（用于显示）
}

export interface PromptCollection {
  id: string;
  name: string;
  prompts: PromptItem[];
  createdAt: number;
  updatedAt: number;
  parentId?: string; // 父文件夹 ID，如果为 undefined 或 null，则在根目录
  type: "page"; // 类型：page（页面）
}

export interface PromptFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string; // 父文件夹 ID，如果为 undefined 或 null，则在根目录
  type: "folder"; // 类型：folder（文件夹）
  isExpanded?: boolean; // 是否展开（用于 UI 状态）
}

// 树形节点（可以是文件夹或页面）
export type TreeNode = PromptFolder | PromptCollection;

const STORAGE_KEY = "structify-prompt-collections";
const FOLDERS_KEY = "structify-prompt-folders";
const CURRENT_COLLECTION_KEY = "structify-current-collection-id";

// 获取所有文件夹
export const getFolders = (): PromptFolder[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(FOLDERS_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as PromptFolder[];
  } catch (error) {
    console.error("Failed to load folders:", error);
    return [];
  }
};

// 保存所有文件夹
export const saveFolders = (folders: PromptFolder[]): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error("Failed to save folders:", error);
  }
};

// 获取所有树形节点（文件夹和页面）
export const getAllNodes = (): TreeNode[] => {
  const folders = getFolders();
  const collections = getCollections();
  return [...folders, ...collections];
};

// 根据 parentId 获取子节点
export const getChildren = (parentId: string | null | undefined): TreeNode[] => {
  const allNodes = getAllNodes();
  return allNodes.filter(node => {
    if (parentId === null || parentId === undefined) {
      return !node.parentId;
    }
    return node.parentId === parentId;
  });
};

// 获取根节点（没有 parentId 的节点）
export const getRootNodes = (): TreeNode[] => {
  return getChildren(null);
};

// 构建树形结构（用于 UI 显示）
export interface TreeNodeWithChildren {
  id: string;
  name: string;
  type: "folder" | "page";
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  children?: TreeNodeWithChildren[];
  // 如果是 page，还有这些属性
  prompts?: PromptItem[];
  // 如果是 folder，还有这个属性
  isExpanded?: boolean;
}

export const buildTree = (): TreeNodeWithChildren[] => {
  const allNodes = getAllNodes();
  const nodeMap = new Map<string, TreeNodeWithChildren>();
  const rootNodes: TreeNodeWithChildren[] = [];

  // 第一遍：创建所有节点的映射
  allNodes.forEach(node => {
    const nodeWithChildren: TreeNodeWithChildren = {
      id: node.id,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      children: [],
    };
    
    // 添加类型特定的属性
    if (node.type === "page") {
      nodeWithChildren.prompts = node.prompts;
    } else if (node.type === "folder") {
      nodeWithChildren.isExpanded = node.isExpanded;
    }
    
    nodeMap.set(node.id, nodeWithChildren);
  });

  // 第二遍：构建树形结构
  allNodes.forEach(node => {
    const nodeWithChildren = nodeMap.get(node.id)!;
    if (!node.parentId) {
      rootNodes.push(nodeWithChildren);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(nodeWithChildren);
      } else {
        // 父节点不存在，当作根节点处理
        rootNodes.push(nodeWithChildren);
      }
    }
  });

  // 排序：文件夹在前，页面在后，然后按名称排序
  const sortNodes = (nodes: TreeNodeWithChildren[]): TreeNodeWithChildren[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined,
    }));
  };

  return sortNodes(rootNodes);
};

export const getCollections = (): PromptCollection[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as PromptCollection[];
    // 迁移旧数据：确保所有 collections 都有 type 和 parentId
    const migrated = parsed.map(collection => ({
      ...collection,
      type: (collection as any).type || "page" as const,
      parentId: (collection as any).parentId,
    }));
    // 如果数据被迁移，保存回去
    if (migrated.some((c, i) => c.type !== parsed[i]?.type || c.parentId !== (parsed[i] as any)?.parentId)) {
      saveCollections(migrated);
    }
    return migrated;
  } catch (error) {
    console.error("Failed to load collections:", error);
    return [];
  }
};

export const saveCollections = (collections: PromptCollection[]): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch (error) {
    console.error("Failed to save collections:", error);
  }
};

export const getCurrentCollectionId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(CURRENT_COLLECTION_KEY);
};

export const setCurrentCollectionId = (id: string | null): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (id === null) {
    localStorage.removeItem(CURRENT_COLLECTION_KEY);
  } else {
    localStorage.setItem(CURRENT_COLLECTION_KEY, id);
  }
};

export const createCollection = (name: string, prompts: PromptItem[] = [], parentId?: string): PromptCollection => {
  const now = Date.now();
  return {
    id: `collection-${now}`,
    name,
    prompts,
    createdAt: now,
    updatedAt: now,
    parentId,
    type: "page",
  };
};

export const createFolder = (name: string, parentId?: string): PromptFolder => {
  const now = Date.now();
  return {
    id: `folder-${now}`,
    name,
    createdAt: now,
    updatedAt: now,
    parentId,
    type: "folder",
    isExpanded: false,
  };
};

export const getCollection = (id: string): PromptCollection | null => {
  const collections = getCollections();
  return collections.find((c) => c.id === id) ?? null;
};

export const getFolder = (id: string): PromptFolder | null => {
  const folders = getFolders();
  return folders.find((f) => f.id === id) ?? null;
};

export const getNode = (id: string): TreeNode | null => {
  const collection = getCollection(id);
  if (collection) return collection;
  const folder = getFolder(id);
  if (folder) return folder;
  return null;
};

export const addCollection = (collection: PromptCollection): void => {
  const collections = getCollections();
  collections.push(collection);
  saveCollections(collections);
};

export const addFolder = (folder: PromptFolder): void => {
  const folders = getFolders();
  folders.push(folder);
  saveFolders(folders);
};

export const updateCollection = (id: string, updates: Partial<PromptCollection>): void => {
  const collections = getCollections();
  const index = collections.findIndex((c) => c.id === id);
  if (index === -1) {
    return;
  }

  collections[index] = {
    ...collections[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveCollections(collections);
};

export const updateFolder = (id: string, updates: Partial<PromptFolder>): void => {
  const folders = getFolders();
  const index = folders.findIndex((f) => f.id === id);
  if (index === -1) {
    return;
  }

  folders[index] = {
    ...folders[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveFolders(folders);
};

export const updateNode = (id: string, updates: Partial<TreeNode>): void => {
  const collection = getCollection(id);
  if (collection) {
    updateCollection(id, updates as Partial<PromptCollection>);
    return;
  }
  const folder = getFolder(id);
  if (folder) {
    updateFolder(id, updates as Partial<PromptFolder>);
    return;
  }
};

export const deleteCollection = (id: string): void => {
  const collections = getCollections();
  const filtered = collections.filter((c) => c.id !== id);
  saveCollections(filtered);

  if (getCurrentCollectionId() === id) {
    const nextId = filtered.length > 0 ? filtered[0].id : null;
    setCurrentCollectionId(nextId);
  }
};

export const deleteFolder = (id: string): void => {
  const folders = getFolders();
  // 删除文件夹时，需要处理其子节点
  const allNodes = getAllNodes();
  const children = allNodes.filter(node => node.parentId === id);
  
  // 递归删除所有子节点
  const deleteNodeRecursive = (nodeId: string) => {
    if (getCollection(nodeId)) {
      deleteCollection(nodeId);
    } else if (getFolder(nodeId)) {
      const folderChildren = allNodes.filter(n => n.parentId === nodeId);
      folderChildren.forEach(child => deleteNodeRecursive(child.id));
      const folders = getFolders();
      const filtered = folders.filter((f) => f.id !== nodeId);
      saveFolders(filtered);
    }
  };
  
  children.forEach(child => deleteNodeRecursive(child.id));
  
  // 删除文件夹本身
  const filtered = folders.filter((f) => f.id !== id);
  saveFolders(filtered);
};

export const deleteNode = (id: string): void => {
  const collection = getCollection(id);
  if (collection) {
    deleteCollection(id);
    return;
  }
  const folder = getFolder(id);
  if (folder) {
    deleteFolder(id);
    return;
  }
};

// 移动节点到新的父节点
export const moveNode = (nodeId: string, newParentId: string | null | undefined): void => {
  const node = getNode(nodeId);
  if (!node) return;
  
  // 将 null 转换为 undefined，因为 parentId 是 string | undefined
  const parentId = newParentId === null ? undefined : newParentId;
  updateNode(nodeId, { parentId });
};

// 获取节点的完整路径（用于显示）
export const getNodePath = (nodeId: string): string[] => {
  const path: string[] = [];
  let currentId: string | null | undefined = nodeId;
  
  while (currentId) {
    const node = getNode(currentId);
    if (!node) break;
    path.unshift(node.name);
    currentId = node.parentId;
  }
  
  return path;
};

export const exportCollection = (collection: PromptCollection): string => {
  return JSON.stringify(collection, null, 2);
};

export const importCollection = (json: string): PromptCollection | null => {
  try {
    const parsed = JSON.parse(json) as PromptCollection;
    if (!parsed.id || !parsed.name || !Array.isArray(parsed.prompts)) {
      return null;
    }
    parsed.id = `collection-${Date.now()}`;
    parsed.createdAt = Date.now();
    parsed.updatedAt = Date.now();
    parsed.type = "page";
    return parsed;
  } catch (error) {
    console.error("Failed to import collection:", error);
    return null;
  }
};

export const exportAllCollections = (): string => {
  const collections = getCollections();
  const folders = getFolders();
  return JSON.stringify({ collections, folders }, null, 2);
};

export const importAllCollections = (json: string): boolean => {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      // 旧格式：只有 collections 数组
      const now = Date.now();
      const imported = parsed.map((c, index) => ({
        ...c,
        id: `collection-${now}-${index}`,
        createdAt: c.createdAt || now,
        updatedAt: now,
        type: "page" as const,
      }));

      const existing = getCollections();
      saveCollections([...existing, ...imported]);
      return true;
    } else if (parsed.collections && parsed.folders) {
      // 新格式：包含 collections 和 folders
      const now = Date.now();
      const importedCollections = (parsed.collections || []).map((c: any, index: number) => ({
        ...c,
        id: `collection-${now}-${index}`,
        createdAt: c.createdAt || now,
        updatedAt: now,
        type: "page" as const,
      }));
      
      const importedFolders = (parsed.folders || []).map((f: any, index: number) => ({
        ...f,
        id: `folder-${now}-${index}`,
        createdAt: f.createdAt || now,
        updatedAt: now,
        type: "folder" as const,
      }));

      const existingCollections = getCollections();
      const existingFolders = getFolders();
      saveCollections([...existingCollections, ...importedCollections]);
      saveFolders([...existingFolders, ...importedFolders]);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to import collections:", error);
    return false;
  }
};
