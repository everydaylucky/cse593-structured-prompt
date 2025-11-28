# Structify: a Structured Prompt Experiment

Structify is a structured prompt app built on [`assistant-ui`](https://github.com/Yonom/assistant-ui) and the Vercel AI SDK. A course project for CSE593.

## Environment Setup (conda + Node)

If you don't already have node.js globally and want to use conda to manage your environments, follow the instructions below.

1. Pick and activate a conda environment (check the name first):

conda env list
conda activate <your-env-name>

2. Install Node.js (with npm) inside that environment:

conda install -c conda-forge nodejs

> Requires Node.js ≥ 18.

## Local Development

1. Change into the project directory and install dependencies (first run only).

```console
npm install
```

2. Configure your OpenAI key by creating `.env.local` in the project root. You can find an example in `.env.example`.

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

1. Start the dev server.

```console
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Features

- **Structured Prompts Panel**: A preset lives in `data/initial.json` and is loaded into the panel on startup.
- **Cinematic**: A few predefined round of conversations live in `data/cinematic.json` and can be triggered by the user.
- **RAG System**: Complete document processing pipeline with PDF parsing, vector storage, and semantic search.
- **Document Management**: Upload, process, and reference PDF documents in conversations.
- **Settings Dialog**: Comprehensive settings interface with resizable dialog support.

## Version History

### v0.0.4 (Latest)
Complete RAG (Retrieval-Augmented Generation) system implementation with document processing pipeline, vector storage using IndexedDB, semantic chunking, and enhanced settings dialog with resizable support.

### v0.0.3
Initial release with basic chat functionality, model mention support (`@model`), thread management, and Notion-style structured prompts editor.

### v0.0.2
Added notebook bookmarks feature for organizing prompt collections, conversation renaming functionality, and enhanced Notion-style editor with drag-and-drop support for better content organization.

### v0.0.1
Initial project setup with basic assistant-ui integration and structured prompts panel.
