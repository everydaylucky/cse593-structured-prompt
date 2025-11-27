/**
 * PDF 解析器注册表
 * 支持多种 PDF 解析方案
 */

export interface PDFParserConfig {
  id: string;
  name: string;
  description: string;
  provider: 'mathpix' | 'pdfjs' | 'pdf-parse' | 'browser-native';
  free: boolean;
  requiresApiKey: boolean;
  apiKeyEnv?: string;
  quality: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
  supportsMath: boolean;
  supportsTables: boolean;
  supportsImages: boolean;
}

export const PDF_PARSER_REGISTRY: PDFParserConfig[] = [
  {
    id: 'mathpix',
    name: 'Mathpix OCR',
    description: 'Professional STEM document parsing with math formula support',
    provider: 'mathpix',
    free: false,
    requiresApiKey: true,
    apiKeyEnv: 'MATHPIX_API_KEY',
    quality: 'high',
    speed: 'medium',
    supportsMath: true,
    supportsTables: true,
    supportsImages: true,
  },
  {
    id: 'pdfjs-browser',
    name: 'PDF.js (Browser)',
    description: 'Free browser-based PDF parsing (Mozilla PDF.js)',
    provider: 'pdfjs',
    free: true,
    requiresApiKey: false,
    quality: 'medium',
    speed: 'fast',
    supportsMath: false,
    supportsTables: false,
    supportsImages: false,
  },
  {
    id: 'pdf-parse-server',
    name: 'PDF Parse (Server)',
    description: 'Free server-side PDF text extraction',
    provider: 'pdf-parse',
    free: true,
    requiresApiKey: false,
    quality: 'medium',
    speed: 'fast',
    supportsMath: false,
    supportsTables: false,
    supportsImages: false,
  },
];

/**
 * 获取可用的解析器（根据配置和 API key）
 */
export function getAvailableParsers(): PDFParserConfig[] {
  return PDF_PARSER_REGISTRY.filter((parser) => {
    if (parser.requiresApiKey && parser.apiKeyEnv) {
      // 检查环境变量
      if (typeof window === 'undefined') {
        // 服务器端
        return !!process.env[parser.apiKeyEnv];
      }
      // 客户端无法检查，返回 true（由服务器端验证）
      return true;
    }
    return true;
  });
}

/**
 * 获取免费解析器
 */
export function getFreeParsers(): PDFParserConfig[] {
  return PDF_PARSER_REGISTRY.filter((p) => p.free);
}

/**
 * 根据 ID 获取解析器配置
 */
export function getParserConfig(id: string): PDFParserConfig | null {
  return PDF_PARSER_REGISTRY.find((p) => p.id === id) || null;
}

/**
 * 获取默认解析器（优先免费，如果有 API key 则使用 Mathpix）
 */
export function getDefaultParser(): PDFParserConfig {
  // 检查是否有 Mathpix API key
  if (typeof window === 'undefined') {
    if (process.env.MATHPIX_APP_ID && process.env.MATHPIX_API_KEY) {
      return PDF_PARSER_REGISTRY.find((p) => p.id === 'mathpix')!;
    }
  }
  
  // 默认使用 PDF.js（浏览器端，免费）
  return PDF_PARSER_REGISTRY.find((p) => p.id === 'pdfjs-browser')!;
}

