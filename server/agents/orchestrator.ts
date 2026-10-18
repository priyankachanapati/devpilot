import { EventEmitter } from 'events';
import {
  WorkflowSession,
  AgentTask,
  ProposedPatch,
  Project,
} from '../../src/types/index.ts';
import { storage } from '../storage.ts';
import { vectorStore } from '../vectorStore.ts';
import { runPlannerAgent } from './plannerAgent.ts';
import { runAnalystAgent } from './analystAgent.ts';
import { runDebuggerAgent } from './debuggerAgent.ts';
import { runSecurityAgent } from './securityAgent.ts';
import { runTesterAgent } from './testerAgent.ts';
import { runReviewAgent } from './reviewAgent.ts';

export interface WorkflowEvent {
  sessionId: string;
  type: 'agent_start' | 'agent_progress' | 'agent_complete' | 'workflow_complete' | 'workflow_error';
  agentName?: AgentTask['agentName'];
  task?: AgentTask;
  session?: WorkflowSession;
  message: string;
  data?: any;
}

export class AgentOrchestrator extends EventEmitter {
  /**
   * Initialize a new session synchronously so the caller immediately has the ID
   */
  public initWorkflowSession(
    projectId: string,
    userPrompt: string,
    sessionType: 'debug' | 'security' | 'chat' = 'debug'
  ): WorkflowSession {
    const project = storage.getProject(projectId);
    if (!project) throw new Error('Project not found: ' + projectId);

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const session: WorkflowSession = {
      id: sessionId,
      projectId,
      type: sessionType,
      title: userPrompt.slice(0, 60) + (userPrompt.length > 60 ? '...' : ''),
      userPrompt,
      createdAt: new Date().toISOString(),
      status: 'active',
      currentStage: 'Planner',
      agents: [
        { id: 'task_1', agentName: 'Planner', status: 'pending', summary: 'Deconstruct request and prepare investigation plan', retryCount: 0 },
        { id: 'task_2', agentName: 'Repository Analyst', status: 'pending', summary: 'Retrieve semantic RAG context and map execution flow', retryCount: 0 },
        { id: 'task_3', agentName: 'Debugging Agent', status: 'pending', summary: 'Formulate root-cause hypotheses and generate targeted patch', retryCount: 0 },
        { id: 'task_4', agentName: 'Security & Quality', status: 'pending', summary: 'Audit affected modules for CWE/OWASP vulnerabilities', retryCount: 0 },
        { id: 'task_5', agentName: 'Testing & Verification', status: 'pending', summary: 'Generate regression tests and execute in sandboxed runner', retryCount: 0 },
        { id: 'task_6', agentName: 'Review Agent', status: 'pending', summary: 'Cross-examine evidence and produce final verdict', retryCount: 0 },
      ],
    };

    storage.createSession(session);
    storage.logAudit(projectId, 'Agent Workflow Initiated', `Session ${sessionId}: "${userPrompt.slice(0, 50)}"`);
    return session;
  }

  /**
   * Run the full multi-agent investigation workflow with timeouts, bounded retries, and explicit state transitions
   */
  public async runWorkflow(
    projectId: string,
    userPrompt: string,
    sessionType: 'debug' | 'security' | 'chat' = 'debug',
    existingSession?: WorkflowSession
  ): Promise<WorkflowSession> {
    const session = existingSession || this.initWorkflowSession(projectId, userPrompt, sessionType);
    const sessionId = session.id;
    const project = storage.getProject(projectId)!;

    // Auto-index if not already indexed
    if (project.indexingStatus !== 'indexed' || vectorStore.getChunks(projectId).length === 0) {
      console.log(`[Workflow ${sessionId}] Repository unindexed or missing vectors. Running indexing first...`);
      await storage.startIndexing(projectId);
    }

    // Helper to safely execute an agent step with timing and error isolation
    const executeAgentStep = async <T>(
      agentName: AgentTask['agentName'],
      action: () => Promise<T>,
      maxRetries = 1
    ): Promise<T> => {
      const task = session.agents.find(a => a.agentName === agentName)!;
      session.currentStage = agentName;
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      const startTime = Date.now();
      storage.updateSession(session);

      this.emitEvent({
        sessionId,
        type: 'agent_start',
        agentName,
        message: `${agentName} activated...`,
      });

      let lastErr: any = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          task.retryCount = (task.retryCount || 0) + 1;
          const backoff = attempt * 1200;
          console.warn(`[Workflow ${sessionId}] Retrying ${agentName} in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
        }

        try {
          const result = await action();
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          task.durationMs = Date.now() - startTime;
          storage.updateSession(session);

          console.log(`[Workflow ${sessionId}] Agent "${agentName}" COMPLETED in ${task.durationMs}ms`);

          this.emitEvent({
            sessionId,
            type: 'agent_complete',
            agentName,
            task,
            session,
            message: `${agentName} completed in ${task.durationMs}ms.`,
          });

          return result;
        } catch (err: any) {
          lastErr = err;
          console.error(`[Workflow ${sessionId}] Agent "${agentName}" attempt ${attempt + 1} failed: ${err.message}`);
        }
      }

      // If all retries failed:
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      task.durationMs = Date.now() - startTime;
      task.error = lastErr?.message || `${agentName} failed`;

      // Mark all subsequent pending agents as 'skipped'
      const currentIndex = session.agents.findIndex(a => a.agentName === agentName);
      for (let i = currentIndex + 1; i < session.agents.length; i++) {
        session.agents[i].status = 'skipped';
        session.agents[i].summary = `Skipped due to upstream failure in ${agentName}`;
      }

      session.status = 'failed';
      session.failureReason = `${agentName} failed: ${lastErr?.message || 'Unknown error'}`;
      session.completedAt = new Date().toISOString();
      storage.updateSession(session);

      this.emitEvent({
        sessionId,
        type: 'workflow_error',
        agentName,
        task,
        session,
        message: session.failureReason,
      });

      throw lastErr;
    };

    try {
      // ----------------------------------------------------
      // STEP 1: PLANNER AGENT
      // ----------------------------------------------------
      const plannerTask = session.agents.find(a => a.agentName === 'Planner')!;
      const plannerOutput = await executeAgentStep('Planner', async () => {
        const out = await runPlannerAgent(userPrompt, project);
        plannerTask.summary = out.understanding;
        plannerTask.output = out;
        session.plan = {
          steps: out.steps,
          requiredAgents: out.requiredAgents,
          focusFiles: out.targetFileHints,
        };
        return out;
      });

      // ----------------------------------------------------
      // STEP 2: RAG RETRIEVAL & REPOSITORY ANALYST AGENT
      // ----------------------------------------------------
      const analystTask = session.agents.find(a => a.agentName === 'Repository Analyst')!;
      const analystResult = await executeAgentStep('Repository Analyst', async () => {
        const retrievalQuery = [userPrompt, ...plannerOutput.searchQueries].join(' ');
        const chunks = await vectorStore.search(projectId, retrievalQuery, {
          topK: 6,
          minScore: 0.05,
        });

        const out = await runAnalystAgent(userPrompt, chunks);
        analystTask.summary = out.executionPathSummary;
        analystTask.output = out;
        return { output: out, chunks };
      });

      const analystOutput = analystResult.output;
      const retrievedChunks = analystResult.chunks;

      // ----------------------------------------------------
      // STEP 3: DEBUGGING AGENT (Hypotheses + Targeted Patch)
      // ----------------------------------------------------
      const debuggerTask = session.agents.find(a => a.agentName === 'Debugging Agent')!;
      const debuggerOutput = await executeAgentStep('Debugging Agent', async () => {
        const out = await runDebuggerAgent(userPrompt, analystOutput, retrievedChunks);
        debuggerTask.summary = out.investigationSummary;
        debuggerTask.output = out;
        session.hypotheses = out.hypotheses;

        // Create proposed patch record safely
        const patchId = `patch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const proposedPatch: ProposedPatch = {
          id: patchId,
          sessionId,
          projectId,
          title: out.targetedPatch?.title || `Targeted fix for ${userPrompt.slice(0, 30)}`,
          description: out.targetedPatch?.description || 'Proposed code fix',
          files: out.targetedPatch?.files || [],
          status: 'draft',
          createdAt: new Date().toISOString(),
        };
        session.patch = proposedPatch;
        storage.savePatch(proposedPatch);
        return out;
      });

      // ----------------------------------------------------
      // STEP 4: SECURITY & QUALITY AGENT
      // ----------------------------------------------------
      const securityTask = session.agents.find(a => a.agentName === 'Security & Quality')!;
      await executeAgentStep('Security & Quality', async () => {
        const out = await runSecurityAgent(projectId, retrievedChunks);
        securityTask.summary = out.summary;
        securityTask.output = out;

        if (out.findings.length > 0) {
          const existingFindings = storage.getFindings(projectId);
          const updatedFindings = [...existingFindings];
          for (const f of out.findings) {
            if (!updatedFindings.some(ef => ef.title === f.title && ef.filePath === f.filePath)) {
              updatedFindings.push(f);
            }
          }
          storage.setFindings(projectId, updatedFindings);
        }
        return out;
      });

      // ----------------------------------------------------
      // STEP 5: TESTING & VERIFICATION AGENT
      // ----------------------------------------------------
      const testerTask = session.agents.find(a => a.agentName === 'Testing & Verification')!;
      const testerOutput = await executeAgentStep('Testing & Verification', async () => {
        const patchFiles = session.patch?.files || [];
        const out = await runTesterAgent(userPrompt, patchFiles);
        testerTask.summary = out.summary;
        testerTask.output = out;
        session.tests = out.testCases;
        return out;
      });

      // ----------------------------------------------------
      // STEP 6: REVIEW AGENT (Adversarial Audit & Final Verdict)
      // ----------------------------------------------------
      const reviewTask = session.agents.find(a => a.agentName === 'Review Agent')!;
      const reviewOutput = await executeAgentStep('Review Agent', async () => {
        const patchFiles = session.patch?.files || [];
        const out = await runReviewAgent(
          userPrompt,
          analystOutput,
          debuggerOutput.hypotheses,
          patchFiles,
          testerOutput.testCases
        );
        reviewTask.summary = out.summary;
        reviewTask.output = out;

        session.reviewReport = {
          verdict: out.verdict,
          summary: out.summary,
          limitations: out.limitations,
          unsupportedClaimsChecked: out.unsupportedClaimsChecked,
          recommendations: out.recommendations,
        };
        return out;
      });

      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      session.currentStage = 'Completed';
      storage.updateSession(session);
      storage.logAudit(projectId, 'Investigation Finished', `Session ${sessionId} completed with verdict: ${reviewOutput.verdict}`);

      this.emitEvent({
        sessionId,
        type: 'workflow_complete',
        session,
        message: `Workflow completed successfully. Final verdict: ${reviewOutput.verdict}.`,
      });

      return session;
    } catch (err: any) {
      console.error(`[Workflow ${sessionId} Top-Level Error]`, err);
      return session;
    }
  }

  private emitEvent(event: WorkflowEvent) {
    this.emit('event', event);
    this.emit(`session:${event.sessionId}`, event);
  }
}

export const orchestrator = new AgentOrchestrator();
