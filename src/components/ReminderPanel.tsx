import { Reminder } from '../types';

interface Props {
  reminders: Reminder[];
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
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

export function ReminderPanel({ reminders, isOpen, onClose, onToggleComplete, onDelete }: Props) {
  if (!isOpen) return null;

  const active = reminders.filter(r => !r.completed).sort((a, b) => a.time - b.time);
  const completed = reminders.filter(r => r.completed).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-30 animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] z-40 animate-slide-in-right flex flex-col"
        style={{ background: 'rgba(15, 15, 30, 0.95)', backdropFilter: 'blur(24px)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold gradient-text">Reminders</h2>
            <p className="text-[11px] text-white/30 mt-0.5">{active.length} active · {completed.length} done</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {reminders.length === 0 ? (
            <div className="text-center py-16 text-white/15">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-sm font-medium text-white/25">No reminders yet</p>
              <p className="text-xs mt-2 text-white/15">Say "Remind me to…" to create one!</p>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-1">Active</p>
                  {active.map(r => (
                    <div key={r.id} className="glass rounded-xl p-3.5 flex items-start gap-3 hover:border-violet-500/20 transition-colors group">
                      <button
                        onClick={() => onToggleComplete(r.id)}
                        className="mt-0.5 w-5 h-5 rounded-full border-2 border-violet-400/40 hover:border-violet-400 transition-colors shrink-0 flex items-center justify-center"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{r.text}</p>
                        <p className={`text-[11px] mt-1 ${r.time < Date.now() ? 'text-red-400/80' : 'text-white/25'}`}>
                          {formatRelativeTime(r.time)}
                        </p>
                      </div>
                      <button
                        onClick={() => onDelete(r.id)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all shrink-0"
                      >
                        <svg className="w-3.5 h-3.5 text-white/30 hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {completed.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-1">Completed</p>
                  {completed.map(r => (
                    <div key={r.id} className="glass rounded-xl p-3.5 flex items-start gap-3 opacity-40 hover:opacity-60 transition-opacity">
                      <button
                        onClick={() => onToggleComplete(r.id)}
                        className="mt-0.5 w-5 h-5 rounded-full bg-violet-500/60 flex items-center justify-center shrink-0"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <p className="text-sm line-through flex-1 text-white/40">{r.text}</p>
                      <button
                        onClick={() => onDelete(r.id)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition shrink-0"
                      >
                        <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
