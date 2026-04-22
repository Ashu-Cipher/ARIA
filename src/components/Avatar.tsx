import { useState } from 'react';
import { Mood } from '../types';

interface AvatarProps {
  mood: Mood;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
}

export function Avatar({ mood, isSpeaking, isListening, isThinking }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const moodGradients: Record<Mood, string> = {
    happy: 'from-violet-500 via-fuchsia-500 to-pink-500',
    thinking: 'from-blue-500 via-cyan-500 to-teal-500',
    concerned: 'from-amber-500 via-orange-500 to-red-500',
    excited: 'from-pink-500 via-rose-500 to-red-500',
    neutral: 'from-slate-400 via-gray-400 to-zinc-400',
    speaking: 'from-violet-500 via-purple-500 to-fuchsia-500',
    listening: 'from-cyan-400 via-teal-400 to-emerald-400',
    strict: 'from-amber-500 via-red-500 to-rose-600',
  };

  const glowColors: Record<Mood, string> = {
    happy: 'rgba(139, 92, 246, 0.25)',
    thinking: 'rgba(59, 130, 246, 0.25)',
    concerned: 'rgba(245, 158, 11, 0.25)',
    excited: 'rgba(236, 72, 153, 0.3)',
    neutral: 'rgba(148, 163, 184, 0.15)',
    speaking: 'rgba(168, 85, 247, 0.35)',
    listening: 'rgba(34, 211, 238, 0.3)',
    strict: 'rgba(245, 158, 11, 0.35)',
  };

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      {/* Background glow */}
      <div
        className="absolute w-56 h-56 rounded-full blur-3xl transition-all duration-1000"
        style={{ backgroundColor: glowColors[mood], animation: isSpeaking || isListening ? 'glow-pulse 1.5s ease-in-out infinite' : undefined }}
      />

      {/* Speaking rings */}
      {isSpeaking && (
        <>
          <div className="absolute w-44 h-44 rounded-full border-2 border-violet-400/30" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
          <div className="absolute w-44 h-44 rounded-full border border-fuchsia-300/20" style={{ animation: 'pulse-ring 2s ease-out infinite 0.6s' }} />
          <div className="absolute w-44 h-44 rounded-full border border-pink-300/15" style={{ animation: 'pulse-ring 2s ease-out infinite 1.2s' }} />
        </>
      )}

      {/* Listening pulse */}
      {isListening && (
        <>
          <div className="absolute w-44 h-44 rounded-full border-2 border-cyan-400/30" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
          <div className="absolute w-44 h-44 rounded-full border border-teal-300/20" style={{ animation: 'pulse-ring 2s ease-out infinite 0.8s' }} />
        </>
      )}

      {/* Thinking ring */}
      {isThinking && (
        <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-blue-400/40" style={{ animation: 'rotate-gradient 6s linear infinite' }} />
      )}

      {/* Main avatar container */}
      <div className="relative w-36 h-36 animate-float" style={{ animationDuration: isSpeaking ? '2s' : '4s' }}>
        {/* Rotating gradient border */}
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${moodGradients[mood]} opacity-80`}
          style={{ animation: 'rotate-gradient 3s linear infinite' }}
        />

        {/* Inner circle with avatar */}
        <div className="absolute inset-[3px] rounded-full overflow-hidden bg-[#07070f]">
          {!imgError ? (
            <img
              src="/avatar.png"
              alt="Aria"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/30 to-pink-600/30">
              <span className="text-5xl select-none">💜</span>
            </div>
          )}
        </div>

        {/* Shine overlay */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />

        {/* Speaking indicator dots */}
        {isSpeaking && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#07070f] rounded-full px-2 py-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-violet-400 rounded-full"
                style={{ animation: 'voice-wave 0.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating particles when speaking */}
      {isSpeaking && (
        <>
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-violet-400/60 rounded-full"
              style={{
                left: `${35 + Math.random() * 30}%`,
                top: `${30 + Math.random() * 40}%`,
                animation: `particle ${2 + Math.random()}s ease-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
