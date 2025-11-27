# GitHub 分支保护规则建议

## 一、Main 分支保护规则（推荐）

### 1. **基本保护设置**

#### ✅ **Require a pull request before merging**
- **Required number of approvals**: `1`（至少 1 个审查）
- **Dismiss stale pull request approvals when new commits are pushed**: ✅ 启用
- **Require review from Code Owners**: ⚠️ 可选（如果有 CODEOWNERS 文件）

**理由**：
- 确保代码经过审查
- 防止直接推送到 main
- 保持代码质量

---

#### ✅ **Require status checks to pass before merging**
- **Require branches to be up to date before merging**: ✅ 启用
- **Status checks that are required**:
  - `build`（如果有 CI/CD）
  - `lint`（如果有 linting 检查）
  - `test`（如果有测试）

**理由**：
- 确保代码通过所有检查
- 防止合并有问题的代码

---

#### ✅ **Require conversation resolution before merging**
- ✅ 启用

**理由**：
- 确保 PR 中的所有评论和问题都已解决
- 保持代码审查的完整性

---

#### ✅ **Require signed commits**
- ⚠️ 可选（如果团队需要）

**理由**：
- 提高安全性
- 验证提交者身份

---

### 2. **限制设置**

#### ✅ **Restrict who can push to matching branches**
- ✅ 启用
- **Allowed to push**: 只允许仓库管理员或特定团队

**理由**：
- 防止意外推送
- 强制使用 PR 流程

---

#### ✅ **Do not allow bypassing the above settings**
- ✅ 启用（即使是管理员也不能绕过）

**理由**：
- 确保规则对所有人一致
- 防止绕过保护

---

#### ✅ **Allow force pushes**
- ❌ **禁用**

**理由**：
- 防止历史被重写
- 保护代码历史完整性

---

#### ✅ **Allow deletions**
- ❌ **禁用**

**理由**：
- 防止分支被意外删除
- 保护重要分支

---

### 3. **其他设置**

#### ✅ **Require linear history**
- ⚠️ 可选（如果希望保持线性历史）

**理由**：
- 保持 Git 历史清晰
- 更容易追踪更改

---

#### ✅ **Include administrators**
- ✅ 启用（管理员也需要遵守规则）

**理由**：
- 确保规则对所有人一致
- 防止绕过保护

---

## 二、Marschou 分支保护规则（可选）

如果 `marschou` 是开发分支，可以设置较宽松的规则：

### 建议设置：
- ❌ **不启用 Require a pull request**（允许直接推送）
- ✅ **启用 Allow force pushes**（允许 rebase）
- ✅ **启用 Allow deletions**（允许删除）
- ⚠️ **可选：Require status checks**（如果有 CI/CD）

**理由**：
- 开发分支需要更灵活
- 允许快速迭代和实验

---

## 三、完整配置示例

### Main 分支配置：

```
✅ Require a pull request before merging
   - Required approvals: 1
   - Dismiss stale approvals: ✅
   
✅ Require status checks to pass before merging
   - Require branches to be up to date: ✅
   - Required status checks: build, lint
   
✅ Require conversation resolution before merging: ✅

❌ Require signed commits: ❌（可选）

✅ Restrict who can push to matching branches: ✅
   - Only allow specific people/teams

✅ Do not allow bypassing the above settings: ✅

❌ Allow force pushes: ❌

❌ Allow deletions: ❌

⚠️ Require linear history: ⚠️（可选）

✅ Include administrators: ✅
```

---

## 四、实施步骤

### 1. 设置 Main 分支保护

1. 访问：https://github.com/everydaylucky/cse593-structured-prompt/settings/rules/new?target=branch
2. **Branch name pattern**: 输入 `main`
3. 按照上述配置启用/禁用各项设置
4. 点击 **Create** 保存

### 2. 设置 Marschou 分支保护（可选）

1. 创建新规则
2. **Branch name pattern**: 输入 `marschou`
3. 使用较宽松的设置（如上所述）

### 3. 设置通配符规则（可选）

如果需要保护所有分支：
- **Branch name pattern**: 输入 `*`
- 使用与 main 相同的规则

---

## 五、最佳实践建议

### 1. **最小权限原则**
- 只给必要的人推送权限
- 使用团队管理权限

### 2. **代码审查**
- 至少需要 1 个审查
- 重要更改需要 2 个审查

### 3. **状态检查**
- 设置 CI/CD 自动检查
- 确保所有检查通过才能合并

### 4. **分支策略**
- `main`: 生产环境，严格保护
- `marschou`: 开发分支，较宽松
- `feature/*`: 功能分支，最宽松

---

## 六、注意事项

1. **首次设置**：
   - 设置后，即使是管理员也不能直接推送到 main
   - 必须通过 PR 流程

2. **紧急修复**：
   - 如果有紧急情况，可以临时禁用规则
   - 但应该尽快恢复

3. **团队协作**：
   - 确保团队成员了解规则
   - 提供 PR 流程文档

4. **CI/CD 集成**：
   - 如果有 CI/CD，确保状态检查正确配置
   - 测试状态检查是否正常工作

---

## 七、推荐配置总结

### Main 分支（严格）：
- ✅ Require PR (1 approval)
- ✅ Require status checks
- ✅ Require conversation resolution
- ✅ Restrict pushes
- ✅ No bypass
- ❌ No force push
- ❌ No deletion
- ✅ Include administrators

### Marschou 分支（宽松）：
- ❌ No PR requirement（或 0 approvals）
- ⚠️ Optional status checks
- ✅ Allow force push
- ✅ Allow deletion

---

## 八、相关资源

- [GitHub Branch Protection Rules 文档](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub CODEOWNERS 文件](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

