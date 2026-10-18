import { SecurityFinding, RetrievedChunk } from '../../src/types/index.ts';
import { generateStructuredContent } from '../gemini.ts';

export interface SecurityAgentOutput {
  findings: SecurityFinding[];
  summary: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export async function runSecurityAgent(
  projectId: string,
  retrievedChunks: RetrievedChunk[]
): Promise<SecurityAgentOutput> {
  const codeSnippet = retrievedChunks
    .slice(0, 6)
    .map(c => `File: ${c.filePath} (Lines ${c.startLine}-${c.endLine}):\n\`\`\`${c.language}\n${c.content}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are Agent 4 (Security and Quality Agent) in DevPilot AI.
Audit the following code snippets for real security vulnerabilities (OWASP Top 10, CWE) and serious reliability risks:

${codeSnippet}

Check specifically for:
1. Injection flaws (SQL injection, Command injection)
2. Authentication & Authorization bypass (JWT "none" algorithm, missing RBAC checks)
3. Timing attacks on signatures/secrets (plain string comparison === instead of timing-safe equal)
4. Concurrency race conditions (Time-of-check to time-of-use TOCTOU, double spending)
5. Unhandled promise rejections / resource exhaustion / memory leaks
6. Sensitive data exposure or hardcoded secrets

CRITICAL RULES:
- Clearly distinguish between "isConfirmed: true" (irrefutable flaw in code) vs "isConfirmed: false" (potential risk or missing defensive layer).
- Assign severity: "critical", "high", "medium", or "low".
- Reference exact filePath, line numbers, evidence snippet, impact, and concrete remediation code.

Return strictly valid JSON:
{
  "summary": "Executive security assessment of audited code",
  "findings": [
    {
      "id": "sec_1",
      "projectId": "${projectId}",
      "title": "SQL Injection in User Record Query",
      "severity": "critical",
      "cwe": "CWE-89",
      "filePath": "services/database.py",
      "startLine": 28,
      "endLine": 32,
      "evidence": "query = f\\"SELECT * FROM records WHERE user_id = '{user_id}'\\"",
      "impact": "Allows attackers to extract or delete arbitrary records from database via unsanitized parameter",
      "remediation": "Use parameterized queries with db.execute(query, (user_id,)) instead of string formatting.",
      "isConfirmed": true
    }
  ]
}`;

  const fallback: SecurityAgentOutput = {
    summary: 'Automated vulnerability audit completed across retrieved source modules.',
    findings: [],
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  };

  const result = await generateStructuredContent<{ summary: string; findings: SecurityFinding[] }>(
    prompt,
    'You are a principal application security engineer. Strictly identify vulnerabilities with actionable remediation. Return valid JSON only.',
    { summary: 'Security analysis completed.', findings: [] }
  );

  const data = result.data || { summary: 'Security analysis completed.', findings: [] };
  const findings = (data.findings || []).map((f, i) => ({
    ...f,
    id: f.id || `sec_${Date.now()}_${i}`,
    projectId,
    isConfirmed: f.isConfirmed !== undefined ? f.isConfirmed : true,
  }));

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;

  return {
    summary: result.summary || 'Security review completed.',
    findings,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
  };
}
