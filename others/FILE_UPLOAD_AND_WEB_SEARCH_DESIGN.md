# 文件上传和网络搜索功能设计

## 1. 功能概述

### 1.1 文件上传
- **支持格式**：PDF、HTML、TXT、MD 等
- **支持平台**：
  - OpenAI：通过 Files API 上传，支持多种格式
  - Google Gemini：原生支持 PDF、HTML 等格式

### 1.2 网络搜索
- **OpenAI Web Search**：
  - 支持的模型：`gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`, `o3`, `o3-mini`
  - 通过 `tools` 参数启用
  - 参考：https://platform.openai.com/docs/guides/tools-web-search

- **Google Search**：
  - 支持的模型：`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
  - 通过 `tools` 参数启用 `google_search`
  - 参考：https://ai.google.dev/gemini-api/docs/google-search

## 2. 架构设计

### 2.1 模型配置扩展

在 `ModelConfig` 中添加能力标记：

```typescript
export interface ModelConfig {
  // ... 现有字段
  capabilities?: {
    fileUpload?: {
      supported: boolean;
      formats?: string[]; // ['pdf', 'html', 'txt', 'md']
      maxSize?: number; // MB
    };
    webSearch?: {
      supported: boolean;
      provider?: 'openai' | 'google';
    };
  };
}
```

### 2.2 API 请求扩展

在 `ChatRequestBody` 中添加：

```typescript
type ChatRequestBody = {
  messages: UIMessage[];
  userStudyMode?: boolean;
  files?: Array<{
    id: string;
    name: string;
    type: string;
    url?: string; // 已上传文件的 URL
    data?: string; // base64 编码的文件数据
  }>;
  enableWebSearch?: boolean; // 是否启用网络搜索
};
```

### 2.3 文件上传流程

1. **前端上传**：
   - 用户选择文件
   - 前端上传到 `/api/files/upload` 端点
   - 返回文件 ID 和 URL
   - 将文件信息附加到消息中

2. **后端处理**：
   - OpenAI：使用 Files API 上传，获取 `file_id`
   - Google：直接处理 base64 或 URL

### 2.4 网络搜索流程

1. **模型配置检查**：
   - 检查模型是否支持网络搜索
   - 如果不支持，忽略 `enableWebSearch` 参数

2. **工具启用**：
   - OpenAI：添加 `tools: [{ type: 'web_search' }]`
   - Google：添加 `tools: [{ googleSearch: {} }]`

## 3. 实现步骤

### 3.1 更新模型注册表

在 `lib/models/registry.ts` 中为每个模型添加能力标记。

### 3.2 创建文件上传 API

创建 `app/api/files/upload/route.ts` 处理文件上传。

### 3.3 扩展 Provider 接口

在 `lib/models/providers/base.ts` 中扩展接口，支持文件和工具。

### 3.4 更新前端 UI

在 composer 组件中添加：
- 文件上传按钮
- 文件预览
- 网络搜索开关

### 3.5 更新 API 路由

在 `app/api/chat/route.ts` 中处理文件和工具参数。

## 4. 详细实现

### 4.1 模型配置示例

```typescript
{
  id: 'gpt-4o',
  displayName: 'GPT-4o',
  provider: 'openai',
  modelId: 'gpt-4o',
  capabilities: {
    fileUpload: {
      supported: true,
      formats: ['pdf', 'txt', 'md', 'html'],
      maxSize: 10, // MB
    },
    webSearch: {
      supported: true,
      provider: 'openai',
    },
  },
}
```

### 4.2 OpenAI 文件上传

```typescript
// 使用 OpenAI Files API
const file = await openai.files.create({
  file: fileBuffer,
  purpose: 'assistants',
});
```

### 4.3 Google 文件处理

```typescript
// Google 直接支持 base64 或 URL
const filePart = {
  fileData: {
    mimeType: 'application/pdf',
    fileUri: fileUrl, // 或 data: base64
  },
};
```

### 4.4 网络搜索工具

**OpenAI**:
```typescript
const result = streamText({
  model,
  messages,
  tools: {
    web_search: {}, // 启用网络搜索
  },
});
```

**Google**:
```typescript
const result = streamText({
  model,
  messages,
  tools: {
    googleSearch: {}, // 启用 Google Search
  },
});
```

## 5. 前端 UI 设计

### 5.1 文件上传组件

- 拖拽上传区域
- 文件列表显示
- 文件删除功能
- 文件大小和格式验证

### 5.2 网络搜索开关

- 在模型选择器中显示是否支持
- 在 composer 中添加开关
- 显示搜索状态（搜索中、已搜索）

## 6. 注意事项

1. **文件大小限制**：不同平台有不同的限制
2. **文件格式支持**：确保前端验证格式
3. **网络搜索成本**：每次搜索都会产生费用
4. **错误处理**：文件上传失败、搜索失败等场景
5. **用户体验**：上传进度、搜索状态提示

## 7. 参考文档

- OpenAI Files API: https://platform.openai.com/docs/api-reference/files
- OpenAI Web Search: https://platform.openai.com/docs/guides/tools-web-search
- Google Gemini Files: https://ai.google.dev/gemini-api/docs/upload-files
- Google Search: https://ai.google.dev/gemini-api/docs/google-search

