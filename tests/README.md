# 测试文档

## 测试结构

本目录包含 Mathpix RAG 系统的完整测试套件。

### 单元测试

- **text-chunker.test.ts**: 测试文本分块功能
  - 测试默认选项
  - 测试自定义 chunk size 和 overlap
  - 测试边界情况（空文本、短文本等）

- **vector-storage.test.ts**: 测试向量存储功能
  - 测试 IndexedDB 操作
  - 测试 chunk 和 file 的 CRUD 操作
  - 测试按 thread 和 file 查询

- **vector-search.test.ts**: 测试向量搜索功能
  - 测试余弦相似度计算
  - 测试相似块搜索
  - 测试最小分数过滤

- **pdf-processor.test.ts**: 测试 PDF 处理功能
  - 测试 Mathpix 响应解析
  - 测试不同响应格式的处理

### 集成测试

- **integration.test.ts**: 测试完整的 PDF RAG 流程
  - 测试端到端处理流程
  - 测试进度报告
  - 测试错误处理

## 运行测试

### 安装测试依赖

```bash
npm install --save-dev jest @types/jest ts-jest
```

### 配置 Jest

创建 `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test text-chunker.test.ts

# 运行测试并查看覆盖率
npm test -- --coverage
```

## 测试注意事项

1. **IndexedDB Mock**: 由于 IndexedDB 在 Node.js 环境中不可用，测试中使用了 mock 实现。

2. **Web Worker Mock**: Web Worker 在测试环境中需要特殊处理，可能需要使用 `jest-worker` 或类似工具。

3. **异步测试**: 所有测试都是异步的，确保使用 `async/await` 或返回 Promise。

4. **环境变量**: 某些测试可能需要设置环境变量（如 Mathpix API keys），使用 `.env.test` 文件。

## 持续集成

建议在 CI/CD 流程中运行测试：

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

