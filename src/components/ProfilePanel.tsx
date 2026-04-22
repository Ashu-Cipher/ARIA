import { Reminder, Mood, DailyProgress } from '../types';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mood: Mood;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  dailyProgress: DailyProgress;
  statusText: string;
  onOpenSettings: () => void;
  onOpenVideoCall: () => void;
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = ts - now;
  if (diff < 0) return '⚠️ Overdue';
  if (diff < 60_000) return 'Due now';
  if (diff < 3_600_000) return `In ${Math.ceil(diff / 60_000)} min`;
  if (diff < 86_400_000) return `In ${Math.ceil(diff / 3_600_000)} hr`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ProfilePanel({
  isOpen, onClose, mood, isSpeaking, isListening, isThinking,
  reminders, onToggleComplete, onDelete, dailyProgress, statusText,
  onOpenSettings, onOpenVideoCall,
}: Props) {
  const [activeTab, setActiveTab] = useState<'about' | 'reminders'>('about');

  if (!isOpen) return null;

  const active = reminders.filter(r => !r.completed).sort((a, b) => a.time - b.time);
  const completed = reminders.filter(r => r.completed).sort((a, b) => b.createdAt - a.createdAt);

  const moodEmoji: Record<Mood, string> = {
    happy: '😊', thinking: '🤔', concerned: '😟', excited: '🤩',
    neutral: '😐', speaking: '🗣️', listening: '👂', strict: '😤',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-30 animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="fixed left-0 top-0 bottom-0 w-full sm:w-[380px] z-40 animate-slide-in-left flex flex-col"
        style={{ background: 'rgba(12, 12, 25, 0.97)', backdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl transition-colors z-10">
          <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Profile hero */}
        <div className="relative px-6 pt-8 pb-5 border-b border-white/5">
          {/* Background glow */}
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-violet-600/10 rounded-full blur-[60px]" />

          <div className="flex items-center gap-4 relative">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 p-[2.5px] shadow-xl shadow-violet-500/25">
                <div className="w-full h-full rounded-full bg-[#0d0d1a] overflow-hidden">
                  <img src="/avatar.png" alt="Aria" className="w-full h-full rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              </div>
              {/* Online indicator */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-[2.5px] border-[#0d0d1a] ${
                isThinking ? 'bg-amber-400' : isSpeaking ? 'bg-violet-400' : isListening ? 'bg-cyan-400' : 'bg-emerald-400'
              }`} />
            </div>

            {/* Name & status */}
            <div>
              <h2 className="text-xl font-bold gradient-text">Aria</h2>
              <p className="text-xs text-white/35 mt-0.5 flex items-center gap-1.5">
                {moodEmoji[mood]} {statusText}
              </p>

            </div>
          </div>

          {/* Streak & stats row */}
          <div className="flex items-center gap-3 mt-4">
            {dailyProgress.streak > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/15 streak-glow">
                <span className="text-sm">🔥</span>
                <span className="text-[11px] font-bold text-amber-400/80">{dailyProgress.streak} day streak</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/15">
              <span className="text-sm">💬</span>
              <span className="text-[11px] font-medium text-violet-400/70">{dailyProgress.messageCount} msgs today</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'about' ? 'text-violet-400' : 'text-white/30 hover:text-white/50'
            }`}
          >
            About
            {activeTab === 'about' && <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-violet-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'reminders' ? 'text-violet-400' : 'text-white/30 hover:text-white/50'
            }`}
          >
            Reminders
            {active === undefined ? '' : active.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-pink-500/20 text-pink-400 rounded-full">{active.length}</span>
            )}
            {activeTab === 'reminders' && <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-violet-500 rounded-full" />}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto chat-scroll">
          {activeTab === 'about' ? (
            <div className="p-5 space-y-5">

              {/* Video Call CTA */}
              <button
                onClick={() => { onClose(); onOpenVideoCall(); }}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-violet-600/20 to-pink-600/20 border border-violet-500/20 hover:border-violet-500/40 hover:from-violet-600/30 hover:to-pink-600/30 transition-all duration-300 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white/80 group-hover:text-white/95">Video Call with Aria</p>
                  <p className="text-[11px] text-white/30 mt-0.5">Talk face-to-face · Voice conversation</p>
                </div>
                <svg className="w-5 h-5 text-white/20 group-hover:text-white/40 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* About card */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                <p className="text-[13px] text-white/50 leading-relaxed">
                  Hi! I'm <span className="text-violet-400 font-medium">Aria</span> — your personal AI teacher and companion.
                  I'm strict but loving — I won't just give you answers, I'll make sure you truly understand! 💜
                </p>
              </div>

              {/* Capabilities */}
              <div>
                <p className="text-[11px] text-white/25 font-medium uppercase tracking-wider mb-3">Capabilities</p>
                <div className="space-y-2">
                  {[
                    { icon: '📸', label: 'Photo Analysis', desc: 'Send photos of problems' },
                    { icon: '🧮', label: 'PCM Expert', desc: 'Physics, Chemistry, Math' },
                    { icon: '🐧', label: 'Arch Linux', desc: 'System commands & help' },
                    { icon: '⏰', label: 'Smart Reminders', desc: 'Never miss a task' },
                    { icon: '📊', label: 'Daily Reports', desc: 'Track your progress' },
                    { icon: '🎵', label: 'Audio Support', desc: 'Voice notes & files' },
                    { icon: '📞', label: 'Video Call', desc: 'Face-to-face conversation' },
                  ].map((cap, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <span className="text-lg">{cap.icon}</span>
                      <div>
                        <p className="text-[12px] text-white/60 font-medium">{cap.label}</p>
                        <p className="text-[10px] text-white/20">{cap.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's topics */}
              {dailyProgress.topics.length > 0 && (
                <div>
                  <p className="text-[11px] text-white/25 font-medium uppercase tracking-wider mb-3">Today's Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {dailyProgress.topics.map((t, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/15 text-[11px] text-violet-400/70">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Active reminders */}
              {active.length > 0 && (
                <div>
                  <p className="text-[11px] text-white/25 font-medium uppercase tracking-wider mb-3">
                    Active ({active.length})
                  </p>
                  <div className="space-y-2">
                    {active.map(r => (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] group hover:bg-white/[0.05] transition-colors">
                        <button
                          onClick={() => onToggleComplete(r.id)}
                          className="mt-0.5 w-5 h-5 rounded-md border-2 border-violet-500/30 hover:border-violet-400/60 flex items-center justify-center transition-colors shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white/70">{r.text}</p>
                          <p className="text-[10px] text-white/25 mt-1">{formatRelativeTime(r.time)}</p>
                        </div>
                        <button
                          onClick={() => onDelete(r.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded-lg transition-all text-white/20 hover:text-red-400"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {completed.length > 0 && (
                <div>
                  <p className="text-[11px] text-white/25 font-medium uppercase tracking-wider mb-3">
                    Completed ({completed.length})
                  </p>
                  <div className="space-y-2">
                    {completed.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] group hover:bg-white/[0.04] transition-colors">
                        <button
                          onClick={() => onToggleComplete(r.id)}
                          className="w-5 h-5 rounded-md bg-violet-500/30 border-2 border-violet-500/40 flex items-center justify-center shrink-0"
                        >
                          <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <p className="text-[12px] text-white/30 line-through flex-1">{r.text}</p>
                        <button
                          onClick={() => onDelete(r.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded-lg transition-all text-white/20 hover:text-red-400"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active.length === 0 && completed.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🔕</div>
                  <p className="text-sm text-white/30">No reminders yet</p>
                  <p className="text-[11px] text-white/15 mt-1">Say "remind me to study at 5pm"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            onClick={() => { onClose(); onOpenSettings(); }}
            className="w-full py-3 px-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-sm text-white/50 hover:text-white/70 transition-all flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings & Model Selection
          </button>
          <p className="text-center text-[10px] text-white/10 pt-1">Powered by Pollinations AI · Free Forever</p>
        </div>
      </div>
    </>
  );
}
