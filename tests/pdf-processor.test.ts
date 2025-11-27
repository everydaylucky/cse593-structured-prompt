/**
 * PDF 处理器测试
 */

import { extractTextFromMathpixResponse } from '../lib/pdf-processor';

describe('PDF Processor', () => {
  test('should extract text from Mathpix response with text field', () => {
    const response = {
      text: 'This is extracted text from PDF',
      request_id: 'req-123',
    };

    const text = extractTextFromMathpixResponse(response);
    expect(text).toBe('This is extracted text from PDF');
  });

  test('should extract text from Mathpix response with data field', () => {
    const response = {
      data: [
        { value: 'First paragraph' },
        { value: 'Second paragraph' },
        { text: 'Third paragraph' },
      ],
      request_id: 'req-123',
    };

    const text = extractTextFromMathpixResponse(response);
    expect(text).toContain('First paragraph');
    expect(text).toContain('Second paragraph');
    expect(text).toContain('Third paragraph');
  });

  test('should extract text from Mathpix response with pages field', () => {
    const response = {
      pages: [
        { text: 'Page 1 content' },
        {
          data: [
            { value: 'Page 2 paragraph 1' },
            { value: 'Page 2 paragraph 2' },
          ],
        },
      ],
      request_id: 'req-123',
    };

    const text = extractTextFromMathpixResponse(response);
    expect(text).toContain('Page 1 content');
    expect(text).toContain('Page 2 paragraph 1');
    expect(text).toContain('Page 2 paragraph 2');
  });

  test('should handle empty response', () => {
    const response = {};
    const text = extractTextFromMathpixResponse(response);
    expect(text).toBe('');
  });

  test('should handle response with no text fields', () => {
    const response = {
      request_id: 'req-123',
      page_count: 5,
    };
    const text = extractTextFromMathpixResponse(response);
    expect(text).toBe('');
  });

  test('should filter empty strings from data array', () => {
    const response = {
      data: [
        { value: 'Valid text' },
        { value: '' },
        { value: 'Another valid text' },
      ],
    };

    const text = extractTextFromMathpixResponse(response);
    expect(text).toBe('Valid text\nAnother valid text');
  });
});

