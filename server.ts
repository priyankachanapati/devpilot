import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { storage } from './server/storage.ts';
import { vectorStore } from './server/vectorStore.ts';
import { orchestrator } from './server/agents/orchestrator.ts';
import { askCodeAssistant } from './server/chatAssistant.ts';
import { SAMPLE_REPOSITORIES } from './server/sampleRepos.ts';
import { runSecurityAgent } from './server/agents/securityAgent.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON with generous limit for file imports
app.use(express.json({ limit: '60mb' }));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Sample Repositories List
app.get('/api/samples', (req: Request, res: Response) => {
  res.json(
    SAMPLE_REPOSITORIES.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      language: s.language,
      languages: s.languages,
      knownIssues: s.knownIssues,
      fileCount: s.files.length,
    }))
  );
});

// Projects API
app.get('/api/projects', (req: Request, res: Response) => {
  res.json(storage.listProjects());
});

app.post('/api/projects', async (req: Request, res: Response) => {
  try {
    const { sourceType, name, description, githubUrl, zipBase64, sampleId } = req.body;

    if (sourceType === 'sample') {
      const sample = SAMPLE_REPOSITORIES.find(s => s.id === sampleId);
      if (!sample) {
        return res.status(404).json({ error: 'Sample repository not found' });
      }
      const existing = storage.getProject(sample.id);
      return res.json(existing);
    }

    if (sourceType === 'github') {
      if (!githubUrl) {
        return res.status(400).json({ error: 'githubUrl is required' });
      }
      const project = await storage.createProjectFromGitHub(githubUrl, name);
      return res.status(201).json(project);
    }

    if (sourceType === 'zip') {
      if (!zipBase64) {
        return res.status(400).json({ error: 'zipBase64 data is required' });
      }
      const buffer = Buffer.from(zipBase64, 'base64');
      const project = await storage.createProjectFromZip(name || 'Uploaded Repository', description || '', buffer);
      return res.status(201).json(project);
    }

    res.status(400).json({ error: 'Invalid sourceType. Must be "sample", "github", or "zip".' });
  } catch (err: any) {
    console.error('[Create Project Error]', err);
    res.status(500).json({ error: err.message || 'Failed to create project' });
  }
});

app.get('/api/projects/:id', (req: Request, res: Response) => {
  const project = storage.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
  const project = storage.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  storage.deleteProject(req.params.id);
  res.json({ success: true, message: 'Project deleted' });
});

// Files API
app.get('/api/projects/:id/files', (req: Request, res: Response) => {
  const files = storage.getFiles(req.params.id);
  res.json(
    files.map(f => ({
      path: f.path,
      name: f.name,
      size: f.size,
      language: f.language,
      lineCount: f.lineCount,
    }))
  );
});

app.get('/api/projects/:id/files/content', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path query parameter is required' });
  const file = storage.getFile(req.params.id, filePath);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json(file);
});

// RAG Indexing API
app.post('/api/projects/:id/index', async (req: Request, res: Response) => {
  try {
    const project = await storage.startIndexing(req.params.id);
    res.json({ success: true, project });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Indexing failed' });
  }
});

// Search API
app.post('/api/projects/:id/search', async (req: Request, res: Response) => {
  try {
    const { query, topK, filePathFilter, languageFilter } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const chunksCount = vectorStore.getChunks(req.params.id).length;
    const results = await vectorStore.search(req.params.id, query, {
      topK: topK || 6,
      filePathFilter,
      languageFilter,
    });
    res.json({
      results,
      totalChunksInStore: chunksCount,
      query,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// RAG Diagnostics Test Endpoint
app.post('/api/projects/:id/diagnostics/test', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query string is required' });
    const diagnostic = await vectorStore.diagnose(req.params.id, query);
    res.json(diagnostic);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Diagnostic failed' });
  }
});

// Project RAG Diagnostics Info
app.get('/api/projects/:id/diagnostics', (req: Request, res: Response) => {
  const project = storage.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const chunks = vectorStore.getChunks(req.params.id);
  const files = storage.getFiles(req.params.id);
  const errors = vectorStore.getErrors(req.params.id);

  res.json({
    projectId: project.id,
    projectName: project.name,
    indexingStatus: project.indexingStatus,
    filesDiscovered: files.length,
    filesParsed: files.length,
    chunksCreated: chunks.length,
    chunksEmbedded: chunks.filter(c => c.embedding && c.embedding.length > 0).length,
    vectorsStored: chunks.length,
    vectorDimensions: 768,
    embeddingErrors: errors,
    ragDiagnostics: project.ragDiagnostics || null,
  });
});

// AI Code Assistant Chat
app.post('/api/projects/:id/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const response = await askCodeAssistant(req.params.id, message, history || []);
    storage.logAudit(req.params.id, 'AI Chat Query', `Asked: "${message.slice(0, 50)}"`);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chat query failed' });
  }
});

// Agentic Debugger Workflows
app.post('/api/workflows/start', async (req: Request, res: Response) => {
  try {
    const { projectId, prompt, type } = req.body;
    if (!projectId || !prompt) {
      return res.status(400).json({ error: 'projectId and prompt are required' });
    }

    // 1. Initialize session synchronously so sessionId is generated and saved immediately
    const session = orchestrator.initWorkflowSession(projectId, prompt, type || 'debug');

    // 2. Return sessionId immediately to client
    res.json({
      status: 'started',
      sessionId: session.id,
      session,
    });

    // 3. Run multi-agent graph in background
    orchestrator.runWorkflow(projectId, prompt, type || 'debug', session).catch(err => {
      console.error(`[Background Workflow ${session.id} Error]`, err);
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start agent workflow' });
  }
});

// SSE Stream for Live Workflow Updates
app.get('/api/sessions/:id/stream', (req: Request, res: Response) => {
  const sessionId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (event: any) => {
    if (event.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === 'workflow_complete' || event.type === 'workflow_error') {
        res.end();
      }
    }
  };

  orchestrator.on('event', listener);

  req.on('close', () => {
    orchestrator.off('event', listener);
  });
});

// Session Details
app.get('/api/sessions/:id', (req: Request, res: Response) => {
  const session = storage.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.get('/api/projects/:id/sessions', (req: Request, res: Response) => {
  res.json(storage.listSessions(req.params.id));
});

// Security Review API
app.get('/api/projects/:id/findings', (req: Request, res: Response) => {
  res.json(storage.getFindings(req.params.id));
});

app.post('/api/projects/:id/findings/scan', async (req: Request, res: Response) => {
  try {
    const chunks = vectorStore.getChunks(req.params.id);
    const mockRetrieved = chunks.slice(0, 10).map(c => ({
      ...c,
      similarity: 1.0,
      combinedScore: 1.0,
    }));
    const result = await runSecurityAgent(req.params.id, mockRetrieved);

    storage.setFindings(req.params.id, result.findings);
    storage.logAudit(req.params.id, 'Security Audit', `Completed scan: ${result.findings.length} findings`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Security scan failed' });
  }
});

// Patches API
app.get('/api/projects/:id/patches', (req: Request, res: Response) => {
  res.json(storage.getPatches(req.params.id));
});

app.get('/api/patches/:id', (req: Request, res: Response) => {
  const patch = storage.getPatch(req.params.id);
  if (!patch) return res.status(404).json({ error: 'Patch not found' });
  res.json(patch);
});

// Approve / Reject / Revise Patch
app.post('/api/patches/:id/review', (req: Request, res: Response) => {
  const { decision, feedback } = req.body; // decision: 'approved' | 'rejected' | 'revised'
  const patch = storage.getPatch(req.params.id);
  if (!patch) return res.status(404).json({ error: 'Patch not found' });

  if (!['approved', 'rejected', 'revised'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision. Must be approved, rejected, or revised.' });
  }

  patch.status = decision;
  patch.reviewedAt = new Date().toISOString();
  patch.userFeedback = feedback || undefined;
  storage.savePatch(patch);

  storage.logAudit(
    patch.projectId,
    `Patch ${decision.toUpperCase()}`,
    `Patch "${patch.title}" was ${decision} by reviewer. Feedback: ${feedback || 'None'}`
  );

  res.json({ success: true, patch });
});

// Download patch as unified diff
app.get('/api/patches/:id/download', (req: Request, res: Response) => {
  const patch = storage.getPatch(req.params.id);
  if (!patch) return res.status(404).send('Patch not found');

  const diffContent = patch.files
    .map(f => `# File: ${f.filePath}\n# ${f.explanation}\n${f.diff}`)
    .join('\n\n');

  res.setHeader('Content-Type', 'text/x-diff');
  res.setHeader('Content-Disposition', `attachment; filename="devpilot_patch_${patch.id}.diff"`);
  res.send(diffContent);
});

// Audit Logs
app.get('/api/audit', (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  res.json(storage.getAuditLogs(projectId));
});

// Vite Middleware for Fullstack React SPA
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[DevPilot AI] Server active on port ${PORT}`);
  });
}

startServer();
