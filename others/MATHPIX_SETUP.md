# Mathpix API 配置指南

## 问题：Mathpix API credentials not configured

你的 `.env` 文件中缺少 Mathpix API 配置。

---

## 快速解决

### 步骤 1：打开 `.env` 文件

在项目根目录找到 `.env` 文件：
```
/Users/Shared/baiduyun/00 Code/Projects/CSE593/structify/.env
```

### 步骤 2：添加 Mathpix 配置

在 `.env` 文件中添加以下两行：

```bash
MATHPIX_APP_ID=your_app_id_here
MATHPIX_API_KEY=your_app_key_here
```

**完整示例**（你的 `.env` 文件应该类似这样）：

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Mathpix API 配置
MATHPIX_APP_ID=your_app_id_here
MATHPIX_API_KEY=your_app_key_here
```

### 步骤 3：获取 Mathpix API 密钥

1. **访问 Mathpix Console**
   - 打开 https://console.mathpix.com
   - 如果没有账户，先注册

2. **获取 API 凭证**
   - 登录后进入组织页面（Organization page）
   - 找到 **App ID** 和 **App Key**
   - 复制这两个值

3. **添加到 `.env` 文件**
   - 将 `your_app_id_here` 替换为实际的 App ID
   - 将 `your_app_key_here` 替换为实际的 App Key

### 步骤 4：重启开发服务器

```bash
# 停止当前服务器（按 Ctrl+C）
# 然后重新启动
npm run dev
```

---

## 验证配置

### 方法 1：检查环境变量

重启服务器后，在浏览器控制台查看。如果配置正确，上传文件时应该能看到处理进度。

### 方法 2：测试上传

1. 上传一个小 PDF 文件
2. 如果配置正确，应该能看到处理进度
3. 如果还是报错，检查：
   - 变量名是否正确（区分大小写）
   - 值是否正确（没有多余空格）
   - 是否重启了服务器

---

## 常见问题

### Q: 我没有 Mathpix 账户怎么办？

A: 
1. 访问 https://console.mathpix.com 注册
2. 免费账户有额度限制
3. 可以先用免费额度测试

### Q: 如何找到 App ID 和 App Key？

A:
1. 登录 https://console.mathpix.com
2. 进入组织页面（Organization Settings）
3. 在 "API Keys" 或 "Credentials" 部分找到
4. 如果找不到，查看 Mathpix 文档：https://docs.mathpix.com/#authorization

### Q: 重启服务器后还是不行？

A: 检查：
- ✅ 文件路径：`.env` 在项目根目录
- ✅ 变量名：`MATHPIX_APP_ID` 和 `MATHPIX_API_KEY`（区分大小写）
- ✅ 值格式：没有引号，没有多余空格
- ✅ 服务器重启：确保完全重启了开发服务器

### Q: 可以使用 `.env.local` 吗？

A: 可以！Next.js 支持 `.env.local`，它会覆盖 `.env` 文件。建议使用 `.env.local` 来存储敏感信息。

---

## 临时解决方案（测试用）

如果你想先测试其他功能（不处理 PDF），可以：

1. 暂时跳过 PDF 处理
2. 或者使用降级方案（pdfjs-dist）

但建议还是配置 Mathpix API，因为它能提供更好的 PDF 解析质量。

---

## 参考链接

- [Mathpix Console](https://console.mathpix.com)
- [Mathpix API 文档](https://docs.mathpix.com/#introduction)
- [Next.js 环境变量](https://nextjs.org/docs/basic-features/environment-variables)

