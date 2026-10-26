// Anchor Bot: our own friendly mascot (not an Amazon or Alexa character or logo). Pure SVG, styled only with Tailwind classes.
// mood: happy | worried | thinking | listening | speaking
const calm = 'motion-reduce:animate-none';
const fillBox = '[transform-box:fill-box] origin-center';

function Eyes({ mood }) {
  if (mood === 'happy') {
    return (
      <g aria-hidden="true" className={`animate-bot-blink ${fillBox} ${calm}`}>
        <path d="M53 68 Q62 54 71 68" className="fill-none stroke-bg" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M89 68 Q98 54 107 68" className="fill-none stroke-bg" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    );
  }
  const ry = mood === 'listening' ? 11 : 9;
  const shift = mood === 'thinking' ? 'translate-x-1 -translate-y-1.5' : '';
  return (
    <g aria-hidden="true" className={`${mood === 'listening' ? '' : `animate-bot-blink ${fillBox} ${calm}`}`}>
      {mood === 'worried' && (
        <>
          <path d="M52 51 L70 45" className="stroke-bg" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M90 45 L108 51" className="stroke-bg" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      <g className={shift}>
        <ellipse cx="62" cy="66" rx="7.5" ry={ry} className="fill-bg" />
        <ellipse cx="98" cy="66" rx="7.5" ry={ry} className="fill-bg" />
        <circle cx="59.5" cy="62" r="2.6" className="fill-white" />
        <circle cx="95.5" cy="62" r="2.6" className="fill-white" />
      </g>
    </g>
  );
}

function Mouth({ mood }) {
  if (mood === 'speaking') return <ellipse cx="80" cy="86" rx="7" ry="6" className={`fill-bg animate-bot-talk ${fillBox} ${calm}`} />;
  if (mood === 'listening') return <circle cx="80" cy="86" r="4.5" className="fill-bg" />;
  if (mood === 'thinking') return <path d="M73 86 L87 86" className="stroke-bg" strokeWidth="4" strokeLinecap="round" />;
  if (mood === 'worried') return <path d="M72 89 Q80 82 88 89" className="fill-none stroke-bg" strokeWidth="4" strokeLinecap="round" />;
  return <path d="M70 82 Q80 93 90 82" className="fill-none stroke-bg" strokeWidth="4" strokeLinecap="round" />;
}

export default function AnchorBot({ mood = 'happy', wave = false, className = 'h-36 w-32' }) {
  const listening = mood === 'listening';
  return (
    <svg role="img" aria-label={`Anchor Bot, feeling ${mood}`} viewBox="0 0 160 172" className={className}>
      <ellipse cx="80" cy="166" rx="34" ry="5" className="fill-black/30" />
      <g className={`animate-bot-float ${calm}`}>
        {/* antenna */}
        <g className={`animate-bot-wiggle [transform-origin:80px_26px] ${calm}`}>
          <line x1="80" y1="27" x2="80" y2="12" className="stroke-muted" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="9" r="6.5" className={`fill-primary ${listening ? `animate-bot-pulse ${fillBox} ${calm}` : ''}`} />
        </g>
        {/* ears */}
        <circle cx="25" cy="68" r="10" className="fill-ai" />
        <circle cx="135" cy="68" r="10" className="fill-ai" />
        <circle cx="25" cy="68" r="4.5" className={`fill-secondary ${listening ? `animate-bot-pulse ${fillBox} ${calm}` : ''}`} />
        <circle cx="135" cy="68" r="4.5" className={`fill-secondary ${listening ? `animate-bot-pulse ${fillBox} ${calm}` : ''}`} />
        {/* head */}
        <rect x="28" y="26" width="104" height="84" rx="32" className="fill-ai" />
        <rect x="34" y="30" width="92" height="16" rx="8" className="fill-white/10" />
        <rect x="40" y="40" width="80" height="58" rx="24" className="fill-ink" />
        <ellipse cx="48" cy="82" rx="7" ry="4.5" className="fill-highlight/70" />
        <ellipse cx="112" cy="82" rx="7" ry="4.5" className="fill-highlight/70" />
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {mood === 'thinking' && (
          <g aria-hidden="true">
            <circle cx="128" cy="30" r="2.5" className="fill-muted" />
            <circle cx="137" cy="22" r="3.5" className="fill-muted" />
            <circle cx="148" cy="12" r="4.5" className="fill-muted" />
          </g>
        )}
        {/* body */}
        <rect x="48" y="112" width="64" height="44" rx="18" className="fill-ai" />
        <circle cx="80" cy="134" r="12" className="fill-sidebar" />
        <g aria-hidden="true" className="fill-none stroke-primary" strokeWidth="2" strokeLinecap="round">
          <circle cx="80" cy="127" r="2.6" />
          <line x1="80" y1="130" x2="80" y2="142" />
          <line x1="74.5" y1="133" x2="85.5" y2="133" />
          <path d="M73 138 Q80 148 87 138" />
        </g>
        {/* arms */}
        <ellipse cx="40" cy="134" rx="8" ry="15" className="fill-ai" />
        <g className={wave ? `animate-bot-wave [transform-origin:118px_124px] ${calm}` : ''}>
          <ellipse cx="120" cy="134" rx="8" ry="15" className="fill-ai" />
        </g>
        {/* feet */}
        <rect x="56" y="154" width="20" height="9" rx="4.5" className="fill-secondary" />
        <rect x="84" y="154" width="20" height="9" rx="4.5" className="fill-secondary" />
      </g>
    </svg>
  );
}