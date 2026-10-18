import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import {
  Project,
  RepoFile,
  WorkflowSession,
  SecurityFinding,
  ProposedPatch,
  AuditLog,
} from '../src/types/index.ts';
import { SAMPLE_REPOSITORIES } from './sampleRepos.ts';
import { chunkFile, detectLanguage } from './chunker.ts';
import { vectorStore } from './vectorStore.ts';
import { getEmbedding, getEmbeddingWithDetails, VECTOR_DIMENSIONS } from './gemini.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'devpilot_store.json');

// Ensure data folder
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoreSchema {
  projects: Record<string, Project>;
  files: Record<string, RepoFile[]>;
  sessions: Record<string, WorkflowSession>;
  findings: Record<string, SecurityFinding[]>;
  patches: Record<string, ProposedPatch[]>;
  auditLogs: AuditLog[];
}

export class StorageManager {
  private data: StoreSchema = {
    projects: {},
    files: {},
    sessions: {},
    findings: {},
    patches: {},
    auditLogs: [],
  };

  constructor() {
    this.loadFromDisk();
    this.bootstrapSampleProjects();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          projects: parsed.projects || {},
          files: parsed.files || {},
          sessions: parsed.sessions || {},
          findings: parsed.findings || {},
          patches: parsed.patches || {},
          auditLogs: parsed.auditLogs || [],
        };
      }
    } catch (err) {
      console.error('[StorageManager Load Error]', err);
    }
  }

  public saveToDisk() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[StorageManager Save Error]', err);
    }
  }

  private bootstrapSampleProjects() {
    for (const sample of SAMPLE_REPOSITORIES) {
      if (!this.data.projects[sample.id]) {
        let totalLines = 0;
        sample.files.forEach(f => (totalLines += f.lineCount));

        const project: Project = {
          id: sample.id,
          name: sample.name,
          description: sample.description,
          sourceType: 'sample',
          createdAt: new Date().toISOString(),
          fileCount: sample.files.length,
          totalLines,
          languages: sample.languages,
          indexingStatus: 'unindexed',
        };

        this.data.projects[sample.id] = project;
        this.data.files[sample.id] = sample.files;
        this.logAudit(sample.id, 'Project Registered', `Loaded sample repository "${sample.name}"`);
      }
    }
    this.saveToDisk();
  }

  public listProjects(): Project[] {
    return Object.values(this.data.projects);
  }

  public getProject(id: string): Project | undefined {
    return this.data.projects[id];
  }

  public getFiles(projectId: string): RepoFile[] {
    return this.data.files[projectId] || [];
  }

  public getFile(projectId: string, filePath: string): RepoFile | undefined {
    const files = this.getFiles(projectId);
    return files.find(f => f.path === filePath);
  }

  public logAudit(projectId: string, action: string, details: string) {
    const log: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      action,
      projectId,
      details,
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 300) {
      this.data.auditLogs.pop();
    }
    this.saveToDisk();
  }

  public getAuditLogs(projectId?: string): AuditLog[] {
    if (!projectId) return this.data.auditLogs;
    return this.data.auditLogs.filter(l => l.projectId === projectId);
  }

  /**
   * Safe file path verification against ZipSlip and Path Traversal
   */
  public sanitizePath(rawPath: string): string {
    const normalized = path.normalize(rawPath).replace(/^(\.\.(\/|\\|$))+/, '');
    // Remove leading slashes
    return normalized.replace(/^[/\\]+/, '');
  }

  /**
   * Create custom project or upload ZIP
   */
  public async createProjectFromZip(
    name: string,
    description: string,
    zipBuffer: Buffer
  ): Promise<Project> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const files: RepoFile[] = [];
    const languageCounts: Record<string, number> = {};
    let totalLines = 0;

    // Binary file extensions to exclude
    const binaryExts = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'pdf', 'zip', 'tar', 'gz', 'bin', 'exe',
      'dll', 'so', 'dylib', 'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'wav'
    ]);

    // Ignored paths
    const ignoredDirs = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', '__pycache__/', '.venv/'];

    for (const [filename, fileEntry] of Object.entries(zip.files)) {
      if (fileEntry.dir) continue;

      const safePath = this.sanitizePath(filename);
      if (ignoredDirs.some(dir => safePath.includes(dir))) continue;

      const ext = safePath.split('.').pop()?.toLowerCase() || '';
      if (binaryExts.has(ext)) continue;

      try {
        const content = await fileEntry.async('string');
        // File size check: skip files over 250KB
        if (content.length > 250_000) continue;

        const lines = content.split('\n');
        const lang = detectLanguage(safePath);
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        totalLines += lines.length;

        files.push({
          path: safePath,
          name: path.basename(safePath),
          size: content.length,
          language: lang,
          content,
          lineCount: lines.length,
        });
      } catch (err) {
        // Skip unreadable files
      }
    }

    if (files.length === 0) {
      throw new Error('No valid source code files found in the uploaded archive.');
    }

    // Calculate language percentages
    const totalCount = files.length;
    const languages: Record<string, number> = {};
    for (const [lang, count] of Object.entries(languageCounts)) {
      languages[lang] = Math.round((count / totalCount) * 100);
    }

    const project: Project = {
      id: projectId,
      name,
      description: description || 'Uploaded source repository',
      sourceType: 'zip',
      createdAt: new Date().toISOString(),
      fileCount: files.length,
      totalLines,
      languages,
      indexingStatus: 'unindexed',
    };

    this.data.projects[projectId] = project;
    this.data.files[projectId] = files;
    this.logAudit(projectId, 'Archive Imported', `Imported ${files.length} files from uploaded ZIP`);
    this.saveToDisk();

    return project;
  }

  /**
   * Import repository from GitHub public URL
   */
  public async createProjectFromGitHub(
    repoUrl: string,
    name?: string
  ): Promise<Project> {
    const urlClean = repoUrl.trim().replace(/\/+$/, '');
    const match = urlClean.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL. Must be in format https://github.com/owner/repo');
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const projectName = name || `${owner}/${repo}`;
    const projectId = `gh_${owner}_${repo}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_');

    // Fetch repository tree using GitHub REST API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    let res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'DevPilot-AI-Engine',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      // Fallback try 'master' branch
      const masterUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
      res = await fetch(masterUrl, {
        headers: {
          'User-Agent': 'DevPilot-AI-Engine',
          Accept: 'application/vnd.github.v3+json',
        },
      });
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch GitHub repository tree: ${res.statusText}. Please verify the repository is public.`);
    }

    const treeData = await res.json();
    const tree = treeData.tree || [];

    // Filter relevant code files
    const supportedExts = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'json', 'md', 'html', 'css', 'yaml', 'yml', 'sql', 'sh']);
    const ignoredDirs = ['node_modules/', '.git/', 'dist/', 'build/', 'vendor/'];

    const targetNodes = tree.filter((node: any) => {
      if (node.type !== 'blob') return false;
      if (ignoredDirs.some(dir => node.path.includes(dir))) return false;
      const ext = node.path.split('.').pop()?.toLowerCase() || '';
      return supportedExts.has(ext);
    }).slice(0, 35); // Safe initial cap for rapid indexing

    if (targetNodes.length === 0) {
      throw new Error('No matching source code files found in default branch.');
    }

    const files: RepoFile[] = [];
    const languageCounts: Record<string, number> = {};
    let totalLines = 0;

    for (const node of targetNodes) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${node.path}`;
        const rawRes = await fetch(rawUrl);
        if (rawRes.ok) {
          const content = await rawRes.text();
          if (content.length <= 150_000) {
            const lines = content.split('\n');
            const lang = detectLanguage(node.path);
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
            totalLines += lines.length;

            files.push({
              path: node.path,
              name: path.basename(node.path),
              size: content.length,
              language: lang,
              content,
              lineCount: lines.length,
            });
          }
        }
      } catch (err) {
        // Skip individual file fetch failures
      }
    }

    const totalCount = files.length;
    const languages: Record<string, number> = {};
    for (const [lang, count] of Object.entries(languageCounts)) {
      languages[lang] = Math.round((count / totalCount) * 100);
    }

    const project: Project = {
      id: projectId,
      name: projectName,
      description: `Imported from ${repoUrl}`,
      sourceType: 'github',
      sourceUrl: repoUrl,
      createdAt: new Date().toISOString(),
      fileCount: files.length,
      totalLines,
      languages,
      indexingStatus: 'unindexed',
    };

    this.data.projects[projectId] = project;
    this.data.files[projectId] = files;
    this.logAudit(projectId, 'GitHub Import', `Cloned ${files.length} files from ${repoUrl}`);
    this.saveToDisk();

    return project;
  }

  /**
   * Run Genuine RAG Indexing Pipeline:
   * 1. Chunking
   * 2. Embedding calculation
   * 3. Vector store indexing
   */
  public async startIndexing(
    projectId: string,
    onProgress?: (progress: Project['indexingProgress']) => void
  ): Promise<Project> {
    const project = this.data.projects[projectId];
    if (!project) throw new Error('Project not found');

    const files = this.getFiles(projectId);
    project.indexingStatus = 'indexing';
    this.saveToDisk();

    const updateProgress = (stage: string, current: number, total: number) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      project.indexingProgress = { stage, current, total, percent };
      this.saveToDisk();
      if (onProgress) onProgress(project.indexingProgress);
    };

    try {
      updateProgress('Parsing and Chunking files...', 0, files.length);

      // Phase 1: Chunk files
      const allChunks = [];
      let processedFiles = 0;
      for (const file of files) {
        const fileChunks = chunkFile(projectId, file.path, file.content);
        allChunks.push(...fileChunks);
        processedFiles++;
        updateProgress('Parsing and Chunking files...', processedFiles, files.length);
      }

      // Phase 2: Compute Embeddings
      const totalChunks = allChunks.length;
      updateProgress('Generating Vector Embeddings...', 0, totalChunks);

      const embeddingErrors: string[] = [];
      let embeddedCount = 0;

      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        // Prepare context string for embedding
        const textForEmbedding = `File: ${chunk.filePath}\nSymbol: ${chunk.symbolName || ''}\nType: ${chunk.symbolType}\n\n${chunk.content}`;
        const embRes = await getEmbeddingWithDetails(textForEmbedding);
        chunk.embedding = embRes.values;
        if (!embRes.isFallback) embeddedCount++;
        if (embRes.error) {
          embeddingErrors.push(`[${chunk.filePath}] ${embRes.error}`);
        }

        // Pacing to avoid hitting 429 burst rate limits
        if (i < allChunks.length - 1) {
          await new Promise(r => setTimeout(r, 35));
        }

        if (i % 2 === 0 || i === allChunks.length - 1) {
          updateProgress('Generating Vector Embeddings...', i + 1, totalChunks);
        }
      }

      // Phase 3: Store in Vector DB
      updateProgress('Building Vector Index & Lexical Inverted Index...', totalChunks, totalChunks);
      vectorStore.setChunks(projectId, allChunks, embeddingErrors);

      project.indexingStatus = 'indexed';
      project.indexedAt = new Date().toISOString();
      project.chunkCount = allChunks.length;
      project.ragDiagnostics = {
        filesDiscovered: files.length,
        filesParsed: processedFiles,
        chunksCreated: allChunks.length,
        chunksEmbedded: embeddedCount,
        vectorsStored: allChunks.length,
        embeddingErrors: embeddingErrors.slice(0, 10),
        vectorDimensions: VECTOR_DIMENSIONS,
      };
      delete project.indexingProgress;

      this.logAudit(
        projectId,
        'Indexing Completed',
        `Indexed ${allChunks.length} chunks across ${files.length} files (${embeddedCount} embedded with Gemini, dimensions: ${VECTOR_DIMENSIONS})`
      );
      this.saveToDisk();

      return project;
    } catch (err: any) {
      project.indexingStatus = 'failed';
      if (!project.ragDiagnostics) {
        project.ragDiagnostics = {
          filesDiscovered: files.length,
          filesParsed: 0,
          chunksCreated: 0,
          chunksEmbedded: 0,
          vectorsStored: 0,
          embeddingErrors: [err?.message || 'Indexing failed'],
          vectorDimensions: VECTOR_DIMENSIONS,
          lastError: err?.message || 'Indexing failed',
        };
      } else {
        project.ragDiagnostics.lastError = err?.message || 'Indexing failed';
      }
      this.saveToDisk();
      throw err;
    }
  }

  // Sessions
  public createSession(session: WorkflowSession) {
    this.data.sessions[session.id] = session;
    this.saveToDisk();
  }

  public getSession(id: string): WorkflowSession | undefined {
    return this.data.sessions[id];
  }

  public updateSession(session: WorkflowSession) {
    this.data.sessions[session.id] = session;
    this.saveToDisk();
  }

  public listSessions(projectId?: string): WorkflowSession[] {
    const all = Object.values(this.data.sessions);
    // Sort newest first
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!projectId) return all;
    return all.filter(s => s.projectId === projectId);
  }

  // Findings
  public setFindings(projectId: string, findings: SecurityFinding[]) {
    this.data.findings[projectId] = findings;
    this.saveToDisk();
  }

  public getFindings(projectId: string): SecurityFinding[] {
    return this.data.findings[projectId] || [];
  }

  // Patches
  public savePatch(patch: ProposedPatch) {
    if (!this.data.patches[patch.projectId]) {
      this.data.patches[patch.projectId] = [];
    }
    const list = this.data.patches[patch.projectId];
    const index = list.findIndex(p => p.id === patch.id);
    if (index >= 0) {
      list[index] = patch;
    } else {
      list.unshift(patch);
    }
    this.saveToDisk();
  }

  public getPatches(projectId: string): ProposedPatch[] {
    return this.data.patches[projectId] || [];
  }

  public getPatch(patchId: string): ProposedPatch | undefined {
    for (const list of Object.values(this.data.patches)) {
      const found = list.find(p => p.id === patchId);
      if (found) return found;
    }
    return undefined;
  }

  public deleteProject(projectId: string) {
    delete this.data.projects[projectId];
    delete this.data.files[projectId];
    delete this.data.findings[projectId];
    delete this.data.patches[projectId];
    vectorStore.deleteProject(projectId);
    this.saveToDisk();
  }
}

export const storage = new StorageManager();
