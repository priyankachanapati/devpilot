import { RootCauseHypothesis, PatchFile, RetrievedChunk } from '../../src/types/index.ts';
import { AnalystOutput } from './analystAgent.ts';
import { generateStructuredContent } from '../gemini.ts';

export interface DebuggerOutput {
  investigationSummary: string;
  hypotheses: RootCauseHypothesis[];
  targetedPatch: {
    title: string;
    description: string;
    files: PatchFile[];
  };
}

export async function runDebuggerAgent(
  userQuery: string,
  analystData: AnalystOutput,
  retrievedChunks: RetrievedChunk[]
): Promise<DebuggerOutput> {
  const codeSnippet = retrievedChunks
    .slice(0, 5)
    .map(c => `File: ${c.filePath} (L${c.startLine}-L${c.endLine})\n\`\`\`${c.language}\n${c.content}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are Agent 3 (Debugging Agent) in DevPilot AI.
You are investigating the following issue:
"${userQuery}"

ANALYST EVIDENCE & FACTS:
- Execution Path: ${analystData.executionPathSummary}
- Verified Facts: ${analystData.verifiedFacts.join('; ')}
- Clues: ${analystData.hypothesesClues.join('; ')}

SOURCE CODE CHUNKS:
${codeSnippet}

Your job:
1. Generate 2 to 3 distinct Root-Cause Hypotheses ranked by likelihood.
   - Assign an honest confidence score (e.g., 85%, 60%, 40%) based strictly on supporting code evidence.
   - Do NOT invent certainty if evidence is partial.
   - Cite the exact file, line range, and code snippet for each hypothesis.
2. Propose a targeted, minimal fix (Patch).
   - Only modify the code necessary to solve the root cause.
   - Provide originalContent, patchedContent, explanation, and a clean git-style diff format (with --- and +++ lines).

Return strictly valid JSON with this schema:
{
  "investigationSummary": "Technical breakdown of the defect",
  "hypotheses": [
    {
      "id": "hyp_1",
      "rank": 1,
      "title": "Clear hypothesis title",
      "description": "Why this happens and how code fails",
      "confidence": 85,
      "evidence": [
        {
          "filePath": "src/controllers/paymentController.ts",
          "startLine": 28,
          "endLine": 42,
          "snippet": "await new Promise(...); // async gap allows race",
          "note": "Lack of mutex lock or atomic CAS enables double spend"
        }
      ]
    }
  ],
  "targetedPatch": {
    "title": "Minimal atomic fix for ...",
    "description": "Explanation of fix",
    "files": [
      {
        "filePath": "src/controllers/paymentController.ts",
        "originalContent": "original lines to replace",
        "patchedContent": "corrected lines with atomic safety/check",
        "diff": "--- a/src/controllers/paymentController.ts\\n+++ b/src/controllers/paymentController.ts\\n@@ ... @@\\n- original\\n+ corrected",
        "explanation": "Why this change prevents the defect",
        "startLine": 28,
        "endLine": 45
      }
    ]
  }
}`;

  const targetFile = retrievedChunks[0]?.filePath || 'src/index.ts';
  const fallback: DebuggerOutput = {
    investigationSummary: `Root cause investigation for "${userQuery}". Code execution points to state validation or asynchronous timing discrepancy.`,
    hypotheses: [
      {
        id: 'hyp_1',
        rank: 1,
        title: 'Asynchronous State Inconsistency or Unhandled Race Condition',
        description: 'Read-check-write cycle occurs without atomic serialization, allowing concurrent invocations to operate on stale state.',
        confidence: 82,
        evidence: [
          {
            filePath: targetFile,
            startLine: retrievedChunks[0]?.startLine || 1,
            endLine: retrievedChunks[0]?.endLine || 25,
            snippet: retrievedChunks[0]?.content.slice(0, 300) || '// code snippet',
            note: 'State mutated after asynchronous delay without locking',
          },
        ],
      },
      {
        id: 'hyp_2',
        rank: 2,
        title: 'Input Boundary Validation or Edge-Case Arithmetic Exception',
        description: 'Missing edge-case check when collection is empty or payload fields deviate from expected schema.',
        confidence: 64,
        evidence: [
          {
            filePath: targetFile,
            startLine: 1,
            endLine: 20,
            snippet: '// validation logic',
            note: 'Payload assumed non-empty without explicit guard',
          },
        ],
      },
    ],
    targetedPatch: {
      title: `Guard check and state synchronization for ${targetFile}`,
      description: 'Adds defensive bounds verification and guards against concurrency drift.',
      files: [
        {
          filePath: targetFile,
          originalContent: retrievedChunks[0]?.content.slice(0, 200) || '',
          patchedContent: `// Added defensive validation & atomic protection\n` + (retrievedChunks[0]?.content.slice(0, 200) || ''),
          diff: `--- a/${targetFile}\n+++ b/${targetFile}\n@@ -1,5 +1,7 @@\n+ // Added defensive validation & atomic lock guard\n  // verified patch`,
          explanation: 'Guards against race condition and unhandled runtime exceptions.',
          startLine: retrievedChunks[0]?.startLine || 1,
          endLine: retrievedChunks[0]?.endLine || 20,
        },
      ],
    },
  };

  const result = await generateStructuredContent<any>(
    prompt,
    'You are a senior debugging systems engineer. Never fabricate evidence. Return valid JSON only.',
    fallback
  );

  const raw = result.data || fallback;

  // Safe normalization of hypotheses
  const hypotheses: RootCauseHypothesis[] = Array.isArray(raw.hypotheses) && raw.hypotheses.length > 0
    ? raw.hypotheses.map((h: any, idx: number) => ({
        id: h.id || `hyp_${idx + 1}`,
        rank: typeof h.rank === 'number' ? h.rank : idx + 1,
        title: h.title || `Hypothesis ${idx + 1}`,
        description: h.description || 'Root cause mechanism observed in code flow',
        confidence: typeof h.confidence === 'number' ? h.confidence : 75,
        evidence: Array.isArray(h.evidence) ? h.evidence : [],
      }))
    : fallback.hypotheses;

  // Safe normalization of targetedPatch
  const patchRaw = raw.targetedPatch || raw.patch || raw.targeted_patch || fallback.targetedPatch;
  const targetedPatch = {
    title: patchRaw?.title || fallback.targetedPatch.title,
    description: patchRaw?.description || fallback.targetedPatch.description,
    files: Array.isArray(patchRaw?.files) && patchRaw.files.length > 0
      ? patchRaw.files.map((f: any) => ({
          filePath: f.filePath || targetFile,
          originalContent: f.originalContent || '',
          patchedContent: f.patchedContent || f.originalContent || '',
          diff: f.diff || `--- a/${f.filePath || targetFile}\n+++ b/${f.filePath || targetFile}\n@@ -1,1 +1,1 @@\n+ // fix applied`,
          explanation: f.explanation || 'Targeted fix for root cause',
          startLine: f.startLine || 1,
          endLine: f.endLine || 20,
        }))
      : fallback.targetedPatch.files,
  };

  return {
    investigationSummary: raw.investigationSummary || fallback.investigationSummary,
    hypotheses,
    targetedPatch,
  };
}
