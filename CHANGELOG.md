# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2024-01-XX

### Added - RAG (Retrieval-Augmented Generation) System

#### Core RAG Features
- **Document Processing Pipeline**: Complete PDF processing system with support for multiple parsers (PDF.js, pdf-parse, Mathpix)
- **Vector Storage**: IndexedDB-based vector storage system for document chunks and embeddings
- **Semantic Chunking**: Advanced text chunking with configurable token-based splitting and semantic boundary preservation
- **Embedding Generation**: Integration with Google Gemini Embedding API (`text-embedding-004`) for vector generation
- **Vector Search**: Cosine similarity-based search for retrieving relevant document chunks

#### Document Analysis & Enhancement
- **Document Metadata Extraction**: GPT-4o-mini powered analysis for:
  - Document summaries
  - Table of Contents (TOC) extraction
  - Keywords and topics extraction
  - Key phrases identification
  - Entity recognition (persons, organizations, locations, dates)
- **TOC-Chunk Matching**: Intelligent matching of table of contents entries with document chunks
- **Query Enhancement**: LLM-powered query enhancement for better retrieval results
- **Hybrid Search**: Combination of vector similarity search and keyword/grep search

#### RAG Context Building
- **Smart RAG Modes**: Three modes for document referencing:
  - `full-text`: Send entire document content
  - `rag`: Search and retrieve relevant sections only
  - `smart`: Auto-select based on document size threshold
- **Document Overview**: Automatic inclusion of document summary, TOC, keywords, and topics in RAG context
- **Client-Side RAG**: Global fetch interceptor for building RAG context on client-side before sending to server

#### UI Components
- **Document Detail Dialog**: Comprehensive document viewer with:
  - Generated document title display
  - Document metadata (summary, keywords, topics, entities)
  - Table of Contents with clickable navigation
  - Document chunks with preview and copy functionality
  - Personal notes section
  - Document renaming capability
- **Document Tree**: Hierarchical document management with folders
- **File Upload Panel**: Single-line, compact PDF upload interface with parser selection
- **Document RAG Settings**: UI for configuring RAG mode and text length thresholds
- **Settings Dialog**: Multi-page settings interface with:
  - General settings
  - RAG settings
  - Chunking settings
  - Model settings (document processing models)
  - Advanced settings
  - Resizable dialog with localStorage persistence

#### Configuration & Storage
- **Chunking Configuration**: Configurable chunk size, overlap ratio, and semantic splitting options
- **Document Processing Config**: Model selection for summary, TOC, keywords, and query enhancement
- **Summary Prompt Configuration**: Customizable system prompt for document summary generation
- **Document RAG Mode Storage**: User preferences for RAG mode and smart threshold
- **Document Notes Storage**: Per-document notes in localStorage

#### API Routes
- `/api/document-metadata`: Server-side document metadata generation using GPT-4o-mini
- `/api/query-enhancement`: Server-side query enhancement for better RAG retrieval
- `/api/embeddings`: Embedding generation endpoint using Google Gemini API

#### Technical Improvements
- **Token Counter**: Utility for estimating token count across different languages
- **Semantic Chunker**: Token-based chunking with semantic boundary preservation
- **Entity Extractor**: Fast, client-side entity recognition using regex patterns
- **Document Parser**: Enhanced document mention parsing with support for `#文件名(file-id)` format
- **Vector Storage**: Optimized IndexedDB operations with batch writes and progress tracking

### Changed
- **Message Input**: Enhanced composer with document mention support (`#document`)
- **Thread Management**: Improved thread switching and message synchronization
- **Dialog Components**: Updated DialogContent to support ref forwarding and custom sizing
- **Select Components**: Improved text wrapping and overflow handling in dropdowns

### Fixed
- **RAG Context Passing**: Fixed client-side RAG context injection via global fetch interceptor
- **Document Parsing**: Improved document mention parsing to handle both old and new formats
- **UI Spacing**: Enhanced spacing and padding in settings dialogs for better readability
- **Dialog Positioning**: Fixed dialog centering issues with proper transform handling

### Dependencies Added
- `@radix-ui/react-scroll-area`: Scroll area component for settings dialog
- `@radix-ui/react-switch`: Switch component for settings toggles
- `pdf-parse`: Server-side PDF parsing
- `pdfjs-dist`: Client-side PDF parsing
- `idb`: IndexedDB wrapper for vector storage

---

## [0.0.3] - Previous Release
- Initial release with basic chat functionality
- Model mention support
- Thread management
- Structured prompts (Notion-style)

