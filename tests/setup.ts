/**
 * 测试环境设置
 */

// Mock IndexedDB for Node.js environment
if (typeof window === 'undefined') {
  global.indexedDB = {
    open: jest.fn(),
  } as any;
}

// Mock Web Worker
global.Worker = class Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(public scriptURL: string | URL, options?: WorkerOptions) {}

  postMessage(message: any) {
    // Mock implementation
  }

  terminate() {
    // Mock implementation
  }
} as any;

