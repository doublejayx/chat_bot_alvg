import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import {
  ArrowUp,
  BarChart3,
  Bot,
  ImagePlus,
  LayoutDashboard,
  Maximize2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Copy,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';

/* ─── Constants ─────────────────────────────────────────── */
const SUGGESTIONS = [
  { label: 'About Avalant', prompt: 'What can you tell me about Avalant?', icon: Sparkles, color: '#a855f7' },
  { label: 'Dashboard insights', prompt: 'Show me dashboard insights', icon: BarChart3, color: '#22c55e' },
  { label: 'Add an image', prompt: 'How do I add an image?', icon: ImagePlus, color: '#3b82f6' },
];

const FALLBACK_RESPONSES = {
  'what can you tell me about avalant?':
    'Avalant is an enterprise technology company focused on digital platforms, AI, software solutions, and low-code workflows for modern organizations.',
  'show me dashboard insights':
    'Your dashboard is ready: assistant activity is online, image actions are synced, and local RAG can answer Avalant questions when the service is available.',
  'how do i add an image?':
    'Type an image name such as cat or dog. If the image exists in the local images folder, it will be added to the gallery.',
  'avalant ตั้งอยู่ที่ไหน':
    'Avalant ตั้งอยู่ที่ 20 อาคารบุปผจิต ชั้น 15 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500 ค่ะ',
};

const formatTime = () =>
  new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date());

function resolveFallback(question, reply = '') {
  const exact = FALLBACK_RESPONSES[question.toLowerCase()];
  if (exact) return exact;
  const normalized = question.toLowerCase().replace(/\s+/g, '');
  const replyLooksEmpty =
    !reply || reply.includes('ไม่มีข้อมูล') || reply.toLowerCase().includes('no information');
  const isAvalantQuestion =
    normalized.includes('avalant') ||
    normalized.includes('อวาลันท์') ||
    normalized.includes('อัฟวาลันท์') ||
    normalized.includes('อัฟวาแลนท์') ||
    normalized.includes('อวาแลนท์');
  if (!replyLooksEmpty || !isAvalantQuestion) return '';
  if (
    normalized.includes('อยู่ที่ไหน') ||
    normalized.includes('ที่อยู่') ||
    normalized.includes('location') ||
    normalized.includes('address') ||
    normalized.includes('office')
  )
    return FALLBACK_RESPONSES['avalant ตั้งอยู่ที่ไหน'];
  return FALLBACK_RESPONSES['what can you tell me about avalant?'];
}

/* ─── Streaming text hook ────────────────────────────────── */
function useStreamText(fullText, active, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active || !fullText) { setDisplayed(fullText); return; }
    setDisplayed('');
    let i = 0;
    const tick = () => {
      i += 1;
      setDisplayed(fullText.slice(0, i));
      if (i < fullText.length) timer = window.setTimeout(tick, speed);
    };
    let timer = window.setTimeout(tick, speed);
    return () => window.clearTimeout(timer);
  }, [fullText, active, speed]);
  return displayed;
}

/* ─── Particle burst on send ─────────────────────────────── */
function Particle({ x, y, color, onDone }) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 30 + Math.random() * 40;
  return (
    <motion.span
      initial={{ x, y, scale: 1, opacity: 1 }}
      animate={{
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scale: 0,
        opacity: 0,
      }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      onAnimationComplete={onDone}
      style={{
        position: 'fixed',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

function ParticleBurst({ origin, colors = ['#22c55e', '#86efac', '#bbf7d0', '#fff'], count = 10 }) {
  const [particles, setParticles] = useState(
    Array.from({ length: count }, (_, i) => ({ id: i, done: false }))
  );
  const alive = particles.filter(p => !p.done);
  if (!alive.length) return null;
  return (
    <>
      {alive.map(p => (
        <Particle
          key={p.id}
          x={origin.x}
          y={origin.y}
          color={colors[p.id % colors.length]}
          onDone={() => setParticles(ps => ps.map(q => (q.id === p.id ? { ...q, done: true } : q)))}
        />
      ))}
    </>
  );
}

/* ─── AssistantAvatar ────────────────────────────────────── */
function AssistantAvatar({ pulse = false }) {
  return (
    <div className="relative shrink-0">
      <motion.div
        animate={pulse ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#22c55e] to-[#15803d] shadow-[0_4px_14px_rgba(34,197,94,.35)]"
      >
        <img src="/images/avalant-logo-green.png" alt="" className="h-7 w-7 object-contain mix-blend-screen brightness-150" />
      </motion.div>
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22c55e] shadow-[0_0_0_3px_rgba(34,197,94,.25)]" />
    </div>
  );
}

/* ─── TypingIndicator ────────────────────────────────────── */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      className="flex items-end gap-2"
    >
      <AssistantAvatar />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,.06)] ring-1 ring-black/[.04]">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-[#22c55e]"
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ─── StreamingText ──────────────────────────────────────── */
function StreamingText({ text, isNew }) {
  const displayed = useStreamText(text, isNew, 16);
  return (
    <span>
      {displayed}
      {isNew && displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 rounded-full bg-[#22c55e]"
        />
      )}
    </span>
  );
}

/* ─── MessageBubble ──────────────────────────────────────── */
function MessageBubble({ message, isLatestBot }) {
  const isUser = message.role === 'user';
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => !isUser && setShowActions(true)}
      onMouseLeave={() => !isUser && setShowActions(false)}
    >
      {!isUser && <AssistantAvatar pulse={isLatestBot} />}

      <div className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-3 text-[13.5px] leading-[1.65] ${
            isUser
              ? 'rounded-br-sm bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white shadow-[0_4px_16px_rgba(34,197,94,.32)]'
              : 'rounded-bl-sm bg-white text-[#1f2937] shadow-[0_2px_8px_rgba(15,23,42,.06)] ring-1 ring-black/[.04]'
          }`}
        >
          {isUser ? (
            message.text
          ) : (
            <StreamingText text={message.text} isNew={isLatestBot} />
          )}

          {/* User bubble shine */}
          {isUser && (
            <span className="pointer-events-none absolute inset-0 rounded-2xl rounded-br-sm bg-gradient-to-b from-white/20 to-transparent" />
          )}
        </div>

        {/* Timestamp + actions */}
        <div className={`mt-1 flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[11px] text-[#9ca3af]">{message.time}</span>

          {/* Bot message actions */}
          {!isUser && (
            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, x: -4 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.88, x: -4 }}
                  transition={{ duration: 0.14 }}
                  className="flex items-center gap-0.5"
                >
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setLiked(v => !v)}
                    className={`grid h-6 w-6 place-items-center rounded-full transition ${
                      liked ? 'text-[#22c55e]' : 'text-[#9ca3af] hover:text-[#22c55e]'
                    }`}
                    aria-label="Like message"
                  >
                    <ThumbsUp size={12} fill={liked ? 'currentColor' : 'none'} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={handleCopy}
                    className="grid h-6 w-6 place-items-center rounded-full text-[#9ca3af] transition hover:text-[#22c55e]"
                    aria-label="Copy message"
                  >
                    <Copy size={12} />
                  </motion.button>
                  <AnimatePresence>
                    {copied && (
                      <motion.span
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-[11px] font-medium text-[#22c55e]"
                      >
                        Copied!
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── SuggestionChips ────────────────────────────────────── */
function SuggestionChips({ onSelect, disabled }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [&::-webkit-scrollbar]:hidden">
      {SUGGESTIONS.map(({ label, prompt, icon: Icon, color }, i) => (
        <motion.button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.2 }}
          whileHover={{ y: -2, scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 text-[12px] font-medium text-[#374151] shadow-[0_1px_3px_rgba(15,23,42,.06)] transition hover:border-transparent hover:shadow-[0_3px_10px_rgba(15,23,42,.1)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ '--chip-color': color }}
        >
          <Icon
            size={13}
            style={{ color }}
            className="transition-transform duration-200 group-hover:scale-110"
          />
          {label}
        </motion.button>
      ))}
    </div>
  );
}

/* ─── SendButton ─────────────────────────────────────────── */
function SendButton({ canSend, isSending, btnRef }) {
  return (
    <motion.button
      ref={btnRef}
      type="submit"
      disabled={!canSend}
      animate={canSend ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0.45 }}
      whileHover={canSend ? { scale: 1.08 } : undefined}
      whileTap={canSend ? { scale: 0.92 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#22c55e] to-[#15803d] text-white shadow-[0_3px_10px_rgba(34,197,94,.4)] disabled:cursor-not-allowed"
      aria-label="Send message"
    >
      {/* Shimmer */}
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
        initial={{ x: '-100%' }}
        animate={canSend ? { x: '200%' } : { x: '-100%' }}
        transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
      />
      <AnimatePresence mode="wait">
        {isSending ? (
          <motion.span
            key="spinner"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          >
            <RotateCcw size={15} strokeWidth={2.5} />
          </motion.span>
        ) : (
          <motion.span
            key="arrow"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ─── ChatPanel ──────────────────────────────────────────── */
function ChatPanel({ apiEndpoint = '/chat', onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I am your AI Assistant. Ask me about Avalant, dashboard insights, or adding an image.',
      time: formatTime(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [latestBotId, setLatestBotId] = useState('welcome');
  const [burst, setBurst] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const sendBtnRef = useRef(null);
  
  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Hi, I am your AI Assistant. Ask me about Avalant, dashboard insights, or adding an image.',
        time: formatTime(),
      },
    ]);
  };

  const canSend = useMemo(() => inputValue.trim().length > 0 && !isSending, [inputValue, isSending]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(id);
  }, []);

  const requestReply = async messageText => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Chat request failed');
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return json.response || json.text || json.message || json.output || '';
      }
      return response.text();
    } catch {
      return '';
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const playSound = () => {
    const audio = new Audio('/sounds/pop up.mp3');
    audio.volume = 0.5; // ปรับความดังให้ฟังสบายๆ
    audio.play().catch(() => {}); // catch ไว้เผื่อเบราว์เซอร์บล็อก Autoplay
  };

  const sendMessage = async rawText => {
    const text = rawText.trim();
    if (!text || isSending) return;

    // Particle burst from send button
    if (sendBtnRef.current) {
      const rect = sendBtnRef.current.getBoundingClientRect();
      setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setTimeout(() => setBurst(null), 700);
    }

    setMessages(c => [...c, { id: `user-${Date.now()}`, role: 'user', text, time: formatTime() }]);
    setInputValue('');
    setIsTyping(true);
    setIsSending(true);

    try {
      const reply = await requestReply(text);
      const fallback = resolveFallback(text, reply);
      const botId = `assistant-${Date.now()}`;
      setLatestBotId(botId);
      setMessages(c => [
        ...c,
        {
          id: botId,
          role: 'assistant',
          text: fallback || reply || 'I am ready to help with the next question.',
          time: formatTime(),
        },
      ]);
      playSound(); // เล่นเสียงตอนที่บอทตอบกลับ
    } catch {
      const botId = `assistant-${Date.now()}`;
      setLatestBotId(botId);
      setMessages(c => [
        ...c,
        {
          id: botId,
          role: 'assistant',
          text: resolveFallback(text) || 'I could not reach the assistant service. Please try again.',
          time: formatTime(),
        },
      ]);
      playSound(); // เล่นเสียงตอนที่บอทตอบกลับ (แม้จะ Error)
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (canSend) sendMessage(inputValue);
  };

  return (
    <>
      {/* Particle burst */}
      {burst && <ParticleBurst origin={burst} />}

      <motion.section
        layout
        initial={{ opacity: 0, y: 22, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 22, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        aria-label="AI Assistant chat window"
        className={`fixed bottom-24 right-6 z-50 flex max-h-[calc(100vh-112px)] flex-col overflow-hidden rounded-[24px] border border-white/40 bg-white shadow-[0_24px_64px_rgba(15,23,42,.16),0_2px_12px_rgba(0,0,0,.08)] backdrop-blur-sm ${
          isExpanded
            ? 'left-6 top-6 h-auto w-auto'
            : 'h-[min(700px,calc(100vh-128px))] w-[380px] max-w-[calc(100vw-32px)]'
        }`}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <header className="relative flex h-[72px] shrink-0 items-center justify-between overflow-hidden px-4">
          {/* Animated gradient background */}
          <motion.div
            className="absolute inset-0"
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{
              background: 'linear-gradient(135deg, #15803d, #22c55e, #16a34a, #4ade80)',
              backgroundSize: '300% 300%',
            }}
          />
          
          {/* Mesh overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,.18),transparent_60%)]" />
          {/* Subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[.08]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="relative flex min-w-0 items-center gap-3">
            <AssistantAvatar />
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-white">AI Assistant</h2>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/75">
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-white"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                {isTyping ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1"
                  >
                    <Zap size={10} className="text-yellow-300" />
                    Typing…
                  </motion.span>
                ) : (
                  'Online'
                )}
              </div>
            </div>
          </div>

          <div className="relative flex items-center gap-1">
            <motion.button
              type="button"
              onClick={handleResetChat}
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              aria-label="เริ่มแชทใหม่"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/28"
            >
              <RefreshCw size={15} />
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setIsExpanded(v => !v)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={isExpanded ? 'Restore chat size' : 'Expand chat'}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/28"
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </motion.button>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close chat"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/28"
            >
              <X size={16} />
            </motion.button>
          </div>

          {/* Bottom gradient fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </header>

        {/* ── Messages ────────────────────────────────────── */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-[#f0fdf4] to-[#f9fafb] px-4 py-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d1fae5] [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatestBot={msg.id === latestBotId && msg.role === 'assistant'}
            />
          ))}
          <AnimatePresence>{isTyping && <TypingIndicator />}</AnimatePresence>

          {/* Scroll-to-bottom spacer */}
          <div className="h-1" />
        </div>

        {/* ── Input area ──────────────────────────────────── */}
        <div className="shrink-0 border-t border-[#f0fdf4] bg-white">
          <SuggestionChips onSelect={sendMessage} disabled={isSending} />

          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-4 pt-2">
            <label htmlFor="ai-assistant-input" className="sr-only">
              Type your message
            </label>
            <motion.div
              className="flex min-h-11 flex-1 items-center gap-2 rounded-full border bg-[#f9fafb] px-4 transition-all"
              animate={
                canSend
                  ? { borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,.12)' }
                  : { borderColor: '#e5e7eb', boxShadow: '0 0 0 0px rgba(34,197,94,0)' }
              }
              transition={{ duration: 0.2 }}
            >
              <input
                ref={inputRef}
                id="ai-assistant-input"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && canSend) {
                    e.preventDefault();
                    sendMessage(inputValue);
                  }
                }}
                placeholder="Ask anything…"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
              />
              <SendButton canSend={canSend} isSending={isSending} btnRef={sendBtnRef} />
            </motion.div>
          </form>

          {/* Powered by */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-1.5 pb-3 text-[11px] text-[#9ca3af]"
          >
            <Sparkles size={10} className="text-[#22c55e]" />
            Powered by <span className="font-semibold text-[#22c55e]">Avalant AI</span>
          </motion.div>
        </div>
      </motion.section>
    </>
  );
}

/* ─── DashboardShell ─────────────────────────────────────── */
function DashboardShell({ children }) {
  return (
    <div className="min-h-screen bg-[#f3f8f5] font-['Roboto','Inter',sans-serif] text-[#1f2937]">
      <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-[#e5e7eb] bg-white px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
            <img src="/images/avalant-logo-green.png" alt="Avalant" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold">AutomationX</div>
            <div className="text-xs text-[#6b7280]">AI Workspace</div>
          </div>
        </div>
        <nav className="mt-8 grid gap-1">
          {[
            ['Dashboard', LayoutDashboard],
            ['Assistant', MessageSquare],
            ['Insights', BarChart3],
          ].map(([label, Icon], index) => (
            <button
              key={label}
              type="button"
              className={`flex h-10 items-center gap-3 rounded-2xl px-3 text-sm transition ${
                index === 0
                  ? 'bg-[#dcfce7] text-[#22c55e]'
                  : 'text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1f2937]'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="px-4 py-5 lg:ml-64 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-semibold text-[#1f2937]">Enterprise AI Dashboard</h1>
              <p className="mt-1 text-sm text-[#6b7280]">
                A calm workspace for AI assistance, image actions, and operational insights.
              </p>
            </div>
            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 text-sm text-[#1f2937] shadow-sm">
              <motion.span
                className="h-2 w-2 rounded-full bg-[#22c55e]"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              Assistant online
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Images loaded', '0', 'Synced with chat commands'],
              ['RAG status', 'Ready', 'Local answers when available'],
              ['Workspace', 'AI', 'Embedded enterprise copilot'],
            ].map(([label, value, note]) => (
              <motion.section
                key={label}
                whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(15,23,42,.10)' }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,.05)]"
              >
                <div className="text-sm text-[#6b7280]">{label}</div>
                <div className="mt-3 text-2xl font-semibold text-[#1f2937]">{value}</div>
                <div className="mt-2 text-xs text-[#22c55e]">{note}</div>
              </motion.section>
            ))}
          </div>

          <section className="mt-5 rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,.05)]">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] text-[#22c55e] shadow-[0_4px_14px_rgba(34,197,94,.2)]"
            >
              <Bot size={24} />
            </motion.div>
            <h2 className="mt-4 text-lg font-medium text-[#1f2937]">AI assistant is ready</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
              Open the floating assistant to ask Avalant questions, inspect dashboard context, or add image assets.
            </p>
          </section>
        </div>
      </main>

      {children}
    </div>
  );
}

/* ─── ChatWidget (root export) ───────────────────────────── */
export function ChatWidget({ apiEndpoint = '/chat', withDashboard = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(1);

  const handleOpen = () => {
    setIsOpen(true);
    setUnread(0);
  };

  const widget = (
    <>
      <AnimatePresence>
        {isOpen && (
          <ChatPanel apiEndpoint={apiEndpoint} onClose={() => setIsOpen(false)} />
        )}
      </AnimatePresence>

      {/* FAB toggle button */}
      <motion.button
        type="button"
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={isOpen}
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        whileHover={{ scale: 1.07, y: -2 }}
        whileTap={{ scale: 0.93 }}
        className="fixed bottom-6 right-6 z-50 grid h-[62px] w-[62px] place-items-center overflow-hidden rounded-full shadow-[0_8px_32px_rgba(34,197,94,.45),0_2px_10px_rgba(0,0,0,.14)] focus:outline-none focus:ring-4 focus:ring-[#22c55e]/25"
        style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)' }}
      >
        {/* Rotating shimmer ring */}
        {!isOpen && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 60%, rgba(255,255,255,.4) 80%, transparent 100%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="text-white"
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="logo"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18 }}
            >
              <img
                src="/images/avalant-logo-green.png"
                alt=""
                className="h-9 w-9 object-contain mix-blend-screen brightness-200"
              />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Unread badge */}
        <AnimatePresence>
          {!isOpen && unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-white"
            >
              {unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );

  if (withDashboard) return <DashboardShell>{widget}</DashboardShell>;
  return <div className="font-['Roboto','Inter',sans-serif]">{widget}</div>;
}

export default ChatWidget;