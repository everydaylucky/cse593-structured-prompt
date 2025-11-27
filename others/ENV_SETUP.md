# 环境变量配置指南

## 问题：Mathpix API credentials not configured

如果遇到此错误，说明环境变量未正确配置。

---

## 解决步骤

### 1. 创建 `.env.local` 文件

在项目根目录（`/Users/Shared/baiduyun/00 Code/Projects/CSE593/structify/`）创建 `.env.local` 文件：

```bash
cd "/Users/Shared/baiduyun/00 Code/Projects/CSE593/structify"
touch .env.local
```

### 2. 添加 Mathpix API 凭证

在 `.env.local` 文件中添加：

```bash
MATHPIX_APP_ID=your_app_id_here
MATHPIX_API_KEY=your_app_key_here
```

### 3. 获取 Mathpix API 密钥

1. 访问 https://console.mathpix.com
2. 注册/登录账户
3. 进入组织页面（Organization page）
4. 找到 **App ID** 和 **App Key**
5. 复制到 `.env.local` 文件中

### 4. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

---

## 验证配置

### 方法 1：检查环境变量

在 API 路由中添加临时日志：

```typescript
console.log('Mathpix Config:', {
  hasAppId: !!process.env.MATHPIX_APP_ID,
  hasAppKey: !!process.env.MATHPIX_API_KEY,
});
```

### 方法 2：测试上传

1. 上传一个小的 PDF 文件
2. 查看浏览器控制台和服务器日志
3. 如果配置正确，应该能看到处理进度

---

## 常见问题

### Q: 为什么使用 `.env.local`？

A: Next.js 会自动加载 `.env.local` 文件，并且它会被 `.gitignore` 忽略，不会提交到 Git。

### Q: 环境变量名称是什么？

A: 
- `MATHPIX_APP_ID` - Mathpix 应用 ID
- `MATHPIX_API_KEY` - Mathpix API 密钥

### Q: 重启服务器后还是不行？

A: 检查：
1. 文件是否在项目根目录
2. 文件名是否为 `.env.local`（注意前面的点）
3. 变量名是否正确（区分大小写）
4. 值是否正确（没有多余的空格）

### Q: 如何检查环境变量是否加载？

A: 在 API 路由中添加：

```typescript
console.log('Environment check:', {
  MATHPIX_APP_ID: process.env.MATHPIX_APP_ID ? 'Set' : 'Missing',
  MATHPIX_API_KEY: process.env.MATHPIX_API_KEY ? 'Set' : 'Missing',
});
```

---

## 示例 `.env.local` 文件

```bash
# Mathpix API 配置
MATHPIX_APP_ID=abc123def456
MATHPIX_API_KEY=xyz789uvw012

# 其他 API 配置（可选）
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
```

---

## 安全提示

⚠️ **重要**：
- 不要将 `.env.local` 提交到 Git
- 不要分享你的 API 密钥
- 如果密钥泄露，立即在 Mathpix Console 中重新生成

---

## 参考

- [Next.js 环境变量文档](https://nextjs.org/docs/basic-features/environment-variables)
- [Mathpix API 文档](https://docs.mathpix.com/#introduction)
- [获取 Mathpix API 密钥](https://console.mathpix.com)

