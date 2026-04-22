import { useState, useEffect, useRef, useCallback } from 'react';
import { Mood } from '../types';
import { sendToAI } from '../services/gemini';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  model: string;
  apiKey?: string;
  onMoodChange: (mood: Mood) => void;
}

interface TranscriptLine {
  id: string;
  role: 'user' | 'aria';
  text: string;
  time: number;
}

export function VideoCall({ isOpen, onClose, model, onMoodChange }: Props) {
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [_transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState('');
  const [ariaText, setAriaText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAriaSpeaking, setIsAriaSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [muted, setMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);
  const conversationRef = useRef<{role: string; content: string}[]>([]);
  const messagesInCallRef = useRef<TranscriptLine[]>([]);

  // Load voices
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // Start call
  const startCall = useCallback(async () => {
    setCallState('connecting');
    isActiveRef.current = true;

    // Try to get camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError(true);
    }

    // Wait a moment for "connecting" effect
    await new Promise(r => setTimeout(r, 1500));

    if (!isActiveRef.current) return;
    setCallState('active');
    onMoodChange('happy');

    // Start timer
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Initial greeting
    const greetingText = "Hey! I can see you! 💜 So nice to finally talk face to face. How are you doing today? And more importantly — have you been studying?";
    setAriaText(greetingText);
    setTranscript([{ id: 'greeting', role: 'aria', text: greetingText, time: Date.now() }]);
    conversationRef.current = [{ role: 'assistant', content: greetingText }];
    messagesInCallRef.current = [{ id: 'greeting', role: 'aria', text: greetingText, time: Date.now() }];

    // Speak greeting
    await speakText(greetingText);
    if (isActiveRef.current) startListening();
  }, [model]);

  // Speak text
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !isActiveRef.current) { resolve(); return; }
      window.speechSynthesis.cancel();

      const clean = text
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1')
        .replace(/`{1,3}[^`]*`{1,3}/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/^[-*]\s/gm, '')
        .trim();

      if (!clean) { resolve(); return; }

      const utt = new SpeechSynthesisUtterance(clean);
      const voices = voicesRef.current;
      const female = voices.find(v => /female|samantha|zira|karen|victoria|fiona|moira|tessa/i.test(v.name))
        || voices.find(v => v.lang.startsWith('en'));
      if (female) utt.voice = female;
      utt.pitch = 1.12;
      utt.rate = 1.05;

      utt.onstart = () => { setIsAriaSpeaking(true); onMoodChange('speaking'); };
      utt.onend = () => { setIsAriaSpeaking(false); if (isActiveRef.current) onMoodChange('happy'); resolve(); };
      utt.onerror = () => { setIsAriaSpeaking(false); resolve(); };

      window.speechSynthesis.speak(utt);
    });
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    rec.onresult = (e: any) => {
      if (!isActiveRef.current) return;

      let interim = '';
      let newFinal = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          newFinal += t;
        } else {
          interim += t;
        }
      }

      if (newFinal) {
        finalTranscript += newFinal;
        setInterimText('');
      } else {
        setInterimText(interim);
      }

      // Reset silence timer on any speech
      if (silenceTimer) clearTimeout(silenceTimer);
      if (finalTranscript || interim) {
        silenceTimer = setTimeout(() => {
          if (!isActiveRef.current) return;
          const userText = finalTranscript.trim();
          if (userText) {
            finalTranscript = '';
            handleUserSpeech(userText);
          }
        }, 2000); // 2 seconds of silence = done speaking
      }
    };

    rec.onerror = (e: any) => {
      console.log('Speech error:', e.error);
      if (e.error === 'no-speech' && isActiveRef.current) {
        // Restart listening
        setTimeout(() => {
          if (isActiveRef.current) startListening();
        }, 500);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // Auto-restart if call is still active
      if (isActiveRef.current && !isThinking) {
        setTimeout(() => {
          if (isActiveRef.current) startListening();
        }, 300);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
      onMoodChange('listening');
    } catch (err) {
      console.error('Failed to start recognition:', err);
    }
  }, [speakText, model]);

  // Handle user speech
  const handleUserSpeech = useCallback(async (text: string) => {
    if (!isActiveRef.current || isThinking) return;

    // Stop listening while processing
    try { recognitionRef.current?.stop(); } catch {}
    setIsListening(false);
    setIsThinking(true);
    onMoodChange('thinking');

    const line: TranscriptLine = { id: `u-${Date.now()}`, role: 'user', text, time: Date.now() };
    setTranscript(prev => [...prev, line]);
    messagesInCallRef.current = [...messagesInCallRef.current, line];
    setAriaText('');

    conversationRef.current.push({ role: 'user', content: text });

    try {
      const raw = await sendToAI(
        conversationRef.current.map(m => ({ ...m, id: '', timestamp: Date.now(), role: m.role as 'user' | 'assistant' })),
        text,
        model,
        undefined, undefined, undefined
      );

      if (!isActiveRef.current) return;

      // Clean the response
      const clean = raw
        .replace(/REMINDER:.*$/gms, '')
        .replace(/\[REMINDER.*?\]/g, '')
        .trim();

      const ariaLine: TranscriptLine = { id: `a-${Date.now()}`, role: 'aria', text: clean, time: Date.now() };
      setTranscript(prev => [...prev, ariaLine]);
      messagesInCallRef.current = [...messagesInCallRef.current, ariaLine];
      setAriaText(clean);
      conversationRef.current.push({ role: 'assistant', content: clean });

      // Detect mood
      if (/strict|disappointed|no shortcut|don't skip|you need to|homework/i.test(clean)) {
        onMoodChange('strict');
      } else if (/proud|excellent|perfect|great job|amazing/i.test(clean)) {
        onMoodChange('excited');
      } else {
        onMoodChange('happy');
      }

      setIsThinking(false);

      // Speak the response
      await speakText(clean);

      // Start listening again after speaking
      if (isActiveRef.current) startListening();
    } catch (err: any) {
      setIsThinking(false);
      onMoodChange('concerned');
      const errMsg = "Oops, something went wrong. Can you say that again?";
      setAriaText(errMsg);
      setTranscript(prev => [...prev, { id: `e-${Date.now()}`, role: 'aria', text: errMsg, time: Date.now() }]);
      await speakText(errMsg);
      if (isActiveRef.current) startListening();
    }
  }, [model, isThinking, speakText, startListening]);

  // End call
  const endCall = useCallback(() => {
    isActiveRef.current = false;
    setCallState('ended');

    // Stop everything
    try { recognitionRef.current?.stop(); } catch {}
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }

    onMoodChange('neutral');

    // Close after showing end screen
    setTimeout(() => {
      onClose();
    }, 3000);
  }, [cameraStream, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      try { recognitionRef.current?.stop(); } catch {}
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Format duration
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#050510' }}>

      {/* ═══════════ IDLE SCREEN ═══════════ */}
      {callState === 'idle' && (
        <div className="flex-1 flex items-center justify-center p-6 relative">
          {/* Background glows */}
          <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-violet-600/[0.08] rounded-full blur-[100px] animate-slow-drift" />
          <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] bg-pink-600/[0.06] rounded-full blur-[80px] animate-slow-drift-reverse" />

          <div className="relative text-center max-w-sm animate-slide-up">
            {/* Large avatar */}
            <div className="w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-[3px] shadow-2xl shadow-violet-500/30 mb-8 animate-float">
              <div className="w-full h-full rounded-full bg-[#0d0d1a] overflow-hidden">
                <img src="/avatar.png" alt="Aria" className="w-full h-full rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
              </div>
            </div>

            <h2 className="text-2xl font-bold gradient-text mb-2">Video Call with Aria</h2>
            <p className="text-white/30 text-sm mb-8 leading-relaxed">
              Talk face-to-face with your AI teacher.<br />
              She can see you, hear you, and respond in real time.
            </p>

            <button
              onClick={startCall}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-2xl text-lg font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 active:scale-95 flex items-center gap-3 mx-auto"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Start Call
            </button>

            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 text-white/30 hover:text-white/50 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ CONNECTING SCREEN ═══════════ */}
      {callState === 'connecting' && (
        <div className="flex-1 flex items-center justify-center relative">
          <div className="text-center animate-slide-up">
            {/* Pulsing avatar */}
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-violet-500/10 animate-ping" style={{ animationDelay: '0.5s' }} />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-violet-500 to-pink-500 p-[3px]">
                <div className="w-full h-full rounded-full bg-[#0d0d1a] overflow-hidden">
                  <img src="/avatar.png" alt="Aria" className="w-full h-full rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              </div>
            </div>
            <p className="text-white/50 text-sm animate-pulse">Connecting to Aria...</p>
          </div>
        </div>
      )}

      {/* ═══════════ ACTIVE CALL ═══════════ */}
      {(callState === 'active') && (
        <>
          {/* Main call area */}
          <div className="flex-1 relative overflow-hidden">

            {/* Animated background */}
            <div className="absolute inset-0">
              <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/[0.06] rounded-full blur-[120px] animate-slow-drift" />
              <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-pink-600/[0.05] rounded-full blur-[100px] animate-slow-drift-reverse" />
            </div>

            {/* Aria's avatar - large centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                {/* Speaking rings */}
                {isAriaSpeaking && (
                  <>
                    <div className="absolute -inset-8 rounded-full border-2 border-violet-400/20" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
                    <div className="absolute -inset-12 rounded-full border border-fuchsia-300/10" style={{ animation: 'pulse-ring 2s ease-out infinite 0.5s' }} />
                    <div className="absolute -inset-16 rounded-full border border-pink-300/5" style={{ animation: 'pulse-ring 2s ease-out infinite 1s' }} />
                  </>
                )}
                {/* Thinking animation */}
                {isThinking && (
                  <>
                    <div className="absolute -inset-8 rounded-full border-2 border-amber-400/20" style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />
                    <div className="absolute -inset-12 rounded-full border border-amber-300/10" style={{ animation: 'pulse-ring 1.5s ease-out infinite 0.3s' }} />
                  </>
                )}

                {/* Avatar */}
                <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-[3px] shadow-2xl shadow-violet-500/30"
                  style={{ animation: isAriaSpeaking ? 'glow-pulse 1.5s ease-in-out infinite' : 'float 4s ease-in-out infinite' }}>
                  <div className="w-full h-full rounded-full bg-[#0d0d1a] overflow-hidden">
                    <img src="/avatar.png" alt="Aria" className="w-full h-full rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                </div>

                {/* Name badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full glass-strong">
                  <p className="text-[12px] font-semibold gradient-text whitespace-nowrap">Aria</p>
                </div>
              </div>
            </div>

            {/* User camera PiP */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20">
              <div className="relative w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl">
                {cameraError ? (
                  <div className="w-full h-full bg-white/[0.05] flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-white/20 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      <p className="text-[9px] text-white/20">Camera off</p>
                    </div>
                  </div>
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                )}
                {/* Muted indicator */}
                {muted && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="text-center mt-1.5">
                <span className="text-[10px] text-white/30">You</span>
              </div>
            </div>

            {/* Aria is speaking / thinking indicator */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
              {isAriaSpeaking && (
                <div className="px-5 py-2.5 rounded-full glass-strong flex items-center gap-2 animate-slide-up">
                  <div className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="w-[3px] h-3 bg-violet-400 rounded-full origin-bottom"
                        style={{ animation: 'voice-wave 0.6s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-white/50 ml-1">Aria is speaking</span>
                </div>
              )}
              {isListening && !isAriaSpeaking && !isThinking && (
                <div className="px-5 py-2.5 rounded-full glass-strong flex items-center gap-2 animate-slide-up">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-[11px] text-white/50">
                    {interimText ? `"${interimText}"` : 'Listening...'}
                  </span>
                </div>
              )}
              {isThinking && (
                <div className="px-5 py-2.5 rounded-full glass-strong flex items-center gap-2 animate-slide-up">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-amber-400/70 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-white/50 ml-1">Thinking...</span>
                </div>
              )}
            </div>

            {/* Live transcript overlay (bottom) */}
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-40 sm:right-52 z-20 max-h-48 overflow-y-auto chat-scroll">
              {/* Aria's current text */}
              {ariaText && !isThinking && (
                <div className="mb-3 animate-slide-up">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md glass-strong max-w-md">
                    <p className="text-[13px] text-white/80 leading-relaxed">{ariaText}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top bar with timer & controls */}
          <div className="relative z-20 px-4 sm:px-6 py-3 glass flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${callState === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-sm font-medium text-white/60">{formatDuration(callDuration)}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Transcript toggle */}
              <button
                className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/40 hover:text-white/70 transition-all"
                title="Call info"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </button>

              {/* Mute toggle */}
              <button
                onClick={() => setMuted(!muted)}
                className={`p-3 rounded-xl transition-all ${muted ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/40 hover:text-white/70'}`}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v12.88c0 .498-.564.771-.957.44L6.75 8.25H4.501a2.25 2.25 0 00-2.25 2.25v2.25a2.25 2.25 0 002.25 2.25h2.25" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              {/* End call */}
              <button
                onClick={endCall}
                className="px-6 py-3 bg-red-500 hover:bg-red-400 rounded-xl text-white font-semibold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-200 active:scale-95 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
                </svg>
                End
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ CALL ENDED ═══════════ */}
      {callState === 'ended' && (
        <div className="flex-1 flex items-center justify-center relative">
          <div className="text-center animate-slide-up">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-pink-500 p-[3px] mb-6 opacity-50">
              <div className="w-full h-full rounded-full bg-[#0d0d1a] overflow-hidden">
                <img src="/avatar.png" alt="Aria" className="w-full h-full rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white/60 mb-2">Call Ended</h3>
            <p className="text-white/30 text-sm">Duration: {formatDuration(callDuration)}</p>
            <p className="text-white/15 text-xs mt-4">Great session! Keep studying! 📚</p>
          </div>
        </div>
      )}
    </div>
  );
}
