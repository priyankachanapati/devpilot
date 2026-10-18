import { ChatMessage, ChatCitation } from '../src/types/index.ts';
import { vectorStore } from './vectorStore.ts';
import { generateStructuredContent } from './gemini.ts';

export interface ChatResponsePayload {
  message: string;
  citations: ChatCitation[];
  facts: string[];
  hypotheses: string[];
  missingEvidence: string[];
  suggestedFollowUps: string[];
}

export async function askCodeAssistant(
  projectId: string,
  userQuestion: string,
  history: ChatMessage[] = []
): Promise<ChatResponsePayload> {
  // 1. Genuine Hybrid RAG Retrieval
  const retrievedChunks = await vectorStore.search(projectId, userQuestion, {
    topK: 6,
    minScore: 0.15,
  });

  const contextText = retrievedChunks
    .map(
      (c, i) =>
        `[SNIPPET ${i + 1}] File: ${c.filePath} (Lines ${c.startLine}-${c.endLine})\nSymbol: ${c.symbolName || 'N/A'}\n\`\`\`${c.language}\n${c.content}\n\`\`\``
    )
    .join('\n\n');

  const historyText = history
    .slice(-4)
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const prompt = `You are DevPilot AI Assistant, a precision repository intelligence and software engineering expert.
Answer the user's question about this repository using STRICTLY grounded context retrieved via RAG.

USER QUESTION:
"${userQuestion}"

CONVERSATION HISTORY:
${historyText || 'None'}

RETRIEVED CODE CONTEXT:
${contextText || 'No matching code snippets retrieved.'}

CRITICAL RULES:
1. Ground your answers strictly in the retrieved code.
2. Cite the exact file paths and line numbers whenever referencing behavior.
3. Clearly separate:
   - Verified facts proven by the code
   - Hypotheses or logical inferences
   - Missing evidence: state honestly if the codebase does not have enough information to answer definitively.
4. Suggest 2-3 logical follow-up questions relevant to the code found.

Respond in this JSON format:
{
  "message": "Comprehensive, well-formatted Markdown explanation referencing the cited files and functions",
  "citations": [
    {
      "filePath": "src/controllers/paymentController.ts",
      "startLine": 20,
      "endLine": 35,
      "snippet": "code snippet",
      "relevanceScore": 0.95
    }
  ],
  "facts": ["Fact 1", "Fact 2"],
  "hypotheses": ["Hypothesis 1"],
  "missingEvidence": ["Missing configuration or files"],
  "suggestedFollowUps": ["Follow-up question 1?", "Follow-up question 2?"]
}`;

  const citations: ChatCitation[] = retrievedChunks.slice(0, 4).map(c => ({
    filePath: c.filePath,
    startLine: c.startLine,
    endLine: c.endLine,
    snippet: c.content.split('\n').slice(0, 12).join('\n'),
    relevanceScore: Math.round(c.combinedScore * 100) / 100,
  }));

  const fallback: ChatResponsePayload = {
    message: retrievedChunks.length === 0
      ? `No matching code snippets retrieved from the RAG vector store for "${userQuestion}".\n\n**Diagnostic Note:** The vector store for this repository currently contains 0 matching code chunks. If this repository was just imported or selected, please run **Index Codebase** in the top navigation bar to compute AST vector embeddings.`
      : `Based on repository analysis across ${retrievedChunks.length} relevant files:\n\n` +
        retrievedChunks.map(c => `- **${c.filePath}** (L${c.startLine}-${c.endLine}): Contains relevant logic for ${c.symbolName || 'module'}`).join('\n') +
        `\n\nThe retrieved code shows the implementation details above. For specific control flow or edge cases, you can ask a targeted follow-up or dispatch an investigation session.`,
    citations,
    facts: retrievedChunks.map(c => `Module defined in ${c.filePath}`),
    hypotheses: ['Behavior depends on runtime environment configuration.'],
    missingEvidence: retrievedChunks.length === 0 ? ['Codebase AST chunks not found in vector index'] : ['Integration test logs or database credentials'],
    suggestedFollowUps: [
      'Where are errors handled in this flow?',
      'Are there any concurrency or security issues here?',
      'How are parameters validated before processing?',
    ],
  };

  const result = await generateStructuredContent<ChatResponsePayload>(
    prompt,
    'You are DevPilot AI Assistant. Answer questions about codebases with grounded precision and exact citations. Return valid JSON only.',
    fallback
  );

  const data = result.data || fallback;

  return {
    message: data.message || fallback.message,
    citations: data.citations && data.citations.length > 0 ? data.citations : citations,
    facts: data.facts || fallback.facts,
    hypotheses: data.hypotheses || fallback.hypotheses,
    missingEvidence: data.missingEvidence || fallback.missingEvidence,
    suggestedFollowUps: data.suggestedFollowUps || fallback.suggestedFollowUps,
  };
}
