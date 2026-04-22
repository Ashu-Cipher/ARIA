import { useState, useEffect, useCallback, useRef } from 'react';
import { QuizSession, QuizResult } from '../types';
import { generateQuiz } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  model: string;
  onSaveResult: (result: QuizResult) => void;
}

const TOPICS = [
  { category: 'Physics', items: ['Mechanics', 'Thermodynamics', 'Electrostatics', 'Optics', 'Modern Physics', 'Waves & Sound', 'Magnetism', 'Fluid Mechanics'] },
  { category: 'Chemistry', items: ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Coordination Compounds', 'Chemical Bonding', 'Thermodynamics & Kinetics', 'Electrochemistry', 'Periodic Table'] },
  { category: 'Mathematics', items: ['Calculus', 'Algebra', 'Trigonometry', 'Coordinate Geometry', 'Vectors & 3D', 'Probability & Statistics', 'Matrices & Determinants', 'Complex Numbers'] },
];

export function QuizMode({ isOpen, onClose, model, onSaveResult }: Props) {
  const [phase, setPhase] = useState<'setup' | 'loading' | 'active' | 'review'>('setup');
  const [quizType, setQuizType] = useState<'jee-mains' | 'jee-advanced' | 'topic'>('jee-mains');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Timer
  useEffect(() => {
    if (phase !== 'active' || !session) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — auto-submit null
          setSelectedAnswer(null);
          setShowExplanation(true);
          setSession(s => s ? { ...s, answers: s.answers.map((a, idx) => idx === s.currentQuestion ? (a ?? null) : a) } : s);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, session?.currentQuestion]);

  const startQuiz = useCallback(async () => {
    setPhase('loading');
    try {
      const topic = selectedTopic || (quizType === 'jee-mains' ? 'JEE Mains Mixed PCM' : 'JEE Advanced Mixed PCM');
      const result = await generateQuiz(topic, quizType, questionCount, model);
      const newSession: QuizSession = {
        id: `quiz-${Date.now()}`,
        title: result.title || `Quiz: ${topic}`,
        type: quizType,
        questions: result.questions,
        answers: new Array(result.questions.length).fill(null),
        currentQuestion: 0,
        startedAt: Date.now(),
        timePerQuestion: quizType === 'jee-advanced' ? 120 : quizType === 'jee-mains' ? 90 : 60,
      };
      setSession(newSession);
      setTimeLeft(newSession.timePerQuestion);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setPhase('active');
    } catch (err: any) {
      alert('Failed to generate quiz: ' + err.message);
      setPhase('setup');
    }
  }, [selectedTopic, quizType, questionCount, model]);

  const handleAnswer = useCallback((answerIndex: number | null) => {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const newAnswers: (number | null)[] = [...session.answers];
    newAnswers[session.currentQuestion] = answerIndex;
    setSelectedAnswer(answerIndex ?? null);
    setShowExplanation(true);
    setSession(prev => prev ? { ...prev, answers: newAnswers } : prev);
  }, [session]);

  const nextQuestion = useCallback(() => {
    if (!session) return;
    if (session.currentQuestion >= session.questions.length - 1) {
      // Quiz complete
      const completed = { ...session, completedAt: Date.now() };
      setSession(completed);
      setPhase('review');
      // Save result
      const correctCount = completed.answers.filter((ans, i) =>
        ans === completed.questions[i].correctIndex).length;
      onSaveResult({
        id: completed.id,
        title: completed.title,
        type: completed.type,
        totalQuestions: completed.questions.length,
        correctAnswers: correctCount,
        timeTaken: Math.floor((Date.now() - completed.startedAt) / 1000),
        date: Date.now(),
        topics: [...new Set(completed.questions.map(q => q.topic))],
      });
      return;
    }
    setSession(prev => prev ? { ...prev, currentQuestion: prev.currentQuestion + 1 } : prev);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setTimeLeft(session.timePerQuestion);
  }, [session, onSaveResult]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!isOpen) return null;

  // ── SETUP PHASE ──
  if (phase === 'setup') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 bg-[#0e0e1a] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600/20 to-pink-600/20 px-6 py-5 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold gradient-text">📝 Quiz Mode</h2>
                <p className="text-[13px] text-white/40 mt-0.5">JEE Mains & Advanced</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Quiz type */}
            <div>
              <label className="text-[13px] font-semibold text-white/50 mb-2 block">Exam Type</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'jee-mains' as const, label: 'JEE Mains', icon: '🎯' },
                  { val: 'jee-advanced' as const, label: 'JEE Advanced', icon: '🔥' },
                  { val: 'topic' as const, label: 'Custom Topic', icon: '📌' },
                ]).map(t => (
                  <button
                    key={t.val}
                    onClick={() => setQuizType(t.val)}
                    className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                      quizType === t.val
                        ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="text-xl mb-1">{t.icon}</div>
                    <div className="text-[12px] font-medium">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic selection */}
            <div>
              <label className="text-[13px] font-semibold text-white/50 mb-2 block">Topic</label>
              <div className="max-h-48 overflow-y-auto space-y-3 chat-scroll pr-1">
                {TOPICS.map(cat => (
                  <div key={cat.category}>
                    <p className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-1.5">{cat.category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.items.map(item => (
                        <button
                          key={item}
                          onClick={() => setSelectedTopic(selectedTopic === item ? '' : item)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] transition-all duration-200 ${
                            selectedTopic === item
                              ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                              : 'bg-white/[0.03] border border-white/[0.05] text-white/35 hover:bg-white/[0.06]'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/20 mt-2">
                {selectedTopic ? `Selected: ${selectedTopic}` : quizType === 'topic' ? 'Pick a topic above' : 'Leave empty for mixed PCM'}
              </p>
            </div>

            {/* Question count */}
            <div>
              <label className="text-[13px] font-semibold text-white/50 mb-2 block">Questions: {questionCount}</label>
              <input
                type="range"
                min={3}
                max={20}
                value={questionCount}
                onChange={e => setQuestionCount(parseInt(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-1">
                <span>3 (Quick)</span>
                <span>10 (Standard)</span>
                <span>20 (Marathon)</span>
              </div>
            </div>

            <button
              onClick={startQuiz}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-pink-600 rounded-xl font-semibold text-[15px] hover:shadow-lg hover:shadow-violet-500/20 transition-all active:scale-[0.98]"
            >
              🚀 Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOADING PHASE ──
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 bg-[#0e0e1a] border border-white/[0.08] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-bold gradient-text mb-1">Generating Quiz</h3>
          <p className="text-[13px] text-white/40">Crafting {quizType === 'jee-advanced' ? 'tricky JEE Advanced' : quizType === 'jee-mains' ? 'JEE Mains' : ''} questions...</p>
          <p className="text-[11px] text-white/20 mt-2">This takes ~10 seconds</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // ── REVIEW PHASE ──
  if (phase === 'review') {
    const correct = session.answers.filter((ans, i) =>
      ans === session.questions[i].correctIndex).length;
    const total = session.questions.length;
    const pct = Math.round((correct / total) * 100);
    const timeTaken = Math.floor((Date.now() - session.startedAt) / 1000);
    const grade = pct >= 90 ? 'S' : pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D';
    const gradeColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 bg-[#0e0e1a] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-r from-violet-600/20 to-pink-600/20 px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold gradient-text">📊 Quiz Results</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto chat-scroll space-y-5">
            {/* Score card */}
            <div className="flex items-center gap-6 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className={`text-5xl font-black ${gradeColor}`}>{grade}</div>
              <div className="flex-1">
                <p className="text-2xl font-bold">{correct}/{total} <span className="text-base text-white/40">({pct}%)</span></p>
                <p className="text-[13px] text-white/40 mt-1">
                  {session.title} · {formatTime(timeTaken)} total
                </p>
                <div className="mt-2 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Question review */}
            <div className="space-y-3">
              <h3 className="text-[14px] font-semibold text-white/50">Question Review</h3>
              {session.questions.map((q, i) => {
                const userAns = session.answers[i];
                const isCorrect = userAns === q.correctIndex;
                return (
                  <div key={q.id} className={`p-4 rounded-xl border ${isCorrect ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-red-500/20 bg-red-500/[0.03]'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold ${isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white/80 msg-text">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{q.question}</ReactMarkdown>
                        </div>
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className={`text-[12px] px-3 py-1.5 rounded-lg ${
                              oi === q.correctIndex ? 'bg-emerald-500/10 text-emerald-400' :
                              oi === userAns ? 'bg-red-500/10 text-red-400 line-through' :
                              'text-white/30'
                            }`}>
                              <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</ReactMarkdown>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[12px] text-white/40 msg-text">
                          <strong className="text-violet-400/70">💡</strong>{' '}
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{q.explanation}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-white/[0.06] flex gap-3">
            <button
              onClick={() => { setPhase('setup'); setSession(null); }}
              className="flex-1 py-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-300 font-semibold text-[14px] hover:bg-violet-500/20 transition-colors"
            >
              🔄 New Quiz
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/50 font-semibold text-[14px] hover:bg-white/[0.08] transition-colors"
            >
              Back to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE QUIZ PHASE ──
  const q = session.questions[session.currentQuestion];
  const progress = ((session.currentQuestion) / session.questions.length) * 100;
  const isLowTime = timeLeft <= 10;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative z-10 bg-[#0e0e1a] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
              session.type === 'jee-advanced' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
              session.type === 'jee-mains' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20' :
              'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
            }`}>
              {session.type === 'jee-advanced' ? '🔥 JEE Advanced' : session.type === 'jee-mains' ? '🎯 JEE Mains' : '📌 Topic Quiz'}
            </span>
            <span className="text-[12px] text-white/30">{session.title}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/[0.04]">
          <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-6 space-y-5">
          {/* Question header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-white/30">Q{session.currentQuestion + 1}/{session.questions.length}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                q.difficulty === 'hard' ? 'bg-red-500/15 text-red-400/70' :
                q.difficulty === 'easy' ? 'bg-emerald-500/15 text-emerald-400/70' :
                'bg-amber-500/15 text-amber-400/70'
              }`}>
                {q.difficulty}
              </span>
              <span className="text-[10px] text-white/20">· {q.topic}</span>
            </div>
            <div className={`flex items-center gap-1.5 text-[14px] font-mono font-bold ${isLowTime ? 'text-red-400 animate-pulse' : 'text-white/50'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Question */}
          <div className="text-[15px] text-white/90 leading-relaxed msg-text p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{q.question}</ReactMarkdown>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = i === q.correctIndex;
              let optClass = 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.06] hover:border-white/[0.1]';

              if (showExplanation) {
                if (isCorrect) optClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
                else if (isSelected && !isCorrect) optClass = 'bg-red-500/10 border-red-500/30 text-red-300';
                else optClass = 'bg-white/[0.01] border-white/[0.04] text-white/25';
              }

              return (
                <button
                  key={i}
                  onClick={() => !showExplanation && handleAnswer(i)}
                  disabled={showExplanation}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${optClass} disabled:cursor-default`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold ${
                      showExplanation && isCorrect ? 'bg-emerald-500/20 text-emerald-400' :
                      showExplanation && isSelected && !isCorrect ? 'bg-red-500/20 text-red-400' :
                      'bg-white/[0.06] text-white/40'
                    }`}>
                      {showExplanation && isCorrect ? '✓' : showExplanation && isSelected && !isCorrect ? '✗' : String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[14px] msg-text flex-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</ReactMarkdown>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && (
            <div className="p-4 rounded-xl bg-violet-500/[0.06] border border-violet-500/15 animate-slide-up">
              <p className="text-[12px] font-semibold text-violet-400/60 mb-1.5">💡 Explanation</p>
              <div className="text-[13px] text-white/70 msg-text leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{q.explanation}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Next button */}
          {showExplanation && (
            <button
              onClick={nextQuestion}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-pink-600 rounded-xl font-semibold text-[15px] hover:shadow-lg hover:shadow-violet-500/20 transition-all active:scale-[0.98]"
            >
              {session.currentQuestion >= session.questions.length - 1 ? '📊 See Results' : 'Next Question →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
