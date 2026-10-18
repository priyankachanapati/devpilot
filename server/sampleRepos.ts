import { RepoFile } from '../src/types/index.ts';

export interface SampleRepoDefinition {
  id: string;
  name: string;
  description: string;
  language: string;
  languages: Record<string, number>;
  knownIssues: {
    title: string;
    description: string;
    type: 'bug' | 'security' | 'concurrency';
    targetFile: string;
  }[];
  files: RepoFile[];
}

export const SAMPLE_REPOSITORIES: SampleRepoDefinition[] = [
  {
    id: 'payflow-gateway',
    name: 'PayFlow Payment Gateway',
    description: 'High-throughput Node/TypeScript payment microservice with wallet transfers, webhook handling, and auth middlewares.',
    language: 'TypeScript',
    languages: { TypeScript: 78, JSON: 12, Markdown: 10 },
    knownIssues: [
      {
        title: 'Concurrency Race Condition in Balance Transfer',
        description: 'Wallet balance check and deduction has an asynchronous gap without atomic locks, enabling double-spending under concurrent API requests.',
        type: 'concurrency',
        targetFile: 'src/controllers/paymentController.ts',
      },
      {
        title: 'Timing Attack in Webhook Secret Validation',
        description: 'String equality operator (===) used for secret signature matching instead of crypto.timingSafeEqual, exposing byte-by-byte timing discrepancy.',
        type: 'security',
        targetFile: 'src/middleware/auth.ts',
      },
      {
        title: 'Unhandled Promise Rejection Crash in Webhook Dispatcher',
        description: 'Missing catch handler in asynchronous event dispatcher causes uncaughtException and microservice pod restarts on corrupted payloads.',
        type: 'bug',
        targetFile: 'src/services/webhookService.ts',
      },
    ],
    files: [
      {
        path: 'package.json',
        name: 'package.json',
        size: 420,
        language: 'JSON',
        lineCount: 22,
        content: `{
  "name": "payflow-gateway",
  "version": "1.4.0",
  "description": "Production payment microservice",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.19.2",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/express": "^4.17.21",
    "jest": "^29.7.0"
  }
}`,
      },
      {
        path: 'src/index.ts',
        name: 'index.ts',
        size: 980,
        language: 'TypeScript',
        lineCount: 38,
        content: `import express, { Request, Response } from 'express';
import { transferBalance, getBalance } from './controllers/paymentController';
import { verifyWebhookSignature } from './middleware/auth';
import { handleStripeWebhook } from './services/webhookService';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Balance enquiry
app.get('/api/wallets/:userId/balance', async (req: Request, res: Response) => {
  try {
    const balance = await getBalance(req.params.userId);
    res.json({ userId: req.params.userId, balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer funds between wallets
app.post('/api/wallets/transfer', transferBalance);

// Webhook listener
app.post('/api/webhooks/stripe', verifyWebhookSignature, handleStripeWebhook);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(\`PayFlow Gateway listening on port \${PORT}\`);
});

export default app;`,
      },
      {
        path: 'src/controllers/paymentController.ts',
        name: 'paymentController.ts',
        size: 1650,
        language: 'TypeScript',
        lineCount: 52,
        content: `import { Request, Response } from 'express';
import { walletStore } from '../services/walletService';

export async function getBalance(userId: string): Promise<number> {
  return walletStore.getBalance(userId);
}

/**
 * Handles balance transfer between sender and recipient.
 * BUG NOTE: Vulnerable to concurrency race conditions (TOCTOU: Time of check to time of use)
 */
export async function transferBalance(req: Request, res: Response): Promise<void> {
  const { senderId, recipientId, amount } = req.body;

  if (!senderId || !recipientId || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ error: 'Invalid transfer payload: senderId, recipientId and positive amount required' });
    return;
  }

  // 1. Check sender balance
  const currentSenderBalance = await walletStore.getBalance(senderId);
  if (currentSenderBalance < amount) {
    res.status(402).json({ error: 'Insufficient funds for requested transfer', currentBalance: currentSenderBalance });
    return;
  }

  // Latency simulation (e.g. external compliance check or database latency)
  // This asynchronous gap allows concurrent requests to slip through before deduction!
  await new Promise(resolve => setTimeout(resolve, 80));

  // 2. Perform transfer without atomic lock or transaction
  try {
    const newSenderBalance = currentSenderBalance - amount;
    await walletStore.setBalance(senderId, newSenderBalance);
    
    const currentRecipientBalance = await walletStore.getBalance(recipientId);
    await walletStore.setBalance(recipientId, currentRecipientBalance + amount);

    res.json({
      success: true,
      transactionId: \`tx_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
      senderBalance: newSenderBalance,
      amountTransferred: amount,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to commit ledger entry: ' + error.message });
  }
}`,
      },
      {
        path: 'src/middleware/auth.ts',
        name: 'auth.ts',
        size: 1200,
        language: 'TypeScript',
        lineCount: 42,
        content: `import { Request, Response, NextFunction } from 'express';

const WEBHOOK_SECRET = process.env.PAYFLOW_WEBHOOK_SECRET || 'whsec_test_secret_key_998877';

/**
 * Verifies webhook signature against configured secret.
 * SECURITY VULNERABILITY: Uses plain string comparison === which is vulnerable to timing attacks.
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-payflow-signature'] as string;

  if (!signature) {
    res.status(401).json({ error: 'Missing x-payflow-signature authentication header' });
    return;
  }

  // VULNERABLE: Direct string comparison leaks timing information per character
  if (signature !== WEBHOOK_SECRET) {
    res.status(403).json({ error: 'Signature verification failed' });
    return;
  }

  next();
}`,
      },
      {
        path: 'src/services/webhookService.ts',
        name: 'webhookService.ts',
        size: 1450,
        language: 'TypeScript',
        lineCount: 45,
        content: `import { Request, Response } from 'express';

/**
 * Asynchronous webhook handler.
 * BUG NOTE: Unhandled promise rejection occurs when event payload fails validation.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const event = req.body;

  // Immediate 200 acknowledgment to webhook source
  res.status(200).json({ received: true });

  // Asynchronous background processing without .catch() or wrapping try/catch!
  processWebhookEventAsync(event);
}

async function processWebhookEventAsync(event: any): Promise<void> {
  // If event.data or event.type is missing, this throws an unhandled rejection that crashes Node process
  if (!event || !event.type) {
    throw new Error('Fatal: Malformed webhook payload received without event type');
  }

  if (event.type === 'payment.succeeded') {
    const charge = event.data.object;
    console.log(\`[Webhook] Payment succeeded for \${charge.id}, amount: \${charge.amount}\`);
  }
}`,
      },
      {
        path: 'src/services/walletService.ts',
        name: 'walletService.ts',
        size: 1100,
        language: 'TypeScript',
        lineCount: 36,
        content: `class WalletStore {
  private balances: Map<string, number> = new Map([
    ['user_alice', 500],
    ['user_bob', 120],
    ['user_charlie', 1000],
  ]);

  public async getBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 0;
  }

  public async setBalance(userId: string, newBalance: number): Promise<void> {
    this.balances.set(userId, Math.max(0, newBalance));
  }
}

export const walletStore = new WalletStore();`,
      },
      {
        path: 'README.md',
        name: 'README.md',
        size: 750,
        language: 'Markdown',
        lineCount: 25,
        content: `# PayFlow Gateway

Production-grade payment processing microservice.

## Architecture
- \`src/index.ts\`: Entrypoint and routing.
- \`src/controllers/paymentController.ts\`: Balance check & transfer.
- \`src/middleware/auth.ts\`: Webhook HMAC authentication.
- \`src/services/webhookService.ts\`: Asynchronous payment events.

## Endpoints
- \`GET /health\`
- \`GET /api/wallets/:userId/balance\`
- \`POST /api/wallets/transfer\`
- \`POST /api/webhooks/stripe\``,
      },
    ],
  },
  {
    id: 'dataforge-pipeline',
    name: 'DataForge Analytics Pipeline',
    description: 'Python & FastAPI analytics microservice for parsing CSV batches, computing statistics, and database persistence.',
    language: 'Python',
    languages: { Python: 82, SQL: 10, Markdown: 8 },
    knownIssues: [
      {
        title: 'SQL Injection in Database Query Construction',
        description: 'Raw string formatting used in database filter clause allowing SQL injection through user_id parameter.',
        type: 'security',
        targetFile: 'services/database.py',
      },
      {
        title: 'ZeroDivisionError in Batch Metrics Aggregator',
        description: 'Empty batch of records triggers unhandled ZeroDivisionError when calculating average duration.',
        type: 'bug',
        targetFile: 'services/ingest.py',
      },
      {
        title: 'Memory Leak via Unbounded Global Cache',
        description: 'Global cache dictionary stores all processed batch payload references indefinitely without TTL or LRU capacity limit.',
        type: 'bug',
        targetFile: 'services/cache.py',
      },
    ],
    files: [
      {
        path: 'requirements.txt',
        name: 'requirements.txt',
        size: 150,
        language: 'Text',
        lineCount: 5,
        content: `fastapi==0.110.0
uvicorn==0.28.0
pydantic==2.6.4
pytest==8.1.1`,
      },
      {
        path: 'main.py',
        name: 'main.py',
        size: 1100,
        language: 'Python',
        lineCount: 38,
        content: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from services.ingest import process_batch_metrics
from services.database import get_user_records

app = FastAPI(title="DataForge Analytics Pipeline", version="2.1.0")

class BatchPayload(BaseModel):
    batch_id: str
    records: List[Dict[str, Any]]

@app.get("/health")
def health():
    return {"status": "ok", "service": "dataforge"}

@app.post("/api/batches/process")
def process_batch(payload: BatchPayload):
    try:
        results = process_batch_metrics(payload.batch_id, payload.records)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/{user_id}/records")
def user_records(user_id: str):
    return get_user_records(user_id)`,
      },
      {
        path: 'services/ingest.py',
        name: 'ingest.py',
        size: 1350,
        language: 'Python',
        lineCount: 44,
        content: `from typing import List, Dict, Any
from services.cache import cache_batch

def process_batch_metrics(batch_id: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes statistical aggregate metrics for an incoming batch.
    BUG: Triggers ZeroDivisionError if records list is empty!
    """
    # Cache batch into global cache
    cache_batch(batch_id, records)

    total_duration = 0.0
    valid_count = 0

    for r in records:
        duration = float(r.get("duration", 0))
        total_duration += duration
        valid_count += 1

    # CRITICAL BUG: ZeroDivisionError when records is empty or valid_count is 0
    average_duration = total_duration / valid_count

    return {
        "batch_id": batch_id,
        "record_count": valid_count,
        "total_duration": total_duration,
        "average_duration": average_duration,
    }`,
      },
      {
        path: 'services/database.py',
        name: 'database.py',
        size: 1200,
        language: 'Python',
        lineCount: 38,
        content: `from typing import List, Dict, Any

# Mock database connection cursor
class MockDB:
    def execute(self, query: str):
        print(f"[DB Execute] {query}")
        return [{"id": 1, "name": "Telemetry Record", "status": "processed"}]

db = MockDB()

def get_user_records(user_id: str) -> List[Dict[str, Any]]:
    """
    Fetch user records.
    SECURITY VULNERABILITY: Raw string interpolation creates SQL Injection flaw.
    """
    # VULNERABLE: Direct string formatting into SQL query
    query = f"SELECT * FROM records WHERE user_id = '{user_id}' AND is_deleted = 0"
    
    return db.execute(query)`,
      },
      {
        path: 'services/cache.py',
        name: 'cache.py',
        size: 800,
        language: 'Python',
        lineCount: 26,
        content: `from typing import Dict, Any

# Unbounded global cache leading to memory exhaustion
GLOBAL_BATCH_CACHE: Dict[str, Any] = {}

def cache_batch(batch_id: str, data: Any) -> None:
    """
    Stores batch in memory without eviction or TTL.
    """
    GLOBAL_BATCH_CACHE[batch_id] = data

def get_cached_batch(batch_id: str) -> Any:
    return GLOBAL_BATCH_CACHE.get(batch_id)`,
      },
      {
        path: 'README.md',
        name: 'README.md',
        size: 600,
        language: 'Markdown',
        lineCount: 20,
        content: `# DataForge Analytics Pipeline

Python FastAPI analytics batch processor.

## Features
- Ingestion of metric telemetry batches
- User record querying
- In-memory aggregation statistics`,
      },
    ],
  },
  {
    id: 'authnexus-identity',
    name: 'AuthNexus Identity Service',
    description: 'Enterprise OAuth/JWT token issuer and RBAC role validation service with cryptographic signature verification.',
    language: 'TypeScript',
    languages: { TypeScript: 85, JSON: 10, Markdown: 5 },
    knownIssues: [
      {
        title: 'JWT Algorithm Confusion (None Algorithm Bypass)',
        description: 'Token verifier accepts algorithm "none" from attacker-controlled JWT header, allowing full authentication bypass.',
        type: 'security',
        targetFile: 'src/tokens.ts',
      },
      {
        title: 'Privilege Escalation via Missing Role Authorization',
        description: 'Endpoint accepts role property in profile update without verifying if the caller possesses superadmin privileges.',
        type: 'security',
        targetFile: 'src/rbac.ts',
      },
      {
        title: 'Off-By-One Expiration Check',
        description: 'Missing epoch threshold tolerance causes valid tokens to be prematurely rejected on boundary seconds.',
        type: 'bug',
        targetFile: 'src/tokens.ts',
      },
    ],
    files: [
      {
        path: 'package.json',
        name: 'package.json',
        size: 380,
        language: 'JSON',
        lineCount: 18,
        content: `{
  "name": "authnexus-identity",
  "version": "3.0.0",
  "description": "Enterprise JWT and RBAC authentication service",
  "dependencies": {
    "express": "^4.19.2"
  }
}`,
      },
      {
        path: 'src/tokens.ts',
        name: 'tokens.ts',
        size: 1950,
        language: 'TypeScript',
        lineCount: 65,
        content: `export interface TokenPayload {
  sub: string;
  role: 'user' | 'admin' | 'superadmin';
  exp: number;
}

const SIGNING_SECRET = process.env.JWT_SECRET || 'authnexus_super_secret_signing_key_2026';

/**
 * Validates incoming JWT token.
 * SECURITY VULNERABILITY: Accepts header algorithm "none" without cryptographic verification!
 */
export function verifyJwtToken(token: string): { valid: boolean; payload?: TokenPayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure' };
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));
    const payload: TokenPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

    // CRITICAL SECURITY FLAW: Allows "none" algorithm bypass!
    if (header.alg === 'none' || header.alg === 'NONE') {
      return { valid: true, payload };
    }

    // Expiration check
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Token verification exception: ' + err.message };
  }
}`,
      },
      {
        path: 'src/rbac.ts',
        name: 'rbac.ts',
        size: 1400,
        language: 'TypeScript',
        lineCount: 46,
        content: `export interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
}

const userDatabase: Record<string, UserProfile> = {
  'usr_101': { id: 'usr_101', email: 'alice@company.internal', role: 'user' },
  'usr_102': { id: 'usr_102', email: 'admin@company.internal', role: 'admin' },
};

/**
 * Updates user profile.
 * SECURITY FLAW: Allows arbitrary modification of role field without caller permission check.
 */
export function updateUserProfile(callerId: string, targetUserId: string, updates: Partial<UserProfile>): UserProfile {
  const existing = userDatabase[targetUserId];
  if (!existing) {
    throw new Error('User not found: ' + targetUserId);
  }

  // VULNERABLE: Direct object assign allows unprivileged caller to elevate their own role to 'admin' or 'superadmin'
  const updated = {
    ...existing,
    ...updates,
  };

  userDatabase[targetUserId] = updated;
  return updated;
}`,
      },
      {
        path: 'README.md',
        name: 'README.md',
        size: 450,
        language: 'Markdown',
        lineCount: 15,
        content: `# AuthNexus Identity Service

Security and token issuance service for enterprise single sign-on.

- \`src/tokens.ts\`: Token creation and verification
- \`src/rbac.ts\`: Role assignments and user permissions`,
      },
    ],
  },
];
