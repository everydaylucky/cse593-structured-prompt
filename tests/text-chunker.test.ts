/**
 * 文本分块测试
 */

import { chunkText, RecursiveCharacterTextSplitter } from '../lib/text-chunker';

describe('Text Chunker', () => {
  const longText = `This is a long text that needs to be chunked. 
It contains multiple sentences and paragraphs.
We want to split it into smaller chunks with overlap.
Each chunk should be around 1000 characters.
The overlap should be about 20% of the chunk size.
This ensures that context is preserved across chunks.`;

  test('should chunk text with default options', async () => {
    const chunks = await chunkText(longText);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('text');
    expect(chunks[0]).toHaveProperty('chunkIndex');
    expect(chunks[0]).toHaveProperty('startChar');
    expect(chunks[0]).toHaveProperty('endChar');
  });

  test('should respect chunk size', async () => {
    const chunks = await chunkText(longText, {
      chunkSize: 100,
      chunkOverlap: 20,
    });
    
    chunks.forEach((chunk) => {
      expect(chunk.text.length).toBeLessThanOrEqual(150); // Allow some flexibility
    });
  });

  test('should have overlap between chunks', async () => {
    const chunks = await chunkText(longText, {
      chunkSize: 50,
      chunkOverlap: 10,
    });

    if (chunks.length > 1) {
      const firstChunkEnd = chunks[0].endChar;
      const secondChunkStart = chunks[1].startChar;
      
      // Second chunk should start before first chunk ends (overlap)
      expect(secondChunkStart).toBeLessThan(firstChunkEnd);
    }
  });

  test('should handle empty text', async () => {
    const chunks = await chunkText('');
    expect(chunks.length).toBe(0);
  });

  test('should handle text shorter than chunk size', async () => {
    const shortText = 'This is a short text.';
    const chunks = await chunkText(shortText, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(shortText);
  });

  test('should use custom separators', async () => {
    const text = 'Sentence1. Sentence2. Sentence3.';
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 20,
      chunkOverlap: 5,
      separators: ['. ', ' '],
    });
    
    const chunks = await splitter.splitText(text);
    expect(chunks.length).toBeGreaterThan(0);
  });
});

