import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message } from '../types';
import { useState, type ReactNode } from 'react';

interface Props {
  msg: Message;
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Copy button for code blocks ──
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200
        bg-white/[0.06] hover:bg-violet-500/20 text-white/30 hover:text-violet-300 border border-white/[0.06]"
      title="Copy to clipboard"
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </span>
      )}
    </button>
  );
}

// ── Custom code block renderer ──
function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeText = String(children).replace(/\n$/, '');

  const isShell = ['bash', 'sh', 'zsh', 'shell', 'console', 'terminal'].includes(language) ||
    codeText.startsWith('$ ') || codeText.startsWith('sudo ') || codeText.startsWith('pacman') || codeText.startsWith('systemctl') || codeText.startsWith('arch');

  return (
    <div className="relative group my-3">
      {language && (
        <div className="absolute top-2.5 left-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white/[0.06] text-white/30">
          {isShell ? '🐧 terminal' : language}
        </div>
      )}
      <CopyButton text={codeText} />
      <pre className={`overflow-x-auto rounded-xl p-4 pt-8 text-[13px] font-['Fira_Code',monospace] leading-relaxed
        ${isShell
          ? 'bg-gradient-to-br from-emerald-950/50 to-violet-950/40 border border-emerald-500/10'
          : 'bg-black/40 border border-white/[0.04]'
        }`}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function MessageBubble({ msg }: Props) {
  const isUser = msg.role === 'user';
  const isDailyReport = msg.isDailyReport;
  const [imgExpanded, setImgExpanded] = useState(false);

  return (
    <div className={`animate-slide-up flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] sm:max-w-[80%] md:max-w-[72%] rounded-2xl ${
          isDailyReport
            ? 'bg-gradient-to-br from-amber-900/30 to-violet-900/30 border border-amber-500/20 text-white rounded-bl-md shadow-lg shadow-amber-500/5'
            : isUser
              ? 'bg-gradient-to-br from-violet-600/70 to-pink-600/70 text-white rounded-br-md shadow-lg shadow-violet-500/10'
              : 'glass text-white/90 rounded-bl-md'
        } px-5 py-3.5`}
      >
        {/* Header label */}
        {isDailyReport && (
          <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-amber-500/15">
            <span className="text-xl">📊</span>
            <div>
              <p className="text-[12px] font-bold text-amber-400/80 uppercase tracking-wider">Daily Progress Report</p>
              <p className="text-[10px] text-white/30">{new Date(msg.timestamp).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        )}
        {!isDailyReport && msg.role === 'assistant' && (
          <p className="text-[11px] font-semibold text-violet-400/40 mb-1.5">Aria</p>
        )}

        {/* Image preview for user messages */}
        {isUser && msg.imageData && (
          <div className="mb-2.5">
            <img
              src={msg.imageData}
              alt="Attached"
              onClick={() => setImgExpanded(!imgExpanded)}
              className={`rounded-xl cursor-pointer transition-all duration-300 border border-white/10 ${
                imgExpanded ? 'max-w-full' : 'max-h-52'
              }`}
              style={{ maxWidth: imgExpanded ? '100%' : '320px' }}
            />
            {msg.fileName && (
              <p className="text-[11px] text-white/40 mt-1.5 flex items-center gap-1">
                <span>📎</span> {msg.fileName}
              </p>
            )}
          </div>
        )}

        {/* Audio badge for user messages */}
        {isUser && msg.fileType === 'audio' && !msg.imageData && (
          <div className="mb-2.5 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 border border-white/10">
            <span className="text-xl">🎵</span>
            <div>
              <p className="text-[12px] font-medium text-white/70">Audio file</p>
              {msg.fileName && <p className="text-[11px] text-white/40">{msg.fileName}</p>}
            </div>
          </div>
        )}

        {/* Text file badge for user messages */}
        {isUser && msg.fileType === 'text' && !msg.imageData && msg.fileName && (
          <div className="mb-2.5 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 border border-white/10">
            <span className="text-xl">📄</span>
            <div>
              <p className="text-[12px] font-medium text-white/70">Code file</p>
              <p className="text-[11px] text-white/40">{msg.fileName}</p>
            </div>
          </div>
        )}

        {/* Message content */}
        {isUser ? (
          <p className="msg-text whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose-content msg-text">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className && typeof children === 'string' && !children.includes('\n');
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300 text-[13px] font-['Fira_Code',monospace]" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return <CodeBlock className={className}>{children}</CodeBlock>;
                },
                pre({ children }) {
                  return <>{children}</>;
                },
                a({ href, children }) {
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
                      {children}
                    </a>
                  );
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-2">
                      <table className="w-full text-[13px]">{children}</table>
                    </div>
                  );
                },
                th({ children }) {
                  return <th className="px-3 py-2 bg-white/[0.04] text-left font-semibold border border-white/[0.06]">{children}</th>;
                },
                td({ children }) {
                  return <td className="px-3 py-2 border border-white/[0.06]">{children}</td>;
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}

        <p className="text-[10px] opacity-25 mt-2 text-right">{timeLabel(msg.timestamp)}</p>
      </div>
    </div>
  );
}
