# 文档预处理增强设计文档

## 概述

在 PDF 处理流程中添加文档预处理阶段，使用 GPT-4o-mini 生成文档元数据，并使用最快的本地方法进行实体识别。

## 处理流程设计

### 完整流程

```
processPDFToRAG()
├── 1. PDF 解析 (现有)
│   └── 输出: 完整文档文本
│
├── 2. 文档预处理 (新增) ← 关键阶段
│   ├── 2.1 文本长度判断
│   │   ├── < 10000 字符 → 全文分析
│   │   └── ≥ 10000 字符 → 智能采样分析
│   │
│   ├── 2.2 GPT-4o-mini 分析 (异步，不阻塞)
│   │   ├── 生成文档摘要
│   │   ├── 提取关键词 (10-15个)
│   │   ├── 提取主题 (3-5个)
│   │   ├── 提取关键短语 (5-10个)
│   │   ├── 识别文档类型
│   │   └── 识别领域/学科
│   │
│   ├── 2.3 本地实体识别 (同步，最快)
│   │   ├── 人名识别
│   │   ├── 组织识别
│   │   ├── 地点识别
│   │   ├── 日期识别
│   │   └── 其他实体
│   │
│   └── 2.4 合并结果并存储
│
├── 3. 文本分块 (现有，可并行)
├── 4. 生成向量 (现有，可并行)
└── 5. 存储 (现有，已支持 metadata)
```

## 实体识别方案对比

### 方案对比表

| 方案 | 速度 | 准确度 | 资源占用 | 实现复杂度 | 推荐度 |
|------|------|--------|----------|------------|--------|
| **简单模式匹配** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **推荐** |
| compromise.js | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ 可选 |
| @xenova/transformers | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ❌ 不推荐 |
| 正则表达式 + 词典 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **推荐** |

### 最终选择：混合方案

**基础层（必须）**：简单模式匹配 + 规则
- 使用正则表达式匹配常见模式
- 使用常见实体词典
- **速度最快，即时可用**

**增强层（可选）**：compromise.js
- 如果需要更高准确度
- 可以异步加载
- 作为降级方案

## 实体识别实现设计

### 1. 人名识别

**方法A：模式匹配（最快）**
```javascript
// 匹配大写字母开头的连续词（2-4个词）
// 例如：John Smith, Mary Jane Watson
const personPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g;

// 常见人名前缀/后缀
const personTitles = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Professor'];
```

**方法B：词典匹配**
- 常见英文名列表（前1000个）
- 常见中文姓氏列表
- 结合上下文（如 "said", "according to" 后面）

### 2. 组织识别

**方法A：模式匹配**
```javascript
// 组织后缀
const orgSuffixes = [
  'Inc.', 'Ltd.', 'Corp.', 'Corporation', 'Company', 'Co.',
  'LLC', 'LLP', 'Foundation', 'Institute', 'University',
  'College', 'Hospital', 'Bank', 'Group', 'Systems'
];

// 匹配模式：词 + 组织后缀
const orgPattern = /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Inc\.|Ltd\.|Corp\.|Corporation|Company|Co\.|LLC|LLP|Foundation|Institute|University|College|Hospital|Bank|Group|Systems)\b/g;
```

**方法B：常见组织词典**
- 知名公司列表
- 知名大学列表
- 知名组织列表

### 3. 地点识别

**方法A：模式匹配**
```javascript
// 地点后缀
const locationSuffixes = [
  'City', 'State', 'Country', 'Street', 'Avenue', 'Road',
  'Park', 'Square', 'Plaza', 'Building', 'Tower'
];

// 常见城市/国家名称（词典）
const commonCities = ['New York', 'London', 'Paris', 'Tokyo', ...];
const commonCountries = ['United States', 'China', 'Japan', ...];
```

**方法B：地理词典**
- 世界主要城市列表
- 国家列表
- 州/省列表

### 4. 日期识别

**方法A：正则表达式（最快）**
```javascript
// 日期格式
const datePatterns = [
  /\b\d{4}-\d{2}-\d{2}\b/g,                    // 2024-01-15
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,              // 1/15/2024
  /\b(?:January|February|March|...)\s+\d{1,2},?\s+\d{4}\b/g,  // January 15, 2024
  /\b\d{4}\b/g                                  // 年份
];
```

### 5. 其他实体

- **货币**：`$`, `€`, `¥`, `USD`, `EUR` 等
- **百分比**：`%`, `percent`
- **邮箱**：`@` 符号模式
- **URL**：`http://`, `https://` 模式
- **ISBN**：ISBN 格式
- **引用**：引号内的内容

## 实现架构

### 核心函数设计

```typescript
// 实体识别接口
interface EntityExtractionResult {
  persons: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  other: {
    emails?: string[];
    urls?: string[];
    currencies?: string[];
    percentages?: string[];
  };
}

// 主函数：快速实体识别
function extractEntitiesFast(text: string): EntityExtractionResult {
  return {
    persons: extractPersons(text),
    organizations: extractOrganizations(text),
    locations: extractLocations(text),
    dates: extractDates(text),
    other: {
      emails: extractEmails(text),
      urls: extractUrls(text),
      currencies: extractCurrencies(text),
      percentages: extractPercentages(text),
    }
  };
}

// 各实体类型的提取函数
function extractPersons(text: string): string[] {
  // 1. 模式匹配
  // 2. 词典匹配
  // 3. 去重和验证
  // 4. 返回结果
}
```

### 性能优化策略

1. **一次性扫描**
   - 只遍历文本一次
   - 同时匹配所有模式
   - 使用 Set 去重

2. **早期退出**
   - 如果文本很短，跳过复杂匹配
   - 限制每种实体类型的最大数量

3. **缓存机制**
   - 缓存常见实体的匹配结果
   - 基于文本哈希

4. **异步处理（可选）**
   - 如果需要 compromise.js，异步加载
   - 不阻塞主流程

## 文档预处理完整实现

### GPT-4o-mini 分析部分

```typescript
async function generateDocumentMetadata(
  documentText: string,
  fileName: string
): Promise<DocumentMetadata> {
  // 文本采样策略
  let analysisText = documentText;
  if (documentText.length > 10000) {
    // 方案A：智能采样
    analysisText = smartSample(documentText);
  }
  
  // 调用 GPT-4o-mini
  const metadata = await callGPT4oMini(analysisText, fileName);
  
  return metadata;
}

function smartSample(text: string, maxLength: number = 10000): string {
  const chunkSize = Math.floor(maxLength / 3);
  
  // 前1/3：开头部分（通常包含摘要、目录）
  const start = text.substring(0, chunkSize);
  
  // 中1/3：中间部分（随机采样）
  const middleStart = Math.floor((text.length - chunkSize) / 2);
  const middle = text.substring(middleStart, middleStart + chunkSize);
  
  // 后1/3：结尾部分（通常包含结论）
  const end = text.substring(text.length - chunkSize);
  
  return `${start}\n\n[... middle section ...]\n\n${middle}\n\n[... end section ...]\n\n${end}`;
}
```

### 实体识别部分（最快实现）

```typescript
function extractEntitiesFast(text: string): EntityExtractionResult {
  const result: EntityExtractionResult = {
    persons: [],
    organizations: [],
    locations: [],
    dates: [],
    other: {}
  };
  
  // 并行提取所有实体类型
  result.persons = extractPersons(text);
  result.organizations = extractOrganizations(text);
  result.locations = extractLocations(text);
  result.dates = extractDates(text);
  result.other = {
    emails: extractEmails(text),
    urls: extractUrls(text),
    currencies: extractCurrencies(text),
    percentages: extractPercentages(text),
  };
  
  return result;
}
```

## 性能预期

### 实体识别性能

| 文档长度 | 处理时间 | 内存占用 |
|----------|----------|----------|
| < 1000 字符 | < 10ms | < 1MB |
| 1000-10000 字符 | 10-50ms | 1-5MB |
| 10000-100000 字符 | 50-200ms | 5-20MB |

### 总体预处理时间

| 阶段 | 时间 | 是否阻塞 |
|------|------|----------|
| 文本采样 | < 5ms | 否 |
| GPT-4o-mini 分析 | 500-1500ms | 否（异步） |
| 实体识别 | 10-200ms | 是（但很快） |
| **总计** | **510-1705ms** | **大部分异步** |

## 存储设计

### 元数据结构

```typescript
interface FileVectorIndex {
  // ... 现有字段 ...
  metadata?: {
    // GPT-4o-mini 生成
    summary: string;
    keywords: string[];
    topics: string[];
    keyPhrases: string[];
    documentType?: string;
    language?: string;
    domain?: string;
    
    // 本地实体识别
    entities?: {
      persons: string[];
      organizations: string[];
      locations: string[];
      dates: string[];
      other?: {
        emails?: string[];
        urls?: string[];
        currencies?: string[];
        percentages?: string[];
      };
    };
    
    // 未来扩展
    structure?: {
      chapters: Array<{
        title: string;
        startChunk: number;
        endChunk: number;
      }>;
    };
  };
}
```

## 实现优先级

### Phase 1: 核心功能（立即实现）
1. ✅ 文本长度判断和采样
2. ✅ GPT-4o-mini 文档分析（摘要、关键词、主题）
3. ✅ 快速实体识别（模式匹配）
4. ✅ 存储到 metadata 字段

### Phase 2: 增强功能（后续）
1. 实体识别增强（compromise.js 可选）
2. 文档结构提取
3. UI 显示元数据

### Phase 3: 高级功能（未来）
1. 关键词反向索引
2. 实体索引
3. 高级搜索功能

## 最佳实践总结

1. **速度优先**：实体识别使用纯 JavaScript 模式匹配，无需外部依赖
2. **异步处理**：GPT-4o-mini 分析异步执行，不阻塞主流程
3. **智能采样**：长文档使用采样策略，节省成本和时间
4. **降级策略**：如果 GPT-4o-mini 失败，使用简单提取方法
5. **可扩展性**：设计支持未来添加更多元数据字段

