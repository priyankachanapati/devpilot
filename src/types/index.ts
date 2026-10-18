export interface Project {
  id: string;
  name: string;
  description: string;
  sourceType: 'sample' | 'github' | 'zip' | 'manual';
  sourceUrl?: string;
  createdAt: string;
  fileCount: number;
  totalLines: number;
  languages: Record<string, number>;
  indexingStatus: 'unindexed' | 'indexing' | 'indexed' | 'failed';
  indexingProgress?: {
    stage: string;
    current: number;
    total: number;
    percent: number;
  };
  indexedAt?: string;
  chunkCount?: number;
  ragDiagnostics?: {
    filesDiscovered: number;
    filesParsed: number;
    chunksCreated: number;
    chunksEmbedded: number;
    vectorsStored: number;
    embeddingErrors: string[];
    vectorDimensions: number;
    lastRetrievalDurationMs?: number;
    lastRetrievalCount?: number;
    lastError?: string;
  };
}

export interface RepoFile {
  path: string;
  name: string;
  size: number;
  language: string;
  content: string;
  lineCount: number;
}

export interface CodeChunk {
  id: string;
  projectId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  symbolType?: 'function' | 'class' | 'interface' | 'route' | 'config' | 'block' | 'module';
  content: string;
  language: string;
  embedding?: number[];
}

export interface RetrievedChunk extends CodeChunk {
  similarity: number;
  lexicalScore?: number;
  combinedScore: number;
  matchedKeywords?: string[];
}

export interface AgentTask {
  id: string;
  agentName: 'Planner' | 'Repository Analyst' | 'Debugging Agent' | 'Security & Quality' | 'Testing & Verification' | 'Review Agent';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount?: number;
  error?: string;
  summary: string;
  output?: any;
}

export interface RootCauseHypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  evidence: {
    filePath: string;
    startLine: number;
    endLine: number;
    snippet: string;
    note: string;
  }[];
  rank: number;
}

export interface PatchFile {
  filePath: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
  explanation: string;
  startLine?: number;
  endLine?: number;
}

export interface ProposedPatch {
  id: string;
  sessionId: string;
  projectId: string;
  title: string;
  description: string;
  files: PatchFile[];
  status: 'draft' | 'approved' | 'rejected' | 'revised';
  userFeedback?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface SecurityFinding {
  id: string;
  projectId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cwe?: string;
  filePath: string;
  startLine: number;
  endLine: number;
  evidence: string;
  impact: string;
  remediation: string;
  isConfirmed: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  targetFile: string;
  testCode: string;
  framework: 'jest' | 'mocha' | 'pytest' | 'custom';
  executionStatus: 'executed_passed' | 'executed_failed' | 'proposed_unexecuted';
  executionOutput?: string;
  durationMs?: number;
}

export interface ChatCitation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  relevanceScore?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: ChatCitation[];
  facts?: string[];
  hypotheses?: string[];
  missingEvidence?: string[];
}

export interface WorkflowSession {
  id: string;
  projectId: string;
  type: 'chat' | 'debug' | 'security';
  title: string;
  userPrompt: string;
  createdAt: string;
  status: 'active' | 'completed' | 'failed';
  currentStage?: string;
  failureReason?: string;
  completedAt?: string;
  plan?: {
    steps: string[];
    requiredAgents: string[];
    focusFiles: string[];
  };
  agents: AgentTask[];
  hypotheses?: RootCauseHypothesis[];
  patch?: ProposedPatch;
  tests?: TestCase[];
  reviewReport?: {
    verdict: 'verified' | 'needs_attention' | 'unverified';
    summary: string;
    limitations: string[];
    unsupportedClaimsChecked: string[];
    recommendations: string[];
  };
  chatMessages?: ChatMessage[];
}

export interface RAGDiagnosticResult {
  query: string;
  projectId: string;
  durationMs: number;
  totalChunksInStore: number;
  results: RetrievedChunk[];
  diagnostics: {
    filesDiscovered: number;
    filesParsed: number;
    chunksCreated: number;
    chunksEmbedded: number;
    vectorsStored: number;
    embeddingErrors: string[];
    vectorDimensions: number;
  };
  error?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  projectId: string;
  details: string;
  userEmail?: string;
}
