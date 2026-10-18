# DevPilot AI — Agentic Repository Intelligence Platform

DevPilot AI is a production-minded web platform combining Large Language Models (Gemini API via `@google/genai`), Retrieval-Augmented Generation (RAG), and a 6-agent orchestration pipeline to index software repositories, map execution flows, investigate root-cause defects, and generate verifiable patches with sandboxed test execution.

---

## Architecture Overview

```
                                      +--------------------+
                                      |   User Request     |
                                      +---------+----------+
                                                |
                                                v
                                      +--------------------+
                                      |   Planner Agent    |
                                      +---------+----------+
                                                |
                       +------------------------+------------------------+
                       |                                                 |
                       v                                                 v
        +----------------------------+                    +----------------------------+
        |   Semantic Vector RAG      |                    |    Repository Analyst      |
        |   (Gemini + Lexical BM25)  |                    |    (Execution & Imports)   |
        +--------------+-------------+                    +--------------+-------------+
                       |                                                 |
                       +------------------------+------------------------+
                                                |
                                                v
                                      +--------------------+
                                      |  Debugging Agent   |
                                      |  (Ranked Causes)   |
                                      +---------+----------+
                                                |
                       +------------------------+------------------------+
                       |                                                 |
                       v                                                 v
        +----------------------------+                    +----------------------------+
        |  Security & Quality Agent  |                    |   Testing & Verification   |
        |  (OWASP / CWE Audit)       |                    |   (Sandboxed Test Runner)  |
        +--------------+-------------+                    +--------------+-------------+
                       |                                                 |
                       +------------------------+------------------------+
                                                |
                                                v
                                      +--------------------+
                                      |    Review Agent    |
                                      |  (Adversarial Gate)|
                                      +---------+----------+
                                                |
                                                v
                                      +--------------------+
                                      | Human Approval &   |
                                      | Patch Review Diff  |
                                      +--------------------+
```

---

## 1. Multi-Agent System

DevPilot AI implements 6 specialized agents with structured inputs and outputs:

1. **Planner Agent (`server/agents/plannerAgent.ts`)**:
   - Deconstructs user intent, generates 4-6 step investigation plan.
   - Identifies required agents and formulates targeted semantic search queries and file hints.

2. **Repository Analyst (`server/agents/analystAgent.ts`)**:
   - Analyzes code chunks retrieved via hybrid RAG.
   - Maps module imports, call graph hierarchy, state mutations, and verified code facts.

3. **Debugging Agent (`server/agents/debuggerAgent.ts`)**:
   - Formulates 2-3 ranked root-cause hypotheses with confidence ratings (0-100%).
   - Generates minimal targeted code patch with readable git diff.

4. **Security & Quality Agent (`server/agents/securityAgent.ts`)**:
   - Audits relevant files for OWASP Top 10 / CWE vulnerabilities (injection, auth bypass, race condition, timing attacks).
   - Distinguishes confirmed flaws from potential architectural risks.

5. **Testing & Verification Agent (`server/agents/testerAgent.ts`)**:
   - Generates regression unit test cases (Jest / Mocha / PyTest).
   - Executes tests inside a sandboxed in-memory runner and logs real command output.

6. **Review Agent (`server/agents/reviewAgent.ts`)**:
   - Conducts adversarial audit: checks for contract regressions, contradictions, or unsupported assumptions.
   - Emits executive verification verdict: `verified`, `needs_attention`, or `unverified`.

---

## 2. Genuine RAG Pipeline

- **Ingestion**:
  - Ingests public Git repos via GitHub REST API, uploaded source `.zip` archives, or 3 built-in sample microservices.
  - Defense against ZipSlip path traversal and malicious file extraction.
  - Excludes binary assets, node_modules, `.git/`, and oversized files.
- **Language-Aware Chunking (`server/chunker.ts`)**:
  - Splits source code using symbol boundaries (functions, classes, interfaces, routes, decorators) preserving file path, start line, and end line.
- **Embeddings & Vector Store (`server/vectorStore.ts`)**:
  - Generates embeddings via `@google/genai` with deterministic token-hash fallback vector.
  - Implements genuine hybrid retrieval: combines vector cosine similarity (65% weight) with lexical keyword/symbol BM25 match (35% weight).
- **Grounded Generation**:
  - Every answer cites exact file paths, line ranges, and verified code facts.

---

## 3. Human Gate & Patch Review

- Proposed patches are never automatically committed or pushed to origin repositories.
- Split and unified diff viewer displays exact additions and deletions.
- Reviewer can **Approve**, **Reject**, or **Revise with Feedback**.
- Exportable as standalone `.diff` patch file.
- All actions are logged to the persistent audit trail.

---

## 4. Running the Application & Automated Tests

### Development Server
```bash
npm run dev
```

### Run Automated Tests
```bash
npm run test
```
The automated test suite verifies:
- Multi-language AST detection
- Code chunking preserving line numbers and symbol headers
- Cosine vector similarity & unit normalization
- Hybrid semantic + lexical retrieval ranking
- StorageManager ZipSlip directory traversal defense

### Production Build
```bash
npm run build
npm start
```
