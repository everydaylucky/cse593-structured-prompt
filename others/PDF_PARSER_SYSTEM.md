# PDF 解析器系统

## 概述

本系统支持多种 PDF 解析方案，包括免费和付费选项，并支持自动降级策略。

---

## 支持的解析器

### 1. Mathpix OCR ⭐
- **ID**: `mathpix`
- **类型**: 付费 API
- **质量**: 高
- **速度**: 中等
- **特点**:
  - ✅ 支持数学公式
  - ✅ 支持表格
  - ✅ 支持图片 OCR
  - ✅ 专业 STEM 文档解析
- **要求**: 需要 `MATHPIX_APP_ID` 和 `MATHPIX_API_KEY`

### 2. PDF.js (Browser) 🆓
- **ID**: `pdfjs-browser`
- **类型**: 免费（浏览器端）
- **质量**: 中等
- **速度**: 快
- **特点**:
  - ✅ 完全免费
  - ✅ 无需 API key
  - ✅ 浏览器端运行
  - ❌ 不支持数学公式
  - ❌ 不支持表格识别
- **要求**: 无

### 3. PDF Parse (Server) 🆓
- **ID**: `pdf-parse-server`
- **类型**: 免费（服务器端）
- **质量**: 中等
- **速度**: 快
- **特点**:
  - ✅ 完全免费
  - ✅ 无需 API key
  - ✅ 服务器端运行
  - ❌ 不支持数学公式
  - ❌ 不支持表格识别
- **要求**: 无

---

## 使用方法

### 1. 在 UI 中选择解析器

上传 PDF 文件时，可以在文件上传面板中选择解析器：

```tsx
<PDFParserSelector
  selectedParserId={selectedParserId}
  onSelect={setSelectedParserId}
/>
```

### 2. 自动降级策略

如果指定的解析器不可用或失败，系统会自动尝试其他解析器：

1. **优先使用选择的解析器**
2. **如果失败，按顺序尝试**:
   - 浏览器端: `pdfjs-browser` → `mathpix` (通过 API)
   - 服务器端: `pdf-parse-server` → `pdfjs-browser` → `mathpix`

### 3. 编程方式使用

```typescript
import { createPDFParser, parsePDFWithFallback } from '@/lib/pdf-parsers/factory';

// 方式 1: 使用指定解析器
const parser = await createPDFParser('pdfjs-browser');
const result = await parser.parse(file);

// 方式 2: 使用降级策略
const { result, parserId } = await parsePDFWithFallback(file, 'mathpix');
console.log(`Used parser: ${parserId}`);
```

---

## 配置

### 环境变量

在 `.env` 文件中添加（仅 Mathpix 需要）：

```bash
MATHPIX_APP_ID=your_app_id
MATHPIX_API_KEY=your_app_key
```

### 获取 Mathpix API Key

1. 访问 https://console.mathpix.com
2. 注册/登录账户
3. 在组织页面找到 App ID 和 App Key
4. 添加到 `.env` 文件

---

## 架构设计

### 文件结构

```
lib/pdf-parsers/
├── base.ts              # 基础接口定义
├── registry.ts          # 解析器注册表
├── factory.ts           # 工厂函数（创建解析器）
├── mathpix-parser.ts    # Mathpix 解析器实现
├── pdfjs-parser.ts      # PDF.js 解析器实现
└── pdf-parse-parser.ts  # pdf-parse 解析器实现
```

### 核心接口

```typescript
interface PDFParser {
  id: string;
  parse(file: File | Buffer): Promise<PDFParseResult>;
  isAvailable(): Promise<boolean>;
}
```

### 解析器配置

```typescript
interface PDFParserConfig {
  id: string;
  name: string;
  description: string;
  provider: 'mathpix' | 'pdfjs' | 'pdf-parse';
  free: boolean;
  requiresApiKey: boolean;
  quality: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
  supportsMath: boolean;
  supportsTables: boolean;
  supportsImages: boolean;
}
```

---

## 添加新解析器

### 步骤 1: 实现解析器类

```typescript
import type { PDFParser, PDFParseResult } from './base';

export class MyCustomParser implements PDFParser {
  id = 'my-custom-parser';

  async isAvailable(): Promise<boolean> {
    // 检查是否可用
    return true;
  }

  async parse(file: File | Buffer): Promise<PDFParseResult> {
    // 实现解析逻辑
    return {
      text: '...',
      metadata: {
        pageCount: 1,
        processedAt: Date.now(),
        parserId: this.id,
      },
    };
  }
}
```

### 步骤 2: 注册解析器

在 `registry.ts` 中添加：

```typescript
export const PDF_PARSER_REGISTRY: PDFParserConfig[] = [
  // ... 现有解析器
  {
    id: 'my-custom-parser',
    name: 'My Custom Parser',
    description: 'Custom PDF parser',
    provider: 'custom',
    free: true,
    requiresApiKey: false,
    quality: 'medium',
    speed: 'fast',
    supportsMath: false,
    supportsTables: false,
    supportsImages: false,
  },
];
```

### 步骤 3: 在工厂中添加

在 `factory.ts` 中添加创建逻辑：

```typescript
case 'custom':
  return new MyCustomParser();
```

---

## 最佳实践

### 1. 选择解析器

- **需要数学公式**: 使用 `mathpix`
- **需要快速处理**: 使用 `pdfjs-browser` 或 `pdf-parse-server`
- **不确定**: 使用自动降级策略

### 2. 错误处理

系统会自动处理降级，但如果所有解析器都失败，会抛出错误：

```typescript
try {
  const result = await parsePDFWithFallback(file);
} catch (error) {
  console.error('All parsers failed:', error);
  // 提示用户
}
```

### 3. 性能优化

- 小文件（< 1MB）: 使用 `pdfjs-browser`（浏览器端，快速）
- 大文件（> 1MB）: 使用 `pdf-parse-server`（服务器端，更稳定）
- 复杂文档: 使用 `mathpix`（质量最高）

---

## 故障排除

### 问题: Mathpix 解析器不可用

**原因**: 缺少 API key

**解决**:
1. 检查 `.env` 文件中是否有 `MATHPIX_APP_ID` 和 `MATHPIX_API_KEY`
2. 重启开发服务器
3. 系统会自动降级到免费解析器

### 问题: PDF.js 解析失败

**原因**: PDF 文件损坏或格式不支持

**解决**:
1. 检查 PDF 文件是否有效
2. 尝试使用其他解析器（如 `pdf-parse-server`）
3. 使用自动降级策略

### 问题: 所有解析器都失败

**原因**: PDF 文件问题或网络问题

**解决**:
1. 检查 PDF 文件是否损坏
2. 检查网络连接
3. 尝试重新上传文件

---

## 参考

- [Mathpix API 文档](https://docs.mathpix.com/)
- [PDF.js 文档](https://mozilla.github.io/pdf.js/)
- [pdf-parse 文档](https://www.npmjs.com/package/pdf-parse)

