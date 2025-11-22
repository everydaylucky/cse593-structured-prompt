# CSE593 Structured Prompt App

基于 [`assistant-ui`](https://github.com/Yonom/assistant-ui) 和 Vercel AI SDK 的结构化 Prompt 实验项目。

## 环境准备（conda + Node）

1. 选择并激活一个 conda 环境（先看名字再激活）：

conda env list
conda activate <你的环境名>

2. 在该环境里安装 Node.js（自带 npm）：

conda install -c conda-forge nodejs

> 要求 Node.js ≥ 18。

## 本地开发

1. 进入项目目录（下面是我的电脑里的路径）：

cd "/Users/Shared/baiduyun/00 Code/Projects/CSE593/my-app copy"

2. 安装依赖（第一次运行需要）：

npm install

3. 配置 OpenAI Key，在项目根目录创建 `.env.local`：

OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

4. 启动开发服务器：

npm run dev

然后在浏览器访问 `http://localhost:3000`。

## 功能说明

- 预置对话历史：从 `data/initial-history.json` 加载，应用启动时直接显示在主对话 `Thread` 中。
- Prompt Cards 侧边栏：默认卡片和文案定义在  
  `components/prompt-sidebar/prompt-sidebar.tsx` 的 `prompts` 初始数组中，你可以直接修改这里来调整侧边栏的预设内容。