/**
 * Summary Prompt 配置存储
 */

const STORAGE_KEY = 'summary-prompt-config';

const DEFAULT_PROMPT = `You are an expert document analyst. Analyze this document and generate a comprehensive, detailed, and easy-to-understand summary.

REQUIREMENTS FOR SUMMARY:
1. Write 3-5 detailed paragraphs (not just sentences)
2. First paragraph: Research background, problem statement, and motivation
   - Explain what problem this research addresses
   - Why is this problem important?
   - What gap in knowledge does it fill?
3. Second paragraph: Main methodology and approach
   - What methods, techniques, or approaches are used?
   - What are the key innovations or contributions?
   - How is the research conducted?
4. Third paragraph: Key findings and results
   - What are the main discoveries or results?
   - What evidence supports these findings?
   - What are the quantitative or qualitative outcomes?
5. Fourth paragraph (if applicable): Implications and significance
   - What are the practical or theoretical implications?
   - How does this research advance the field?
   - What are potential applications?
6. Use clear, accessible language that is easy to understand
   - Avoid excessive jargon; if technical terms are necessary, provide brief explanations
   - Write in a way that both experts and non-experts can understand
   - Use concrete examples when possible
7. Ensure the summary is comprehensive and captures the essence of the document

Return ONLY valid JSON:
{
  "title": "A concise, descriptive title for this document (5-15 words)",
  "summary": "Your detailed, multi-paragraph summary here (3-5 paragraphs, each 2-4 sentences)",
  "keywords": ["10-15 key terms that are central to the document"],
  "topics": ["3-5 main topics or themes"],
  "keyPhrases": ["5-10 important phrases or concepts"]
}`;

export function getSummaryPrompt(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_PROMPT;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.error('Failed to load summary prompt:', error);
  }

  return DEFAULT_PROMPT;
}

export function saveSummaryPrompt(prompt: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, prompt);
  } catch (error) {
    console.error('Failed to save summary prompt:', error);
  }
}

export function resetSummaryPrompt(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset summary prompt:', error);
  }
}

