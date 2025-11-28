# Contributing Guide

本文档描述了项目的开发工作流程、Pull Request 规范和 Merge 指南。

## 📋 目录

- [Git 工作流程](#git-工作流程)
- [分支策略](#分支策略)
- [Pull Request 规范](#pull-request-规范)
- [Commit 消息规范](#commit-消息规范)
- [Merge 规范](#merge-规范)
- [版本发布流程](#版本发布流程)
- [CHANGELOG 维护](#changelog-维护)

---

## 🔄 Git 工作流程

### 基本流程

1. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

2. **开发并提交**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

3. **推送到远程**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写详细的 PR 描述
   - 等待代码审查

5. **合并到主分支**
   - 通过审查后，使用规范的方式合并
   - 更新 CHANGELOG.md

---

## 🌿 分支策略

### 分支命名规范

- **功能分支**: `feature/feature-name`
  - 示例: `feature/rag-system`, `feature/api-keys-settings`
- **修复分支**: `fix/bug-description`
  - 示例: `fix/dialog-positioning`, `fix/rag-context-builder`
- **发布分支**: `release/v0.0.x`
  - 示例: `release/v0.0.4`, `release/v0.0.5`
- **版本标签**: `v0.0.x`
  - 示例: `v0.0.4`, `v0.0.5`

### 分支管理

- `main`: 主分支，始终保持稳定和可部署
- `0.0.x`: 版本分支，用于维护特定版本
- 功能分支: 从 `main` 或当前版本分支创建

---

## 📝 Pull Request 规范

### PR 标题格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关

**示例**:
```
feat(rag): Add document processing pipeline
fix(ui): Resolve dialog positioning issue
docs(readme): Update installation instructions
```

### PR 描述模板

创建 PR 时，使用以下模板：

```markdown
## 📋 变更概述
简要描述本次 PR 的主要变更内容。

## 🎯 相关 Issue
Closes #123
Related to #456

## ✨ 新增功能
- [ ] 功能 1
- [ ] 功能 2

## 🐛 Bug 修复
- [ ] 修复了问题 1
- [ ] 修复了问题 2

## 🔧 技术细节
详细说明实现的技术细节、架构变更等。

## 📸 截图/演示
（如适用）添加截图或演示链接

## ✅ 检查清单
- [ ] 代码已通过 lint 检查
- [ ] 已添加/更新测试
- [ ] 已更新相关文档
- [ ] 已更新 CHANGELOG.md
- [ ] 已进行自测

## 📝 测试说明
描述如何测试这些变更。
```

---

## 💬 Commit 消息规范

### 基本格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 示例

**简单提交**:
```bash
git commit -m "feat(rag): Add document processing pipeline"
```

**详细提交**:
```bash
git commit -m "feat(rag): Add document processing pipeline

- Implement PDF parsing with multiple parser support
- Add vector storage using IndexedDB
- Integrate Google Gemini Embedding API
- Add semantic chunking with configurable options

Closes #123"
```

### Commit 类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(rag): Add vector search` |
| `fix` | Bug 修复 | `fix(ui): Fix dialog positioning` |
| `docs` | 文档 | `docs(readme): Update setup guide` |
| `style` | 格式 | `style: Format code with prettier` |
| `refactor` | 重构 | `refactor(rag): Optimize chunking logic` |
| `perf` | 性能 | `perf(rag): Improve vector search speed` |
| `test` | 测试 | `test(rag): Add unit tests for chunking` |
| `chore` | 构建 | `chore: Update dependencies` |

---

## 🔀 Merge 规范

### Merge 方式

**推荐使用 "Squash and Merge"**，原因：
- 保持主分支历史清晰
- 每个 PR 对应一个 commit
- 便于回滚和追踪

### Merge 提交消息格式

当使用 "Squash and Merge" 时，GitHub 会自动生成提交消息。**请务必编辑为以下格式**：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Merge 后必须执行的操作

1. **更新 CHANGELOG.md**
   ```bash
   # 在 CHANGELOG.md 的 [Unreleased] 或新版本下添加变更
   ```

2. **更新版本号**（如需要）
   ```bash
   # 在 package.json 中更新版本号
   ```

3. **创建版本标签**（如需要）
   ```bash
   git tag v0.0.5
   git push origin v0.0.5
   ```

4. **删除已合并的分支**
   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

---

## 🚀 版本发布流程

### 1. 准备发布

```bash
# 1. 确保所有更改已合并到主分支
git checkout main
git pull origin main

# 2. 更新版本号
# 编辑 package.json，更新 version 字段

# 3. 更新 CHANGELOG.md
# 将 [Unreleased] 改为新版本号，添加发布日期
```

### 2. 创建发布提交

```bash
git add package.json CHANGELOG.md
git commit -m "chore: Release v0.0.5"
```

### 3. 创建版本标签

```bash
git tag -a v0.0.5 -m "Release v0.0.5

- Add RAG system
- Fix dialog positioning
- Improve document processing"
git push origin v0.0.5
```

### 4. 推送到远程

```bash
git push origin main
```

### 5. 创建 GitHub Release

- 在 GitHub 上创建新的 Release
- 使用标签 `v0.0.5`
- 从 CHANGELOG.md 复制发布说明

---

## 📚 CHANGELOG 维护

### 格式规范

遵循 [Keep a Changelog](https://keepachangelog.com/) 格式：

```markdown
## [版本号] - YYYY-MM-DD

### Added
- 新功能 1
- 新功能 2

### Changed
- 变更 1
- 变更 2

### Fixed
- 修复 1
- 修复 2

### Removed
- 移除的功能
```

### 维护规则

1. **每次 PR 合并后立即更新**
   - 在 `[Unreleased]` 部分添加变更
   - 或创建新版本部分

2. **版本发布时**
   - 将 `[Unreleased]` 改为版本号
   - 添加发布日期
   - 创建新的 `[Unreleased]` 部分

3. **变更分类**
   - `Added`: 新功能
   - `Changed`: 对现有功能的变更
   - `Deprecated`: 即将移除的功能
   - `Removed`: 已移除的功能
   - `Fixed`: Bug 修复
   - `Security`: 安全相关修复

### 示例

```markdown
## [Unreleased]

### Added
- API keys management in settings
- Automatic API key validation

### Fixed
- Dialog positioning issue

---

## [0.0.4] - 2024-01-15

### Added
- Complete RAG system implementation
- Document processing pipeline
- Vector storage using IndexedDB

### Changed
- Enhanced document detail dialog
- Improved settings UI

### Fixed
- RAG context passing issue
```

---

## ✅ 代码审查检查清单

### 提交前检查

- [ ] 代码通过 lint 检查 (`npm run lint`)
- [ ] 代码格式化 (`npm run prettier:fix`)
- [ ] 所有测试通过
- [ ] 已更新相关文档
- [ ] Commit 消息符合规范
- [ ] 已更新 CHANGELOG.md

### PR 审查检查

- [ ] PR 标题符合规范
- [ ] PR 描述完整清晰
- [ ] 代码逻辑正确
- [ ] 没有引入新的 bug
- [ ] 性能影响可接受
- [ ] 安全性考虑充分
- [ ] 已更新 CHANGELOG.md

---

## 🎯 最佳实践

### 1. 频繁提交

- 完成一个小功能就提交
- 保持提交的原子性（一个提交只做一件事）
- 使用有意义的提交消息

### 2. 保持分支同步

```bash
# 定期从主分支拉取最新更改
git checkout main
git pull origin main
git checkout feature/your-feature
git merge main
```

### 3. 代码审查

- 所有 PR 必须经过至少一人审查
- 审查者应该仔细检查代码质量和逻辑
- 使用 GitHub 的 review 功能提供反馈

### 4. 测试

- 新功能必须包含测试
- Bug 修复必须包含回归测试
- 确保所有测试通过后再合并

### 5. 文档

- 新功能必须更新相关文档
- API 变更必须更新 API 文档
- 重大变更必须更新 README

---

## 📞 需要帮助？

如有任何问题，请：
1. 查看本文档
2. 查看项目 README
3. 创建 Issue 询问
4. 联系项目维护者

---

**最后更新**: 2024-01-XX
**维护者**: Project Team

