import fs from 'fs';
import path from 'path';
import { CodeChunk, RetrievedChunk, RAGDiagnosticResult } from '../src/types/index.ts';
import { cosineSimilarity, getEmbeddingWithDetails, VECTOR_DIMENSIONS } from './gemini.ts';

const VECTORS_DIR = path.resolve(process.cwd(), 'data', 'vectors');

// Ensure directory exists
if (!fs.existsSync(VECTORS_DIR)) {
  fs.mkdirSync(VECTORS_DIR, { recursive: true });
}

export class VectorStore {
  private chunks: Map<string, CodeChunk[]> = new Map();
  private lastErrors: Map<string, string[]> = new Map();

  constructor() {
    this.loadAllFromDisk();
  }

  private getFilePath(projectId: string): string {
    return path.join(VECTORS_DIR, `${projectId}.json`);
  }

  public loadAllFromDisk() {
    try {
      if (fs.existsSync(VECTORS_DIR)) {
        const files = fs.readdirSync(VECTORS_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const projectId = file.replace('.json', '');
            const raw = fs.readFileSync(path.join(VECTORS_DIR, file), 'utf-8');
            const data: CodeChunk[] = JSON.parse(raw);
            this.chunks.set(projectId, data);
          }
        }
      }
    } catch (err) {
      console.error('[VectorStore Disk Load Error]', err);
    }
  }

  public saveToDisk(projectId: string) {
    try {
      const data = this.chunks.get(projectId) || [];
      fs.writeFileSync(this.getFilePath(projectId), JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[VectorStore Disk Save Error for ${projectId}]`, err);
    }
  }

  public setChunks(projectId: string, chunks: CodeChunk[], errors: string[] = []) {
    this.chunks.set(projectId, chunks);
    if (errors.length > 0) {
      this.lastErrors.set(projectId, errors);
    }
    this.saveToDisk(projectId);
  }

  public getChunks(projectId: string): CodeChunk[] {
    let list = this.chunks.get(projectId);
    if (!list || list.length === 0) {
      // Try reloading from disk in case of fresh process
      const fp = this.getFilePath(projectId);
      if (fs.existsSync(fp)) {
        try {
          const raw = fs.readFileSync(fp, 'utf-8');
          list = JSON.parse(raw);
          if (list) this.chunks.set(projectId, list);
        } catch (e) {
          // Ignore
        }
      }
    }
    return list || [];
  }

  public getErrors(projectId: string): string[] {
    return this.lastErrors.get(projectId) || [];
  }

  public deleteProject(projectId: string) {
    this.chunks.delete(projectId);
    this.lastErrors.delete(projectId);
    const fp = this.getFilePath(projectId);
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch (err) {
        console.error(`[VectorStore delete error]`, err);
      }
    }
  }

  /**
   * Genuine Hybrid Retrieval: Semantic Vector Search + Lexical Code Matching
   */
  public async search(
    projectId: string,
    query: string,
    options: {
      topK?: number;
      filePathFilter?: string;
      languageFilter?: string;
      minScore?: number;
    } = {}
  ): Promise<RetrievedChunk[]> {
    const { topK = 6, filePathFilter, languageFilter, minScore = 0.05 } = options;
    const projectChunks = this.getChunks(projectId);

    if (projectChunks.length === 0) {
      return [];
    }

    // 1. Compute query vector embedding
    const queryEmbResult = await getEmbeddingWithDetails(query);
    const queryEmbedding = queryEmbResult.values;

    if (queryEmbResult.error) {
      const errList = this.lastErrors.get(projectId) || [];
      errList.push(`Query Embedding Warning: ${queryEmbResult.error}`);
      this.lastErrors.set(projectId, errList.slice(-10));
    }

    // 2. Tokenize query for lexical scoring
    const queryTerms = query
      .toLowerCase()
      .split(/[^a-zA-Z0-9_$]+/g)
      .filter(t => t.length > 1);

    const scored: RetrievedChunk[] = [];

    for (const chunk of projectChunks) {
      // Apply filters if provided
      if (filePathFilter && !chunk.filePath.toLowerCase().includes(filePathFilter.toLowerCase())) {
        continue;
      }
      if (languageFilter && chunk.language.toLowerCase() !== languageFilter.toLowerCase()) {
        continue;
      }

      // Semantic Cosine Similarity
      let semanticScore = 0;
      if (chunk.embedding && chunk.embedding.length > 0) {
        semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
      }

      // Lexical BM25-style keyword matching
      const contentLower = chunk.content.toLowerCase();
      const pathLower = chunk.filePath.toLowerCase();
      const symbolLower = (chunk.symbolName || '').toLowerCase();

      let matchedTerms: string[] = [];
      let lexicalScore = 0;

      for (const term of queryTerms) {
        let termMatches = 0;
        if (symbolLower.includes(term)) {
          termMatches += 3.0; // Higher weight for exact symbol match
          matchedTerms.push(`symbol:${term}`);
        }
        if (pathLower.includes(term)) {
          termMatches += 2.0; // Weight for matching file path
          matchedTerms.push(`path:${term}`);
        }
        const count = (contentLower.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        if (count > 0) {
          termMatches += Math.min(count * 0.5, 2.5);
          matchedTerms.push(term);
        }
        lexicalScore += termMatches;
      }

      // Normalize lexical score to [0, 1] range
      const normalizedLexical = queryTerms.length > 0
        ? Math.min(lexicalScore / (queryTerms.length * 3.5), 1.0)
        : 0;

      // Hybrid combination: 65% semantic embedding, 35% lexical keyword/symbol
      const combinedScore = (semanticScore * 0.65) + (normalizedLexical * 0.35);

      if (combinedScore >= minScore || normalizedLexical > 0.1 || semanticScore > 0.15) {
        scored.push({
          ...chunk,
          similarity: semanticScore,
          lexicalScore: normalizedLexical,
          combinedScore,
          matchedKeywords: Array.from(new Set(matchedTerms)),
        });
      }
    }

    // Sort by combined score descending
    scored.sort((a, b) => b.combinedScore - a.combinedScore);

    // If initial threshold returned nothing, return top matches by semantic score to prevent empty drop
    if (scored.length === 0 && projectChunks.length > 0) {
      const fallbackScored = projectChunks.map(c => ({
        ...c,
        similarity: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
        lexicalScore: 0,
        combinedScore: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
      }));
      fallbackScored.sort((a, b) => b.combinedScore - a.combinedScore);
      return fallbackScored.slice(0, topK);
    }

    return scored.slice(0, topK);
  }

  /**
   * Diagnostic function to inspect RAG pipeline behavior
   */
  public async diagnose(
    projectId: string,
    query: string
  ): Promise<RAGDiagnosticResult> {
    const startTime = Date.now();
    const chunks = this.getChunks(projectId);

    if (chunks.length === 0) {
      return {
        query,
        projectId,
        durationMs: Date.now() - startTime,
        totalChunksInStore: 0,
        results: [],
        diagnostics: {
          filesDiscovered: 0,
          filesParsed: 0,
          chunksCreated: 0,
          chunksEmbedded: 0,
          vectorsStored: 0,
          embeddingErrors: this.getErrors(projectId),
          vectorDimensions: VECTOR_DIMENSIONS,
        },
        error: `Vector store has 0 chunks for project ${projectId}. Repository indexing has not been run or produced no chunks.`,
      };
    }

    try {
      const results = await this.search(projectId, query, { topK: 5, minScore: 0.01 });
      const durationMs = Date.now() - startTime;

      const filesSet = new Set(chunks.map(c => c.filePath));
      const embeddedCount = chunks.filter(c => c.embedding && c.embedding.length > 0).length;

      return {
        query,
        projectId,
        durationMs,
        totalChunksInStore: chunks.length,
        results,
        diagnostics: {
          filesDiscovered: filesSet.size,
          filesParsed: filesSet.size,
          chunksCreated: chunks.length,
          chunksEmbedded: embeddedCount,
          vectorsStored: chunks.length,
          embeddingErrors: this.getErrors(projectId),
          vectorDimensions: VECTOR_DIMENSIONS,
        },
      };
    } catch (err: any) {
      return {
        query,
        projectId,
        durationMs: Date.now() - startTime,
        totalChunksInStore: chunks.length,
        results: [],
        diagnostics: {
          filesDiscovered: 0,
          filesParsed: 0,
          chunksCreated: chunks.length,
          chunksEmbedded: 0,
          vectorsStored: chunks.length,
          embeddingErrors: [err?.message || 'Diagnostic search failure'],
          vectorDimensions: VECTOR_DIMENSIONS,
        },
        error: err?.message || 'Search execution failed',
      };
    }
  }
}

export const vectorStore = new VectorStore();
