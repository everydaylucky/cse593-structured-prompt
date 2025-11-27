# 线程历史记录功能实现说明

## 问题分析

### 原始错误
```
External store adapter does not support switching to new thread
```

### 错误原因
1. `useAISDKRuntime` 默认使用 ExternalStore 适配器
2. ExternalStore 适配器不支持线程列表管理功能
3. 需要手动实现 `ThreadListAdapter` 来支持线程管理

## 解决方案

### 1. 线程存储层 (`lib/thread-storage.ts`)
- 使用 `localStorage` 持久化线程数据
- 自动处理存储空间不足的情况（删除最旧的线程）
- 提供线程 CRUD 操作

### 2. ThreadListAdapter (`lib/thread-list-adapter.ts`)
- 实现完整的线程管理接口
- 支持初始化、创建、切换、更新、删除线程
- 完善的错误处理，避免崩溃

### 3. 自动保存机制
- 消息变化时自动保存（500ms 防抖）
- 自动提取线程标题
- 错误时静默处理，不影响用户体验

### 4. 健壮性保障

#### 错误处理策略
1. **存储错误**：捕获并记录，不中断用户操作
2. **适配器初始化失败**：返回空列表，允许继续使用
3. **线程切换失败**：降级到刷新页面
4. **存储空间不足**：自动清理旧线程

#### 防御性编程
- 所有 localStorage 操作都有 try-catch
- 检查运行时环境（`typeof window !== "undefined"`）
- 验证数据完整性
- 提供降级方案

## 使用方式

### 创建新对话
- 点击 "New Chat" 按钮
- 自动创建新线程并切换

### 切换对话
- 在侧边栏点击对话项
- 自动加载对应消息

### 自动保存
- 消息发送后自动保存
- 标题自动从第一条消息提取

## 可能的问题和解决方案

### 1. 存储空间不足
**问题**：localStorage 有 5-10MB 限制
**解决**：自动删除最旧的线程，只保留最近 50 个

### 2. 数据损坏
**问题**：JSON 解析失败
**解决**：捕获错误，返回空列表，允许重新开始

### 3. 线程切换失败
**问题**：适配器未正确初始化
**解决**：降级到页面刷新，确保功能可用

### 4. 消息同步问题
**问题**：切换线程时消息未加载
**解决**：通过 runtime 同步，必要时刷新页面

## 数据结构

```typescript
interface ThreadData {
  id: string;              // 线程 ID
  title: string;           // 线程标题
  messages: any[];         // 消息列表
  createdAt: number;       // 创建时间
  updatedAt: number;       // 更新时间
  modelId?: string;        // 使用的模型（可选）
}
```

## 存储键名

- `structify-threads`: 线程列表
- `structify-current-thread-id`: 当前线程 ID

## 注意事项

1. 所有操作都在客户端执行（检查 `typeof window`）
2. 使用防抖避免频繁写入
3. 错误时静默处理，不中断用户体验
4. 提供降级方案确保基本功能可用

