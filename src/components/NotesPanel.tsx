import { useState, useCallback } from 'react';
import { StudyNote } from '../types';
import { generateNotes } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  model: string;
  notes: StudyNote[];
  onSaveNote: (note: StudyNote) => void;
  onDeleteNote: (id: string) => void;
}

const QUICK_TOPICS = [
  'Calculus Formulas', 'Organic Reactions', 'Electrostatics',
  'Thermodynamics', 'Trigonometry Identities', 'Chemical Bonding',
  'Mechanics Formulas', 'Coordination Chemistry', 'Probability',
  'Vectors & 3D Geometry', 'Waves & Optics', 'Matrices',
];

export function NotesPanel({ isOpen, onClose, model, notes, onSaveNote, onDeleteNote }: Props) {
  const [phase, setPhase] = useState<'list' | 'generate' | 'loading' | 'view'>('list');
  const [topic, setTopic] = useState('');
  const [currentNote, setCurrentNote] = useState<StudyNote | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setPhase('loading');
    setError('');
    try {
      const content = await generateNotes(topic.trim(), model);
      const note: StudyNote = {
        id: `note-${Date.now()}`,
        title: `Short Notes: ${topic.trim()}`,
        topic: topic.trim(),
        content,
        createdAt: Date.now(),
        tags: [topic.trim().toLowerCase()],
      };
      setCurrentNote(note);
      onSaveNote(note);
      setPhase('view');
    } catch (err: any) {
      setError(err.message || 'Failed to generate notes');
      setPhase('generate');
    }
  }, [topic, model, onSaveNote]);

  const exportNote = useCallback((note: StudyNote) => {
    const blob = new Blob([`# ${note.title}\n\n*Generated on ${new Date(note.createdAt).toLocaleString()}*\n\n---\n\n${note.content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aria-notes-${note.topic.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-[#0e0e1a] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold gradient-text">📒 Short Notes</h2>
              <p className="text-[12px] text-white/40 mt-0.5">Exam-ready revision notes</p>
            </div>
            <div className="flex items-center gap-2">
              {phase !== 'list' && (
                <button
                  onClick={() => { setPhase('list'); setCurrentNote(null); setError(''); }}
                  className="px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  ← Back
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto chat-scroll">
          {/* ── LIST PHASE ── */}
          {phase === 'list' && (
            <div className="p-6 space-y-5">
              {/* Generate new */}
              <button
                onClick={() => setPhase('generate')}
                className="w-full p-4 rounded-xl border border-dashed border-white/[0.1] hover:border-violet-500/30 hover:bg-violet-500/[0.03] text-white/40 hover:text-violet-300 transition-all group"
              >
                <div className="text-2xl mb-1">✨</div>
                <p className="text-[14px] font-semibold">Generate New Notes</p>
                <p className="text-[11px] text-white/20 mt-0.5">AI-powered exam-ready revision notes</p>
              </button>

              {/* Saved notes */}
              {notes.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-white/40 mb-3">Saved Notes ({notes.length})</h3>
                  <div className="space-y-2">
                    {notes.sort((a, b) => b.createdAt - a.createdAt).map(note => (
                      <div
                        key={note.id}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-lg shrink-0">📒</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white/70 font-medium truncate">{note.title}</p>
                          <p className="text-[11px] text-white/25">{new Date(note.createdAt).toLocaleDateString()} · {note.tags.join(', ')}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setCurrentNote(note); setPhase('view'); }}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                            title="View"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button
                            onClick={() => exportNote(note)}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                            title="Export"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </button>
                          <button
                            onClick={() => onDeleteNote(note.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notes.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-[14px] text-white/30">No notes yet</p>
                  <p className="text-[12px] text-white/15 mt-1">Generate your first exam-ready notes above!</p>
                </div>
              )}
            </div>
          )}

          {/* ── GENERATE PHASE ── */}
          {phase === 'generate' && (
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[13px] font-semibold text-white/50 mb-2 block">What topic?</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
                  placeholder="e.g., Thermodynamics, Calculus, Organic Chemistry..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 transition-all text-[15px]"
                  autoFocus
                />
              </div>

              <div>
                <p className="text-[11px] text-white/25 mb-2">Quick picks:</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TOPICS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] transition-all duration-200 ${
                        topic === t
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                          : 'bg-white/[0.03] border border-white/[0.05] text-white/35 hover:bg-white/[0.06]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">
                  ⚠️ {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!topic.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl font-semibold text-[15px] hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
              >
                ✨ Generate Notes
              </button>
            </div>
          )}

          {/* ── LOADING PHASE ── */}
          {phase === 'loading' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-lg font-bold gradient-text mb-1">Creating Notes</h3>
              <p className="text-[13px] text-white/40">Condensing <strong>{topic}</strong> into exam-ready notes...</p>
            </div>
          )}

          {/* ── VIEW PHASE ── */}
          {phase === 'view' && currentNote && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white/80">{currentNote.title}</h3>
                <button
                  onClick={() => exportNote(currentNote)}
                  className="px-3 py-1.5 rounded-lg text-[12px] bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
                >
                  📥 Export .md
                </button>
              </div>
              <div className="prose-content msg-text text-[14px] leading-relaxed p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code({ className, children, ...props }) {
                      const isInline = !className && typeof children === 'string' && !String(children).includes('\n');
                      if (isInline) {
                        return <code className="px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300 text-[13px] font-['Fira_Code',monospace]" {...props}>{children}</code>;
                      }
                      return <pre className="overflow-x-auto rounded-xl p-4 text-[13px] font-['Fira_Code',monospace] leading-relaxed bg-black/40 border border-white/[0.04] my-3"><code className={className}>{children}</code></pre>;
                    },
                    pre({ children }) { return <>{children}</>; },
                    h2({ children }) { return <h2 className="text-[15px] font-bold text-violet-300/80 mt-5 mb-2 flex items-center gap-2">{children}</h2>; },
                    h3({ children }) { return <h3 className="text-[14px] font-bold text-white/70 mt-4 mb-1.5">{children}</h3>; },
                    ul({ children }) { return <ul className="space-y-1 ml-2">{children}</ul>; },
                    li({ children }) { return <li className="text-white/60 text-[13px]">{children}</li>; },
                    strong({ children }) { return <strong className="text-white/90 font-semibold">{children}</strong>; },
                    hr() { return <hr className="border-white/[0.06] my-4" />; },
                  }}
                >
                  {currentNote.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
