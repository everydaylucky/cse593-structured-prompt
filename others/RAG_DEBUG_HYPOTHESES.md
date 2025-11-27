# RAG 实现问题诊断 - 5个假设

## 问题描述
客户端构建的 RAG 上下文无法传递到服务器端，服务器端始终显示 `hasClientRAGContext: false`。

## 5个假设及验证方法

### 假设1：全局 fetch 拦截器设置时机问题
**问题**：拦截器可能在请求发送后才设置，或者被多次覆盖。

**验证日志位置**：
- `app/assistant.tsx` 第 118-125 行
- 日志标记：`[Hypothesis 1]`

**关键日志**：
- `[Hypothesis 1] ========== Setting up global fetch interceptor ==========`
- `[Hypothesis 1] Current window.fetch: ...`
- `[Hypothesis 1] Timestamp: ...`
- `[Hypothesis 1] ✅ Global fetch interceptor installed`

**如何验证**：
1. 检查是否看到 "Setting up" 日志
2. 检查时间戳是否在组件挂载时立即出现
3. 检查是否有 "already set up" 警告

---

### 假设2：请求 URL 不匹配
**问题**：请求的 URL 可能不是 `/api/chat`，或者路径格式不同。

**验证日志位置**：
- `app/assistant.tsx` 第 127-135 行
- 日志标记：`[Hypothesis 2]`

**关键日志**：
- `[Hypothesis 2] ========== ALL fetch() calls ==========`
- `[Hypothesis 2] URL: ...`
- `[Hypothesis 2] URL includes /api/chat: true/false`

**如何验证**：
1. 查看所有 fetch 调用的 URL
2. 确认是否有 `/api/chat` 请求
3. 检查 URL 格式是否完全匹配

---

### 假设3：Body 格式问题
**问题**：请求 body 可能不是字符串格式，而是 FormData、Blob 或其他格式，导致无法解析。

**验证日志位置**：
- `app/assistant.tsx` 第 137-220 行
- 日志标记：`[Hypothesis 3]`

**关键日志**：
- `[Hypothesis 3] ========== /api/chat request detected ==========`
- `[Hypothesis 3] Body type: ...`
- `[Hypothesis 3] Is string: true/false`
- `[Hypothesis 3] Is FormData: true/false`
- `[Hypothesis 3] Body parsed successfully`

**如何验证**：
1. 检查 body 的实际类型
2. 确认 body 是否为字符串
3. 查看 body 内容预览
4. 检查 JSON 解析是否成功

---

### 假设4：异步竞态条件
**问题**：RAG 上下文构建是异步的，可能在构建完成前请求就已经发送。

**验证日志位置**：
- `app/assistant.tsx` 第 222-280 行
- 日志标记：`[Hypothesis 4]`

**关键日志**：
- `[Hypothesis 4] ========== Starting RAG context build ==========`
- `[Hypothesis 4] Start time: ...`
- `[Hypothesis 4] RAG build completed, duration: ... ms`
- `[Hypothesis 4] Calling original fetch at: ...`
- `[Hypothesis 4] Original fetch completed, duration: ... ms`

**如何验证**：
1. 比较 RAG 构建开始时间和 fetch 调用时间
2. 检查 RAG 构建是否在 fetch 之前完成
3. 查看构建耗时是否过长

---

### 假设5：请求被其他方式发送
**问题**：assistant-ui 或 useChat 可能使用 XMLHttpRequest 或其他方式发送请求，而不是标准的 fetch。

**验证日志位置**：
- `app/assistant.tsx` 第 282-300 行
- 日志标记：`[Hypothesis 5]`

**关键日志**：
- `[Hypothesis 5] ========== XMLHttpRequest.open() called ==========`
- `[Hypothesis 5] URL: ...`
- `[Hypothesis 5] ========== XMLHttpRequest.send() for /api/chat ==========`

**如何验证**：
1. 检查是否有 XMLHttpRequest 调用
2. 确认是否有其他发送方式
3. 查看是否有 `/api/chat` 的 XHR 请求

---

## 服务器端验证日志

**位置**：`app/api/chat/route.ts` 第 27-75 行

**关键日志**：
- `[Server] ========== POST /api/chat received ==========`
- `[Server] Raw body preview: ...`
- `[Server] Request body keys: ...`
- `[Server] ✅ Client RAG context received!` 或 `[Server] ❌ No client RAG context in request body`
- `[Server] RAG context structure: ...`

---

## 测试步骤

1. **硬刷新浏览器**（Cmd+Shift+R 或 Ctrl+Shift+R）
2. **打开浏览器控制台**（F12）
3. **发送一条包含文档引用的消息**，例如：`#attachment.pdf(file-1764269161669-z5wpkzw) tell me what this document is about`
4. **观察日志输出**：
   - 浏览器控制台：查找所有 `[Hypothesis X]` 日志
   - 服务器终端：查找 `[Server]` 日志
5. **记录关键信息**：
   - 是否看到拦截器设置日志？
   - 是否看到 fetch 调用日志？
   - body 的类型是什么？
   - RAG 构建是否完成？
   - 服务器端是否收到 ragContext？

---

## 预期结果

如果一切正常，你应该看到：
1. ✅ `[Hypothesis 1] ✅ Global fetch interceptor installed`
2. ✅ `[Hypothesis 2] URL includes /api/chat: true`
3. ✅ `[Hypothesis 3] Body is string: true` 和 `Body parsed successfully`
4. ✅ `[Hypothesis 4] ✅ RAG context added to body`
5. ✅ `[Server] ✅ Client RAG context received!`

如果某个假设的日志缺失或异常，那就是问题所在。

