# Merge Commit 消息模板

当使用 "Squash and Merge" 或 "Create a merge commit" 时，请使用以下格式编辑提交消息：

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

## 示例

### 新功能

```
feat(rag): Add document processing pipeline

- Implement PDF parsing with multiple parser support (PDF.js, pdf-parse, Mathpix)
- Add vector storage using IndexedDB for document chunks
- Integrate Google Gemini Embedding API for vector generation
- Add semantic chunking with configurable token-based splitting
- Implement cosine similarity-based vector search

Closes #123
```

### Bug 修复

```
fix(ui): Resolve dialog positioning issue

- Fix dialog centering with proper transform handling
- Remove conflicting positioning styles
- Ensure dialog displays correctly in viewport

Fixes #456
```

### 重构

```
refactor(rag): Optimize chunking logic

- Reduce string operations in text splitting
- Optimize separator search algorithm
- Introduce asynchronous yielding to prevent UI blocking

Related to #789
```

## 类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(rag): Add vector search` |
| `fix` | Bug 修复 | `fix(ui): Fix dialog positioning` |
| `docs` | 文档 | `docs(readme): Update setup guide` |
| `style` | 格式 | `style: Format code with prettier` |
| `refactor` | 重构 | `refactor(rag): Optimize chunking` |
| `perf` | 性能 | `perf(rag): Improve search speed` |
| `test` | 测试 | `test(rag): Add unit tests` |
| `chore` | 构建 | `chore: Update dependencies` |

## 重要提示

1. **必须更新 CHANGELOG.md**
   - 在 `[Unreleased]` 部分添加变更
   - 或创建新版本部分

2. **版本号更新**（如需要）
   - 在 `package.json` 中更新版本号
   - 创建对应的版本标签

3. **删除已合并的分支**
   ```bash
   git branch -d feature/branch-name
   git push origin --delete feature/branch-name
   ```

