import assert from 'assert';
import { chunkFile, detectLanguage } from '../server/chunker.ts';
import { cosineSimilarity, generateFallbackEmbedding } from '../server/gemini.ts';
import { VectorStore } from '../server/vectorStore.ts';
import { StorageManager } from '../server/storage.ts';

async function runTests() {
  console.log('--- DevPilot AI Automated Test Suite ---');
  let passed = 0;
  let total = 0;

  const test = async (name: string, fn: () => void | Promise<void>) => {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`✗ [FAIL] ${name}: ${err.message}`);
    }
  };

  // Test 1: Language detection
  await test('Language detection accurately identifies multi-language extensions', () => {
    assert.strictEqual(detectLanguage('src/app.ts'), 'TypeScript');
    assert.strictEqual(detectLanguage('main.py'), 'Python');
    assert.strictEqual(detectLanguage('index.html'), 'HTML');
    assert.strictEqual(detectLanguage('config.json'), 'JSON');
    assert.strictEqual(detectLanguage('Dockerfile'), 'Docker');
  });

  // Test 2: Chunking preserves symbols and line ranges
  await test('Chunking splits TypeScript code into cohesive symbol blocks', () => {
    const sampleCode = `
import express from 'express';

export async function transferBalance(senderId: string, amount: number) {
  if (amount <= 0) throw new Error('Invalid amount');
  const balance = await getBalance(senderId);
  return balance - amount;
}

export class LedgerManager {
  private entries: any[] = [];
  public record(entry: any) {
    this.entries.push(entry);
  }
}
    `.trim();

    const chunks = chunkFile('test_proj', 'src/ledger.ts', sampleCode);
    assert.ok(chunks.length > 0, 'Expected at least one chunk');
    assert.strictEqual(chunks[0].filePath, 'src/ledger.ts');
    assert.ok(chunks[0].startLine >= 1);
  });

  // Test 3: Cosine similarity
  await test('Cosine similarity measures vector directional similarity', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    assert.strictEqual(Math.round(cosineSimilarity(v1, v2)), 1);
    assert.strictEqual(Math.round(cosineSimilarity(v1, v3)), 0);
  });

  // Test 4: Semantic fallback embedding
  await test('Semantic embedding generates normalized unit vector', () => {
    const embedding = generateFallbackEmbedding('function transferBalance()', 768);
    assert.strictEqual(embedding.length, 768);
    let norm = 0;
    for (const val of embedding) norm += val * val;
    assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 0.01, 'Embedding should be unit normalized');
  });

  // Test 5: Hybrid RAG Search
  await test('Hybrid RAG combines vector cosine and lexical symbol matching', async () => {
    const store = new VectorStore();
    const testChunks = [
      {
        id: 'c1',
        projectId: 'test_p1',
        filePath: 'src/controllers/paymentController.ts',
        startLine: 1,
        endLine: 40,
        symbolName: 'transferBalance',
        symbolType: 'function' as const,
        content: 'export async function transferBalance(req, res) { const balance = await wallet.get(); }',
        language: 'TypeScript',
        embedding: generateFallbackEmbedding('export async function transferBalance'),
      },
      {
        id: 'c2',
        projectId: 'test_p1',
        filePath: 'src/utils/logger.ts',
        startLine: 1,
        endLine: 20,
        symbolName: 'logEvent',
        symbolType: 'function' as const,
        content: 'export function logEvent(msg) { console.log(msg); }',
        language: 'TypeScript',
        embedding: generateFallbackEmbedding('export function logEvent'),
      },
    ];

    store.setChunks('test_p1', testChunks);
    const results = await store.search('test_p1', 'transferBalance race condition balance', { topK: 2 });
    assert.ok(results.length > 0, 'Should return results');
    assert.strictEqual(results[0].filePath, 'src/controllers/paymentController.ts');
    assert.ok(results[0].combinedScore > 0);
  });

  // Test 6: Security path traversal defense
  await test('StorageManager prevents ZipSlip directory traversal attacks', () => {
    const mgr = new StorageManager();
    const dangerousPath = '../../../../etc/passwd';
    const safePath = mgr.sanitizePath(dangerousPath);
    assert.ok(!safePath.startsWith('..'), 'Path should be sanitized of parent traversals');
    assert.strictEqual(safePath, 'etc/passwd');
  });

  console.log(`\nTest Run Completed: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
