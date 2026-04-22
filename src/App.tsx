import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Reminder, Mood, DailyProgress, StudyMode, QuizResult, StudyNote } from './types';
import { ProfilePanel } from './components/ProfilePanel';
import { VideoCall } from './components/VideoCall';
import { SettingsModal } from './components/SettingsModal';
import { MessageBubble } from './components/MessageBubble';
import { QuizMode } from './components/QuizMode';
import { NotesPanel } from './components/NotesPanel';
import { sendToAIStreaming, generateDailyReport, extractReminders, extractTopic } from './services/gemini';
import { playSend, playReceive, playError, playReminder } from './utils/sounds';
import { cleanForSpeech } from './utils/speech';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// ─── Helpers ───────────────────────────────────────────────────────
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CHAT_KEY = 'aria_messages';
const MODEL_KEY = 'aria_model';
const API_KEY_STORE = 'aria_api_key';
const REMINDERS_KEY = 'aria_reminders';
const LAST_SEEN_KEY = 'aria_last_seen';

const DAILY_KEY = 'aria_daily_progress';
const REPORT_TIME = 21; // 9 PM

const IS_NATIVE = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:'
);

const SUGGESTIONS = [
  { icon: '📝', text: 'Start a JEE Mains Quiz' },
  { icon: '🔥', text: 'JEE Advanced Quiz on Calculus' },
  { icon: '📒', text: 'Generate short notes on Thermodynamics' },
  { icon: '📸', text: 'Upload a photo of your math problem' },
  { icon: '🧮', text: 'Teach me integration by parts' },
  { icon: '🧪', text: 'Balance: Fe₂O₃ + HCl → FeCl₃ + H₂O' },
  { icon: '⏰', text: 'Remind me to study in 1 hour' },
  { icon: '📊', text: 'Show me my daily progress report' },
  ...(IS_NATIVE ? [
    { icon: '⚙️', text: 'Show my systemd failed services' },
    { icon: '🎵', text: 'Send me an audio note' },
  ] : []),
];

// ─── Resize image helper ──────────────────────────────────────
function resizeImage(dataUrl: string, maxDim = 1280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) { resolve(dataUrl); return; }
      if (width > height) { height = (height / width) * maxDim; width = maxDim; }
      else { width = (width / height) * maxDim; height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  // ── State ──
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [input, setInput] = useState('');
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) || 'openai');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORE) || '');
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try { return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]'); }
    catch { return []; }
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [mood, setMood] = useState<Mood>('happy');
  const [showProfile, setShowProfile] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('aria_sound') !== 'off');
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('aria_autospeak') !== 'off');
  const [studyMode, setStudyMode] = useState<StudyMode>(() => (localStorage.getItem('aria_study_mode') || 'strict') as StudyMode);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>(() => {
    try { return JSON.parse(localStorage.getItem('aria_quiz_results') || '[]'); }
    catch { return []; }
  });
  const [savedNotes, setSavedNotes] = useState<StudyNote[]>(() => {
    try { return JSON.parse(localStorage.getItem('aria_notes') || '[]'); }
    catch { return []; }
  });

  // File upload state
  const [pendingFile, setPendingFile] = useState<{
    dataUrl: string;
    name: string;
    type: 'image' | 'audio' | 'text' | 'document';
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Daily progress state
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(() => {
    try {
      const saved = localStorage.getItem(DAILY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { date: todayStr(), topics: [], messageCount: 0, questionsAsked: 0, lastReportDate: '', streak: 0 };
  });

  // ── Refs ──
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const messagesRef = useRef<Message[]>(messages);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dailyCheckedRef = useRef<string>('');

  // Sound helper
  const snd = useCallback((fn: () => void) => { if (soundEnabled) fn(); }, [soundEnabled]);

  // Persist preferences
  useEffect(() => { localStorage.setItem('aria_sound', soundEnabled ? 'on' : 'off'); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('aria_autospeak', autoSpeak ? 'on' : 'off'); }, [autoSpeak]);
  useEffect(() => { localStorage.setItem('aria_study_mode', studyMode); }, [studyMode]);
  useEffect(() => { localStorage.setItem(API_KEY_STORE, apiKey); }, [apiKey]);

  // ── Export chat as Markdown ──
  const exportChat = useCallback(() => {
    const lines: string[] = [`# Aria Chat Export`, `*Exported on ${new Date().toLocaleString()}*`, ''];
    for (const m of messages) {
      const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const who = m.role === 'user' ? '🧑 You' : '👩‍🏫 Aria';
      if (m.isDailyReport) {
        lines.push(`---`, `### 📊 Daily Progress Report — ${time}`, '', m.content, '');
      } else {
        lines.push(`**${who}** *${time}*`, '', m.content, '');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aria-chat-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  // Keep ref in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Persist chat ──
  useEffect(() => {
    const nonWelcome = messages.filter(m => !m.id.startsWith('welcome'));
    if (nonWelcome.length > 0 || messages.length > 1) {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // ── Persist reminders ──
  useEffect(() => { localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)); }, [reminders]);

  // ── Persist model choice ──
  useEffect(() => { localStorage.setItem(MODEL_KEY, model); }, [model]);

  // ── Persist daily progress ──
  useEffect(() => { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyProgress)); }, [dailyProgress]);

  // ── Persist quiz results ──
  useEffect(() => { localStorage.setItem('aria_quiz_results', JSON.stringify(quizResults)); }, [quizResults]);

  // ── Persist notes ──
  useEffect(() => { localStorage.setItem('aria_notes', JSON.stringify(savedNotes)); }, [savedNotes]);

  // ── Reset daily progress on new day ──
  useEffect(() => {
    const today = todayStr();
    if (dailyProgress.date !== today) {
      const lastDate = new Date(dailyProgress.date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
      const newStreak = diffDays === 1 ? dailyProgress.streak + 1 : (diffDays === 0 ? dailyProgress.streak : 1);

      setDailyProgress({
        date: today,
        topics: [],
        messageCount: 0,
        questionsAsked: 0,
        lastReportDate: dailyProgress.lastReportDate,
        streak: newStreak,
      });
    }
  }, []);

  // ── Check speech API support ──
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
    if (window.speechSynthesis) {
      const load = () => {
        voicesRef.current = window.speechSynthesis.getVoices();
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  // ── Welcome message ──
  useEffect(() => {
    if (messages.length > 0) return;

    const h = new Date().getHours();
    const greeting = h < 5 ? 'Hey, night owl' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Hey there';

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `${greeting}! 💜 I'm **Aria**, your personal AI teacher and companion.\n\nI'm here to help you learn — fast. I teach **concepts, not calculations**. Give me a problem, I'll give you the key idea and the answer. No fluff.\n\n**What I can do:**\n- 📝 **JEE Quizzes** — Mains & Advanced style MCQs with timer\n- 📒 **Short Notes** — exam-ready revision notes on any topic\n- 📸 Send photos of problems → I'll solve them\n- 🎤 Voice input → just speak\n- 🧮 PCM — concepts & shortcuts, not tedious steps\n- 🐧 Arch Linux — copy-paste commands\n- ⏰ Reminders → I'll keep you on track\n- 📊 Daily Reports → track your progress\n\n*You know the answer? Great, I'll confirm it and move on. Shortcuts? I love 'em. Let's go!* 🚀`,
      timestamp: Date.now(),
    }]);
  }, []);

  // ── Auto-scroll ──
  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages, isThinking, streamingText]);

  // ── Request notification permission ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Speak ── (uses cleanForSpeech to strip LaTeX, markdown, emojis)
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = cleanForSpeech(text);
    if (!clean) return;

    const utt = new SpeechSynthesisUtterance(clean);
    const voices = voicesRef.current;
    const female = voices.find(v =>
      /female|samantha|zira|karen|victoria|fiona|moira|tessa/i.test(v.name)
    ) || voices.find(v => v.lang === 'en-US' && /female/i.test(v.name))
      || voices.find(v => v.lang.startsWith('en'));

    if (female) utt.voice = female;
    utt.pitch = 1.12;
    utt.rate = 1.0;
    utt.onstart = () => { setIsSpeaking(true); setMood('speaking'); };
    utt.onend = () => { setIsSpeaking(false); setMood('happy'); };
    utt.onerror = () => { setIsSpeaking(false); };
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Check reminders every 30s ──
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setReminders(prev => prev.map(r => {
        if (!r.completed && !r.notified && r.time <= now) {
          try {
            if (Notification.permission === 'granted') {
              new Notification('🔔 Aria Reminder', { body: r.text, icon: '/avatar.png' });
            }
          } catch {}
          speak(`Hey! This is your teacher speaking. Reminder: ${r.text}. No excuses, get to it!`);
          snd(playReminder);
          return { ...r, notified: true };
        }
        return r;
      }));
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [speak, snd]);

  // ── "Miss you" feature ──
  useEffect(() => {
    const last = localStorage.getItem(LAST_SEEN_KEY);
    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY, now.toString());
    if (last) {
      const hours = (now - parseInt(last)) / 3_600_000;
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeout(() => {
          speak(`Hey! Your teacher missed you! It's been ${days} day${days > 1 ? 's' : ''}. I hope you've been studying!`);
          setMessages(prev => [...prev, {
            id: uid('miss'),
            role: 'assistant',
            content: `Hey! I missed you! 💜 It's been **${days} day${days > 1 ? 's' : ''}** since we last talked.\n\nI hope you've been keeping up with your studies! If not... we have some catching up to do, young one. 😤📚\n\nTell me, what have you been working on?`,
            timestamp: Date.now(),
          }]);
        }, 2000);
      }
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  //  DAILY PROGRESS REPORT ENGINE
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const checkDailyReport = () => {
      const now = new Date();
      const today = todayStr();
      if (now.getHours() !== REPORT_TIME) return;
      if (dailyCheckedRef.current === today) return;
      if (dailyProgress.messageCount < 3) return;
      dailyCheckedRef.current = today;
      triggerDailyReport();
    };
    const id = setInterval(checkDailyReport, 60000);
    checkDailyReport();
    return () => clearInterval(id);
  }, [dailyProgress.messageCount]);

  const triggerDailyReport = useCallback(async () => {
    setIsThinking(true);
    setMood('thinking');

    try {
      const report = await generateDailyReport({
        topics: dailyProgress.topics,
        messageCount: dailyProgress.messageCount,
        questionsAsked: dailyProgress.questionsAsked,
        streak: dailyProgress.streak,
        date: new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      }, model, apiKey);

      setMessages(prev => [...prev, {
        id: uid('daily'),
        role: 'assistant',
        content: report,
        timestamp: Date.now(),
        isDailyReport: true,
      }]);

      setDailyProgress(prev => ({ ...prev, lastReportDate: todayStr() }));

      try {
        if (Notification.permission === 'granted') {
          new Notification('📊 Daily Progress Report from Aria', {
            body: 'Your teacher has prepared your daily progress report. Come check it!',
            icon: '/avatar.png',
          });
        }
      } catch {}

      setTimeout(() => speak('Hey! Your daily progress report is ready. Come take a look!'), 200);
    } catch (err: any) {
      console.error('Daily report failed:', err);
    } finally {
      setIsThinking(false);
      setMood('happy');
    }
  }, [model, dailyProgress, speak]);

  const handleManualReport = useCallback(async () => {
    if (dailyProgress.messageCount < 1) {
      setMessages(prev => [...prev, {
        id: uid('a'),
        role: 'assistant',
        content: "Hmm, we haven't really talked much today! Come chat with me first, then I'll have something to report. 📚",
        timestamp: Date.now(),
      }]);
      return;
    }
    await triggerDailyReport();
  }, [triggerDailyReport, dailyProgress.messageCount]);

  // ═══════════════════════════════════════════════════════════════
  //  FILE HANDLING
  // ═══════════════════════════════════════════════════════════════
  const handleFileSelect = useCallback(async (file: File) => {
    const mimeType = file.type;
    const name = file.name;

    let fileType: 'image' | 'audio' | 'text' | 'document' = 'document';

    if (mimeType.startsWith('image/')) {
      fileType = 'image';
    } else if (mimeType.startsWith('audio/')) {
      fileType = 'audio';
    } else if (
      mimeType.startsWith('text/') ||
      /\.(py|js|ts|jsx|tsx|c|cpp|h|java|rb|rs|go|sh|bash|zsh|json|yaml|yml|toml|md|csv|html|css|sql|xml)$/i.test(name)
    ) {
      fileType = 'text';
    }

    if (fileType === 'image') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const resized = await resizeImage(dataUrl);
        setPendingFile({ dataUrl: resized, name, type: fileType });
      };
      reader.readAsDataURL(file);
    } else if (fileType === 'audio') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPendingFile({ dataUrl, name, type: fileType });
      };
      reader.readAsDataURL(file);
    } else if (fileType === 'text') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setInput(`[File: ${name}]\n\`\`\`\n${text.slice(0, 3000)}${text.length > 3000 ? '\n... (truncated)' : ''}\n\`\`\`\n\n`);
        setPendingFile({ dataUrl: '', name, type: fileType });
      };
      reader.readAsText(file);
    } else {
      setPendingFile({ dataUrl: '', name, type: fileType });
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // ═══════════════════════════════════════════════════════════════
  //  SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════
  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !pendingFile) return;
    if (isThinking) return;

    // Check for quiz/notes commands
    if (/^(start|give|make|create|generate)\s+(a\s+)?(quiz|test|mcq)/i.test(trimmed) || /jee.*(quiz|test|mcq)/i.test(trimmed)) {
      setShowQuiz(true);
      return;
    }
    if (/^(generate|make|create|give)\s+(short\s+)?notes/i.test(trimmed) || /short\s*notes/i.test(trimmed)) {
      setShowNotes(true);
      return;
    }

    // Check for manual report trigger
    if (/show.*daily.*report|daily.*progress|my.*progress.*report|how.*am.*i.*doing/i.test(trimmed)) {
      setMessages(prev => [...prev, {
        id: uid('u'),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      }]);
      setInput('');
      setPendingFile(null);
      await handleManualReport();
      return;
    }

    const userMsg: Message = {
      id: uid('u'),
      role: 'user',
      content: trimmed || (pendingFile?.type === 'image' ? '(Sent an image)' : '(Sent a file)'),
      timestamp: Date.now(),
      imageData: pendingFile?.type === 'image' ? pendingFile.dataUrl : undefined,
      fileName: pendingFile?.name,
      fileType: pendingFile?.type,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingFile(null);
    setIsThinking(true);
    setMood('thinking');
    setShowSuggestions(false);
    snd(playSend);

    // Update daily progress tracking
    const topic = extractTopic(trimmed);
    setDailyProgress(prev => ({
      ...prev,
      messageCount: prev.messageCount + 1,
      questionsAsked: prev.questionsAsked + 1,
      topics: topic && !prev.topics.includes(topic) ? [...prev.topics, topic] : prev.topics,
    }));

    try {
      const currentMessages = messagesRef.current.filter(m => !m.id.startsWith('welcome') && !m.id.startsWith('miss') && !m.id.startsWith('daily'));

      // ── Streaming response ──
      setStreamingText('');
      const raw = await sendToAIStreaming(
        currentMessages,
        trimmed || (pendingFile?.type === 'image' ? 'Please analyze this image carefully. What do you see? Explain in detail.' : 'Please help me with this file.'),
        model,
        studyMode,
        (partialText: string) => {
          setStreamingText(partialText);
        },
        userMsg.imageData,
        userMsg.fileType,
        userMsg.fileName,
        apiKey,
      );
      setStreamingText(null);

      const { cleanText, reminders: extracted } = extractReminders(raw);

      const assistantMsg: Message = { id: uid('a'), role: 'assistant', content: cleanText, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      setIsThinking(false);
      snd(playReceive);

      // Detect teacher mood from response
      if (/strict|disappointed|no shortcut|don't skip|you need to|homework|practice/i.test(cleanText)) {
        setMood('strict');
      } else if (/proud|excellent|perfect|great job|amazing/i.test(cleanText)) {
        setMood('excited');
      } else {
        setMood('happy');
      }

      // Update daily progress for assistant message
      setDailyProgress(prev => ({
        ...prev,
        messageCount: prev.messageCount + 1,
      }));

      if (extracted.length > 0) {
        setReminders(prev => [
          ...prev,
          ...extracted.map(r => ({
            id: uid('r'),
            text: r.text,
            time: new Date(r.time).getTime() || Date.now() + 3_600_000,
            completed: false,
            createdAt: Date.now(),
            notified: false,
          })),
        ]);
      }

      if (autoSpeak) setTimeout(() => speak(cleanText), 150);
    } catch (err: any) {
      setStreamingText(null);
      setIsThinking(false);
      setMood('concerned');
      snd(playError);
      setMessages(prev => [...prev, {
        id: uid('e'),
        role: 'assistant',
        content: `Hmm, something went wrong: ${err.message}. Don't worry, try again — your teacher isn't going anywhere! 😤`,
        timestamp: Date.now(),
      }]);
    }
  }, [isThinking, speak, model, pendingFile, handleManualReport, snd]);

  // ── Voice input ──
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setInput(transcript);
      if (e.results[0]?.isFinal) {
        setIsListening(false);
        setMood('happy');
        handleSend(transcript);
      }
    };

    rec.onerror = () => { setIsListening(false); setMood('neutral'); };
    rec.onend = () => { setIsListening(false); };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setMood('listening');
  }, [isListening, handleSend]);

  // ── Reminder actions ──
  const toggleReminder = useCallback((id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
  }, []);
  const deleteReminder = useCallback((id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  // ── Clear chat ──
  const clearChat = useCallback(() => {
    localStorage.removeItem(CHAT_KEY);
    setMessages([]);
    setShowSuggestions(true);
    setStreamingText(null);
    setTimeout(() => {
      const h = new Date().getHours();
      const greeting = h < 5 ? 'Hey, night owl' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Hey there';
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `${greeting}! 💜 Fresh start! I'm **Aria**. What are we working on?`,
        timestamp: Date.now(),
      }]);
    }, 100);
  }, []);

  // ── Quiz & Notes handlers ──
  const handleSaveQuizResult = useCallback((result: QuizResult) => {
    setQuizResults(prev => [result, ...prev]);
  }, []);

  const handleSaveNote = useCallback((note: StudyNote) => {
    setSavedNotes(prev => [note, ...prev]);
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setSavedNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showProfile) { setShowProfile(false); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (showVideoCall) { setShowVideoCall(false); return; }
      }
      if (e.key === '?' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        clearChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        handleManualReport();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        setShowQuiz(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showShortcuts, showProfile, showSettings, showVideoCall, clearChat, exportChat, handleManualReport]);

  // ── Derived ──
  const statusText = isThinking ? 'Thinking...' : isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Online';

  // ═══════════════════════════════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col bg-[#07070f] text-white overflow-hidden relative">

      {/* ── Background effects ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-violet-700/[0.07] rounded-full blur-[120px] animate-slow-drift" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-pink-700/[0.07] rounded-full blur-[120px] animate-slow-drift-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-700/[0.04] rounded-full blur-[100px]" />
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/[0.08] animate-twinkle"
            style={{
              width: `${1 + Math.random() * 1.5}px`,
              height: `${1 + Math.random() * 1.5}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* ── Header ── */}
      <header className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-3 glass">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setShowProfile(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold shadow-lg shadow-violet-500/15 overflow-hidden hover:shadow-violet-500/30 hover:scale-105 transition-all duration-200 ring-2 ring-transparent hover:ring-violet-500/30"
            title="View Aria's profile"
          >
            <img src="/avatar.png" alt="" className="w-full h-full rounded-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
          </button>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold gradient-text header-title">Aria</h1>
              {IS_NATIVE && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400/80">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  🐧 Native
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/30">Your AI Teacher · Strict & Loving 💜</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-white/[0.06]">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-amber-400 animate-pulse' : isSpeaking ? 'bg-violet-400 animate-pulse' : isListening ? 'bg-cyan-400 animate-pulse' : mood === 'strict' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="text-[12px] text-white/30">{statusText}</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              studyMode === 'strict' ? 'bg-violet-500/15 text-violet-400/70 border border-violet-500/20' :
              studyMode === 'casual' ? 'bg-cyan-500/15 text-cyan-400/70 border border-cyan-500/20' :
              'bg-amber-500/15 text-amber-400/70 border border-amber-500/20'
            }`}>
              {studyMode === 'strict' ? '👩‍🏫 Strict' : studyMode === 'casual' ? '💜 Casual' : '⚡ Exam'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Stop speaking */}
          {isSpeaking && (
            <button
              onClick={() => { if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); setMood('happy'); } }}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-colors group"
              title="Stop speaking"
            >
              <svg className="w-[18px] h-[18px] text-violet-400 group-hover:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
            </button>
          )}
          {/* Daily report */}
          <button
            onClick={handleManualReport}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
            title="Daily Progress Report"
          >
            <svg className="w-[18px] h-[18px] text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </button>
          {/* New chat */}
          <button onClick={clearChat} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors" title="New chat">
            <svg className="w-[18px] h-[18px] text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {/* Video Call */}
          <button
            onClick={() => setShowVideoCall(true)}
            className="relative p-2.5 hover:bg-white/10 rounded-xl transition-colors group"
            title="Video Call with Aria"
          >
            <svg className="w-[18px] h-[18px] text-white/40 group-hover:text-emerald-400/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>
          {/* Quiz button */}
          <button
            onClick={() => setShowQuiz(true)}
            className="relative p-2.5 hover:bg-white/10 rounded-xl transition-colors group"
            title="JEE Quiz Mode"
          >
            <svg className="w-[18px] h-[18px] text-white/40 group-hover:text-amber-400/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </button>
          {/* Notes button */}
          <button
            onClick={() => setShowNotes(true)}
            className="relative p-2.5 hover:bg-white/10 rounded-xl transition-colors group"
            title="Short Notes"
          >
            <svg className="w-[18px] h-[18px] text-white/40 group-hover:text-emerald-400/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {savedNotes.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-[8px] font-bold text-white flex items-center justify-center">{savedNotes.length}</span>
            )}
          </button>
          {/* Auto-speak toggle */}
          <button
            onClick={() => setAutoSpeak(prev => !prev)}
            className={`p-2.5 hover:bg-white/10 rounded-xl transition-colors ${autoSpeak ? '' : 'opacity-40'}`}
            title={autoSpeak ? 'Auto-read: ON (click to mute voice)' : 'Auto-read: OFF (click to enable)'}
          >
            {autoSpeak ? (
              <svg className="w-[18px] h-[18px] text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px] text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </button>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? (
              <svg className="w-[18px] h-[18px] text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px] text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </button>
          {/* Export chat */}
          {messages.length > 0 && (
            <button onClick={exportChat} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors" title="Export chat (Ctrl+E)">
              <svg className="w-[18px] h-[18px] text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          )}
          {/* Quick mode toggle */}
          <button
            onClick={() => setStudyMode(prev => prev === 'strict' ? 'casual' : prev === 'casual' ? 'exam' : 'strict')}
            className={`p-2.5 hover:bg-white/10 rounded-xl transition-colors ${
              studyMode === 'strict' ? 'text-violet-400/60' : studyMode === 'casual' ? 'text-cyan-400/60' : 'text-amber-400/60'
            }`}
            title={`Study mode: ${studyMode === 'strict' ? 'Strict Teacher' : studyMode === 'casual' ? 'Casual Friend' : 'Exam Prep'} (click to switch)`}
          >
            {studyMode === 'strict' ? '👩‍🏫' : studyMode === 'casual' ? '💜' : '⚡'}
          </button>
          {/* Settings */}
          <button onClick={() => setShowSettings(true)} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors" title="Settings">
            <svg className="w-[18px] h-[18px] text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0 relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag & drop overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-violet-600/10 backdrop-blur-sm border-2 border-dashed border-violet-500/40 rounded-xl m-2 animate-fade-in">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-bounce">📎</div>
                <p className="text-lg font-semibold text-violet-300">Drop your file here</p>
                <p className="text-[14px] text-white/40 mt-1">Images, audio, text files — I'll handle it!</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto chat-scroll px-4 sm:px-8 py-5 space-y-4">
            <div className="chat-container">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Typing indicator */}
            {isThinking && !streamingText && (
              <div className="flex justify-start animate-slide-up">
                <div className="glass px-5 py-4 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 bg-violet-400/70 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                    <span className="text-[13px] text-white/20 ml-2">Aria is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="flex justify-start animate-slide-up">
                <div className="glass max-w-[90%] sm:max-w-[80%] md:max-w-[72%] px-5 py-3.5 rounded-2xl rounded-bl-md">
                  <p className="text-[11px] font-semibold text-violet-400/40 mb-1.5">Aria</p>
                  <div className="prose-content msg-text streaming-text">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ className, children, ...props }) {
                          const isInline = !className && typeof children === 'string' && !String(children).includes('\n');
                          if (isInline) {
                            return <code className="px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300 text-[13px] font-['Fira_Code',monospace]" {...props}>{children}</code>;
                          }
                          return <pre className="overflow-x-auto rounded-xl p-4 pt-8 text-[13px] font-['Fira_Code',monospace] leading-relaxed bg-black/40 border border-white/[0.04] my-3 relative"><code className={className}>{children}</code></pre>;
                        },
                        pre({ children }) { return <>{children}</>; },
                      }}
                    >
                      {streamingText}
                    </ReactMarkdown>
                    <span className="inline-block w-[6px] h-[18px] bg-violet-400/80 ml-0.5 animate-cursor-blink rounded-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* Quick reply chips after last AI message */}
            {!isThinking && !streamingText && messages.length > 1 && (() => {
              const last = messages[messages.length - 1];
              if (last?.role !== 'assistant' || last.id.startsWith('daily') || last.id.startsWith('miss')) return null;
              const quickReplies = [
                { icon: '💡', text: 'Explain differently', action: 'Can you explain that in a different way?' },
                { icon: '📝', text: 'Practice problem', action: 'Give me a practice problem on this topic.' },
                { icon: '⚡', text: 'Quick recap', action: 'Give me a one-line recap of the key concept.' },
              ];
              return (
                <div className="animate-slide-up pt-1 pb-2">
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(qr.action)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-violet-500/10 hover:border-violet-500/20 text-[12px] text-white/30 hover:text-white/60 transition-all duration-200"
                      >
                        <span>{qr.icon}</span>
                        <span>{qr.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Suggestion chips */}
            {showSuggestions && messages.length <= 1 && !isThinking && (
              <div className="animate-slide-up pt-2">
                <p className="text-[12px] text-white/20 mb-3 font-medium">Try asking:</p>
                <div className="flex flex-wrap gap-2.5">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (s.text.includes('photo') || s.text.includes('audio')) {
                          fileInputRef.current?.click();
                        } else if (/quiz/i.test(s.text)) {
                          setShowQuiz(true);
                        } else if (/short notes|generate.*notes/i.test(s.text)) {
                          setShowNotes(true);
                        } else {
                          handleSend(s.text);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-violet-500/10 hover:border-violet-500/20 text-[13px] text-white/40 hover:text-white/70 transition-all duration-200"
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className="max-w-[200px] truncate">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
            </div>
          </div>

          {/* ── Pending file preview ── */}
          {pendingFile && (
            <div className="px-4 sm:px-8 py-2 border-t border-white/[0.04] animate-slide-up">
              <div className="flex items-center gap-3 chat-container">
                {pendingFile.type === 'image' && pendingFile.dataUrl && (
                  <img src={pendingFile.dataUrl} alt="Preview" className="h-14 w-14 object-cover rounded-xl border border-white/10" />
                )}
                {pendingFile.type === 'audio' && (
                  <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/15 text-2xl">🎵</div>
                )}
                {pendingFile.type === 'text' && (
                  <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-2xl">📄</div>
                )}
                {pendingFile.type === 'document' && (
                  <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15 text-2xl">📋</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/60 font-medium truncate">{pendingFile.name}</p>
                  <p className="text-[11px] text-white/25">
                    {pendingFile.type === 'image' ? 'Image ready to send' :
                     pendingFile.type === 'audio' ? 'Audio file ready' :
                     pendingFile.type === 'text' ? 'Code file loaded below' : 'File attached'}
                  </p>
                </div>
                <button
                  onClick={() => setPendingFile(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/30 hover:text-white/70"
                  title="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Input bar ── */}
          <div className="px-4 sm:px-8 py-3 glass-strong">
            <div className="flex items-center gap-2.5 chat-container">

              {/* File attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isThinking}
                className="shrink-0 p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white/80 transition-all duration-200 disabled:opacity-30"
                title="Attach file (image, audio, code)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a2.828 2.828 0 00-4-0L7.05 12.95a1.414 1.414 0 002 2l7.434-7.434a.707.707 0 00-1-1l-7.434 7.434" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.243 7.757a2.828 2.828 0 00-4 0l-4.243 4.243a2.828 2.828 0 004 4l4.243-4.243" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,.py,.js,.ts,.jsx,.tsx,.c,.cpp,.h,.java,.rb,.rs,.go,.sh,.bash,.zsh,.json,.yaml,.yml,.toml,.md,.csv,.html,.css,.sql,.xml,.txt,.pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = '';
                }}
              />

              {/* Mic button */}
              {speechSupported && (
                <button
                  onClick={toggleListening}
                  disabled={isThinking}
                  className={`shrink-0 p-3 rounded-xl transition-all duration-200 ${
                    isListening
                      ? 'bg-red-500/80 text-white shadow-lg shadow-red-500/25 scale-105'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white/80'
                  } disabled:opacity-30`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? (
                    <div className="w-5 h-5 flex items-center justify-center gap-[2px]">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className="w-[3px] bg-white rounded-full origin-bottom"
                          style={{ height: '14px', animation: 'voice-wave 0.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                </button>
              )}

              {/* Text input */}
              <input
                type="text"
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); setMood('happy'); }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder={isListening ? '🎤 Listening...' : pendingFile ? 'Add a message (optional)...' : 'Ask your teacher anything...'}
                className="chat-input flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 transition-all disabled:opacity-40"
                disabled={isThinking}
              />

              {/* Send button */}
              <button
                onClick={() => handleSend(input)}
                disabled={(!input.trim() && !pendingFile) || isThinking}
                className="shrink-0 p-3 bg-gradient-to-r from-violet-600 to-pink-600 rounded-xl hover:shadow-lg hover:shadow-violet-500/20 disabled:opacity-20 disabled:shadow-none transition-all duration-200 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Overlays ── */}
      <ProfilePanel
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        isThinking={isThinking}
        reminders={reminders}
        onToggleComplete={toggleReminder}
        onDelete={deleteReminder}
        dailyProgress={dailyProgress}
        statusText={statusText}
        onOpenSettings={() => { setShowProfile(false); setShowSettings(true); }}
        onOpenVideoCall={() => { setShowProfile(false); setShowVideoCall(true); }}
      />

      <VideoCall
        isOpen={showVideoCall}
        onClose={() => setShowVideoCall(false)}
        model={model}
        apiKey={apiKey}
        onMoodChange={setMood}
      />

      <SettingsModal
        isOpen={showSettings}
        model={model}
        onModelChange={setModel}
        studyMode={studyMode}
        onStudyModeChange={setStudyMode}
        autoSpeak={autoSpeak}
        onAutoSpeakChange={setAutoSpeak}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        onClose={() => setShowSettings(false)}
      />

      <QuizMode
        isOpen={showQuiz}
        onClose={() => setShowQuiz(false)}
        model={model}
        apiKey={apiKey}
        onSaveResult={handleSaveQuizResult}
      />

      <NotesPanel
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
        model={model}
        apiKey={apiKey}
        notes={savedNotes}
        onSaveNote={handleSaveNote}
        onDeleteNote={handleDeleteNote}
      />

      {/* ── Keyboard Shortcuts Overlay ── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 bg-[#12121f] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold gradient-text">⌨️ Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white/60">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              {[
                ['↵ Enter', 'Send message'],
                ['Esc', 'Close panel / overlay'],
                ['?', 'Show this shortcuts panel'],
                ['Ctrl + N', 'Start new chat'],
                ['Ctrl + E', 'Export chat as Markdown'],
                ['Ctrl + Q', 'Open JEE Quiz'],
                ['Ctrl + Shift + R', 'Daily progress report'],
                ['🎤 Mic button', 'Voice input'],
                ['📎 Attach button', 'Upload image / audio / file'],
                ['📞 Video button', 'Video call with Aria'],
                ['📝 Quiz button', 'JEE Mains / Advanced Quiz'],
                ['📒 Notes button', 'Generate Short Notes'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-white/50">{desc}</span>
                  <kbd className="px-2.5 py-1 bg-white/[0.06] border border-white/[0.1] rounded-lg text-[12px] text-violet-300 font-mono whitespace-nowrap">{key}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/20 mt-5 text-center">Press <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[10px]">?</kbd> or <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[10px]">Esc</kbd> to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
