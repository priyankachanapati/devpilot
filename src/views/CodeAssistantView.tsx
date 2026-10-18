import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  FileCode,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Compass,
} from 'lucide-react';
import { Project, ChatMessage, ChatCitation } from '../types/index.ts';

interface CodeAssistantViewProps {
  project: Project | null;
  onInvestigateSnippet?: (filePath: string, snippet: string) => void;
}

export const CodeAssistantView: React.FC<CodeAssistantViewProps> = ({
  project,
  onInvestigateSnippet,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCitationIdx, setExpandedCitationIdx] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const query = questionText || input;
    if (!query.trim() || !project || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: messages.slice(-4),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process inquiry');

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        citations: data.citations || [],
        facts: data.facts || [],
        hypotheses: data.hypotheses || [],
        missingEvidence: data.missingEvidence || [],
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `Error retrieving grounded code context: ${err.message}. Please verify the codebase is indexed.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'How does the payment transfer flow work and where is balance deducted?',
    'Where are external webhook requests verified and are they timing-safe?',
    'Are there any unhandled promise rejections or crash points in background jobs?',
    'Show me where database queries are constructed and check for SQL injection',
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Top Bar */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-xs text-slate-200">
            Grounded AI Code Assistant — {project?.name}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Hybrid Semantic RAG + Verified Citations
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Ask Anything About {project?.name}
            </h3>
            <p className="text-xs text-slate-400 mb-6 max-w-md leading-relaxed">
              Every answer is backed by exact file paths and line ranges retrieved through semantic vector embeddings and lexical symbol matching.
            </p>

            <div className="w-full space-y-2 text-left">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Suggested Questions for this Repository:</span>
              </div>
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 text-xs text-slate-300 transition"
                >
                  &quot;{prompt}&quot;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/40 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-3xl rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-200'
                }`}
              >
                {/* Message Body */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Grounded Code Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Retrieved Source Citations ({msg.citations.length})</span>
                    </div>

                    <div className="space-y-1.5">
                      {msg.citations.map((cit, cIdx) => {
                        const citId = `${msg.id}_cit_${cIdx}`;
                        const isExpanded = expandedCitationIdx === citId;

                        return (
                          <div
                            key={cIdx}
                            className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs"
                          >
                            <div
                              onClick={() =>
                                setExpandedCitationIdx(isExpanded ? null : citId)
                              }
                              className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="font-semibold text-emerald-400 font-mono">
                                  {cit.filePath}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  (L{cit.startLine}-L{cit.endLine})
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                                {cit.relevanceScore && (
                                  <span className="font-mono text-cyan-400">
                                    {Math.round(cit.relevanceScore * 100)}% match
                                  </span>
                                )}
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-slate-900">
                                <pre className="bg-slate-900 p-2.5 rounded font-mono text-[11px] overflow-auto text-slate-300">
                                  {cit.snippet}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Verified Facts & Limitations */}
                {((msg.facts && msg.facts.length > 0) ||
                  (msg.missingEvidence && msg.missingEvidence.length > 0)) && (
                  <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    {msg.facts && msg.facts.length > 0 && (
                      <div className="p-2 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-300">
                        <div className="font-semibold flex items-center gap-1 mb-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Verified Code Facts:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-300">
                          {msg.facts.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.missingEvidence && msg.missingEvidence.length > 0 && (
                      <div className="p-2 rounded bg-amber-950/20 border border-amber-900/30 text-amber-300">
                        <div className="font-semibold flex items-center gap-1 mb-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Missing Evidence / Caveats:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-300">
                          {msg.missingEvidence.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/40 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Retrieving AST chunks & synthesizing grounded response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/90">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            placeholder={`Ask a question about ${project?.name || 'this repository'}...`}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-cyan-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
