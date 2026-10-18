import { Project } from '../../src/types/index.ts';
import { generateStructuredContent } from '../gemini.ts';

export interface PlannerOutput {
  understanding: string;
  missingInformationWarning?: string;
  steps: string[];
  requiredAgents: ('Repository Analyst' | 'Debugging Agent' | 'Security & Quality' | 'Testing & Verification' | 'Review Agent')[];
  searchQueries: string[];
  targetFileHints: string[];
}

export async function runPlannerAgent(
  userQuery: string,
  project: Project
): Promise<PlannerOutput> {
  const prompt = `You are Agent 1 (Planner Agent) in DevPilot AI, an autonomous multi-agent repository intelligence system.
Analyze the following user query for project "${project.name}" (Languages: ${Object.keys(project.languages).join(', ')}).

User Query:
"${userQuery}"

Your job:
1. Deconstruct the user's intent (bug investigation, security audit, architecture query, or refactor).
2. Check if the error or question has enough details. If vague, note what specific info would help.
3. Formulate a 4-6 step execution plan.
4. Determine which specialized agents must be mobilized.
5. Generate 3-5 precise semantic code search queries and file path hints to retrieve from the RAG vector store.

Respond strictly with a JSON object in this format:
{
  "understanding": "Clear summary of user goal and technical challenge",
  "missingInformationWarning": "Note if any crucial stack trace or parameter is missing (or null if sufficient)",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."],
  "requiredAgents": ["Repository Analyst", "Debugging Agent", "Security & Quality", "Testing & Verification", "Review Agent"],
  "searchQueries": ["semantic search phrase 1", "keyword symbol 2", "relevant route or function 3"],
  "targetFileHints": ["path/to/likely/file1.ts", "path/to/likely/file2.py"]
}`;

  const fallback: PlannerOutput = {
    understanding: `Investigate request regarding: ${userQuery}`,
    steps: [
      'Perform semantic search across indexed repository files',
      'Trace call flow and identify state mutation boundaries',
      'Formulate root-cause hypotheses with confidence scores',
      'Audit code for security and concurrency vulnerabilities',
      'Synthesize verification tests and review patch',
    ],
    requiredAgents: [
      'Repository Analyst',
      'Debugging Agent',
      'Security & Quality',
      'Testing & Verification',
      'Review Agent',
    ],
    searchQueries: [userQuery, 'error handler', 'validation', 'transaction'],
    targetFileHints: [],
  };

  const result = await generateStructuredContent<PlannerOutput>(
    prompt,
    'You are an expert software architect and investigation planner. Return only valid JSON.',
    fallback
  );

  return result.data || fallback;
}
