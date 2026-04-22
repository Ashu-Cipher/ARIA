import { type StudyMode } from '../types';

interface Props {
  isOpen: boolean;
  model: string;
  onModelChange: (model: string) => void;
  studyMode: StudyMode;
  onStudyModeChange: (mode: StudyMode) => void;
  autoSpeak: boolean;
  onAutoSpeakChange: (v: boolean) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onClose: () => void;
}

const MODELS = [
  { id: 'openai', name: 'GPT-OSS 20B', desc: 'Reasoning model · Best for anonymous · Recommended', badge: '🏆', tier: 'free' },
  { id: 'openai-fast', name: 'GPT-OSS Fast', desc: 'Same model · Faster responses', badge: '⚡', tier: 'free' },
  { id: 'openai-large', name: 'GPT Large', desc: 'Larger model · Better for complex tasks', badge: '🧠', tier: 'free' },
  { id: 'mistral', name: 'Mistral', desc: 'European model · Strong analysis', badge: '🎭', tier: 'free' },
  { id: 'mistral-large', name: 'Mistral Large', desc: 'Most capable Mistral model', badge: '💜', tier: 'free' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'Open source · Great at code & math', badge: '🔍', tier: 'free' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', desc: 'Reasoning model · Good for JEE prep', badge: '🧮', tier: 'free' },
  { id: 'gemini', name: 'Gemini', desc: 'Google model · Great at science & LaTeX', badge: '🔮', tier: 'free' },
  { id: 'qwen-coder', name: 'Qwen Coder', desc: 'Specialized for programming', badge: '💻', tier: 'free' },
  { id: 'searchgpt', name: 'SearchGPT', desc: 'Web search + AI · Up to date info', badge: '🌐', tier: 'free' },
];

const STUDY_MODES: { id: StudyMode; name: string; desc: string; icon: string; color: string }[] = [
  { id: 'strict', name: 'Strict Teacher', desc: 'Firm but loving · Pushes you to think', icon: '👩‍🏫', color: 'from-violet-500 to-pink-500' },
  { id: 'casual', name: 'Casual Friend', desc: 'Chill & friendly · Quick answers', icon: '💜', color: 'from-cyan-500 to-blue-500' },
  { id: 'exam', name: 'Exam Prep', desc: 'Speed & accuracy · Mnemonics & tricks', icon: '⚡', color: 'from-amber-500 to-orange-500' },
];

export function SettingsModal({ isOpen, model, onModelChange, studyMode, onStudyModeChange, autoSpeak, onAutoSpeakChange, apiKey, onApiKeyChange, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="relative rounded-2xl p-6 sm:p-8 w-full max-w-lg animate-slide-up max-h-[90vh] overflow-y-auto chat-scroll"
        style={{ background: 'rgba(20, 20, 40, 0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-violet-500 to-pink-500 flex items-center justify-center mb-3 shadow-lg shadow-violet-500/20">
            <span className="text-2xl">🌸</span>
          </div>
          <h2 className="text-xl font-bold gradient-text">Aria Settings</h2>
          <p className="text-xs text-white/30 mt-1">Powered by Pollinations AI · gen.pollinations.ai</p>
        </div>

        {/* API Key */}
        <div className="mb-6">
          <label className="text-sm text-white/50 block mb-2 font-medium flex items-center gap-2">
            <span>🔑</span> Pollinations API Key
            {apiKey && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">✓ Connected</span>}
            {!apiKey && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Anonymous</span>}
          </label>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={e => onApiKeyChange(e.target.value)}
              placeholder="sk_... or pk_... (from enter.pollinations.ai)"
              className="w-full rounded-xl px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors pr-10"
            />
            {apiKey && (
              <button
                onClick={() => onApiKeyChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-red-400 transition-colors"
                title="Clear API key"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-[11px] text-white/25 mt-1.5 leading-relaxed">
            {apiKey ? (
              <>Secret key (<code className="text-white/40">sk_</code>): No rate limits, all models. Key saved locally.</>
            ) : (
              <>No key? Aria works <span className="text-white/40">free</span> with rate limits. Get a key at{' '}
              <a href="https://enter.pollinations.ai" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline underline-offset-2">enter.pollinations.ai</a> for unlimited access.</>
            )}
          </p>
        </div>

        {/* Study Mode */}
        <div className="mb-6">
          <label className="text-sm text-white/50 block mb-3 font-medium">Study Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {STUDY_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => onStudyModeChange(m.id)}
                className={`text-center px-3 py-3 rounded-xl transition-all duration-200 border ${
                  studyMode === m.id
                    ? `bg-gradient-to-br ${m.color} bg-opacity-20 border-white/20 shadow-lg`
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                }`}
              >
                <div className="text-xl mb-1">{m.icon}</div>
                <p className={`text-[12px] font-semibold ${studyMode === m.id ? 'text-white' : 'text-white/60'}`}>{m.name}</p>
                <p className="text-[10px] text-white/25 mt-0.5 leading-tight">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="mb-6">
          <label className="text-sm text-white/50 block mb-3 font-medium">Preferences</label>
          <div className="space-y-2">
            {/* Auto-speak */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div>
                <p className="text-sm text-white/70 font-medium">🔊 Auto-read responses</p>
                <p className="text-[11px] text-white/25">Aria speaks every response aloud</p>
              </div>
              <button
                onClick={() => onAutoSpeakChange(!autoSpeak)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoSpeak ? 'bg-violet-500' : 'bg-white/10'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${autoSpeak ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="text-sm text-white/50 block mb-3 font-medium">AI Model</label>
          <div className="space-y-2">
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => onModelChange(m.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  model === m.id
                    ? 'bg-violet-500/20 border border-violet-500/40 shadow-lg shadow-violet-500/10'
                    : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <span className="text-lg">{m.badge}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${model === m.id ? 'text-violet-300' : 'text-white/70'}`}>{m.name}</p>
                  <p className="text-[11px] text-white/30">{m.desc}</p>
                </div>
                {model === m.id && (
                  <div className="w-2 h-2 rounded-full bg-violet-400 shadow-lg shadow-violet-400/50" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-gradient-to-br from-violet-500/5 to-pink-500/5 border border-violet-500/10 p-4 space-y-2">
          <p className="text-[12px] text-white/30 leading-relaxed">
            🌸 <span className="text-white/50 font-medium">How it works:</span> Powered by Pollinations AI — completely free, no API key needed. Auto-retries on errors and falls back to the default model if one is unavailable.
          </p>
          <p className="text-[12px] text-white/30 leading-relaxed">
            ⚡ <span className="text-white/50 font-medium">Rate limit:</span> ~1 request per 15 seconds for anonymous users. Aria queues your requests automatically.
          </p>
          <p className="text-[12px] text-white/30 leading-relaxed">
            ⌨️ Press <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[10px] text-violet-300">?</kbd> for keyboard shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}
