# 模型 @Mention 功能使用说明

## 功能概述

实现了类似 Poe 的模型切换功能，通过在消息开头使用 `@model-name` 来切换不同的 AI 模型。

## 核心规则

**只有消息的第一个字符是 `@` 时才会激活模型选择，否则使用默认模型。**

## 环境变量配置

在项目根目录创建 `.env.local` 文件（参考 `.env.example`）：

```env
# OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google AI API Key (for Gemini models)
GOOGLE_API_KEY=your-google-api-key-here
```

## 使用方式

### 1. 在消息中使用 @mention

- `@gpt-5 Hello, how are you?` → 使用 GPT-5 模型
- `@gemini-2.5-pro Write a poem` → 使用 Gemini 2.5 Pro 模型
- `Hello @gpt-5, how are you?` → 使用默认模型（@ 不在开头）
- `Hello, how are you?` → 使用默认模型

### 2. 模型搜索功能

1. 在输入框开头输入 `@`
2. 自动弹出模型搜索框
3. 输入模型名称进行搜索（如 `@gpt` 或 `@gemini`）
4. 使用方向键选择，Enter 确认，或直接点击

### 3. 当前模型显示

选择模型后，输入框右上角会显示当前使用的模型标签。

## 添加新模型

只需在 `lib/models/registry.ts` 的 `MODEL_REGISTRY` 中添加配置：

```typescript
{
  id: 'new-model-id',           // @mention 使用的 ID
  displayName: 'New Model',      // 显示名称
  description: 'Model description',
  provider: 'openai',            // 或 'google'
  modelId: 'actual-api-model-id', // 实际 API 模型 ID
  apiKeyEnv: 'OPENAI_API_KEY',   // 环境变量名
  icon: '🤖',                    // 图标
  default: false,                // 是否默认模型
  config: {
    maxTokens: 4096,
    temperature: 0.7,
  }
}
```

## 项目结构

```
lib/models/
├── registry.ts          # 模型注册表（单一配置源）
├── message-parser.ts    # 消息解析器（检测 @mention）
└── providers/
    ├── base.ts          # Provider 接口
    ├── factory.ts       # Provider 工厂
    ├── openai.ts        # OpenAI 实现
    └── google.ts        # Google 实现

components/model-mention/
├── mention-input.tsx    # 输入组件（独立使用）
├── mention-popover.tsx  # 搜索弹出框
└── mention-tag.tsx      # 模型标签

components/assistant-ui/
└── composer-with-mention.tsx  # 集成到 Composer 的组件
```

## 技术实现

1. **消息解析**：`parseModelFromMessage()` 只解析消息开头的 `@mention`
2. **模型注册表**：集中管理所有模型配置
3. **Provider 模式**：每个 AI 提供商独立实现，处理不同的 API 要求
4. **自动路由**：API 根据模型 ID 自动选择对应的 provider

## 注意事项

- 环境变量必须正确配置，否则会报错
- 只有消息开头是 `@` 才会触发模型切换
- 消息中的 `@mention` 会在发送前自动清理
- 默认模型在 `MODEL_REGISTRY` 中标记为 `default: true`

