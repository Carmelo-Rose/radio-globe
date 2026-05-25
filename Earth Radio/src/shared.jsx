/* Shared bits used across all three variations. Exported to window for cross-file access. */

// --- Sample data --------------------------------------------------------------
const STATIONS = [
  { name: '宁夏交通广播',     loc: '宁夏 · 中国',      tag: 'traffic radio',  freq: '101.5' },
  { name: 'CRI HIT FM 广州',  loc: '广州 · 中国',      tag: '综合',           freq: '97.4'  },
  { name: '无印良品BGM精选',   loc: '中国',            tag: 'instrumental',   freq: '88.1'  },
  { name: 'KEXP 90.3',         loc: 'Seattle · USA',    tag: 'alternative',    freq: '90.3'  },
  { name: 'NTS Radio 1',       loc: 'London · UK',      tag: 'eclectic',       freq: '104.7' },
  { name: 'Radio Caroline',    loc: 'North Sea',        tag: 'rock · 60s',     freq: '648 AM' },
];

const NEARBY = [
  { name: '宁夏交通广播',  freq: '101.5', km: '0.4 km' },
  { name: '宁夏文艺广播',  freq: '93.4',  km: '0.9 km' },
  { name: '宁夏新闻广播',  freq: '88.8',  km: '1.3 km' },
  { name: '银川经济广播',  freq: '88.3',  km: '12 km'  },
  { name: '塞上故事 FM',   freq: '105.2', km: '14 km'  },
  { name: '黄河之声',     freq: '94.1',  km: '36 km'  },
];

// --- Radar sweep cursor (used by all three with different palettes) -----------
function RadarCursor({
  size = 220,
  color = '#7CFF8F',
  ringOpacity = 0.55,
  sweepOpacity = 0.95,
  speed = 4.5,            // seconds per rotation
  showRipples = true,
  showCrosshair = false,
  thickness = 1,
  centerDot = true,
  label = null,
}) {
  const sweepId = React.useId();
  const half = size / 2;
  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      pointerEvents: 'none',
      filter: `drop-shadow(0 0 8px ${color}55)`,
    }}>
      {/* Outer ripple rings */}
      {showRipples && [0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          inset: 0,
          border: `${thickness}px solid ${color}`,
          borderRadius: '50%',
          opacity: 0,
          animation: `rcRipple ${speed * 1.2}s linear infinite`,
          animationDelay: `${i * (speed * 0.4)}s`,
        }}/>
      ))}
      {/* Static outer ring */}
      <div style={{
        position: 'absolute', inset: 0,
        border: `${thickness}px solid ${color}`,
        borderRadius: '50%',
        opacity: ringOpacity,
      }}/>
      {/* Inner concentric rings */}
      <div style={{
        position: 'absolute',
        inset: size * 0.18,
        border: `${thickness}px dashed ${color}`,
        borderRadius: '50%',
        opacity: ringOpacity * 0.55,
      }}/>
      <div style={{
        position: 'absolute',
        inset: size * 0.34,
        border: `${thickness}px solid ${color}`,
        borderRadius: '50%',
        opacity: ringOpacity * 0.4,
      }}/>
      {/* Crosshair */}
      {showCrosshair && (
        <React.Fragment>
          <div style={{
            position: 'absolute', left: half - 0.5, top: 0, width: 1, height: size,
            background: color, opacity: ringOpacity * 0.35
          }}/>
          <div style={{
            position: 'absolute', top: half - 0.5, left: 0, height: 1, width: size,
            background: color, opacity: ringOpacity * 0.35
          }}/>
        </React.Fragment>
      )}
      {/* Sweep cone */}
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
        style={{ position: 'absolute', inset: 0, animation: `rcSpin ${speed}s linear infinite`, transformOrigin: `50% 50%` }}>
        <defs>
          <radialGradient id={sweepId} cx={half} cy={half} r={half} gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor={color} stopOpacity={sweepOpacity * 0.75} />
            <stop offset="55%" stopColor={color} stopOpacity={sweepOpacity * 0.35} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Cone (60° wedge sweeping clockwise) */}
        <path d={`M ${half} ${half} L ${half} 0 A ${half} ${half} 0 0 1 ${half + Math.sin(Math.PI/3)*half} ${half - Math.cos(Math.PI/3)*half} Z`}
          fill={`url(#${sweepId})`} />
        {/* Leading edge line */}
        <line x1={half} y1={half} x2={half} y2={0} stroke={color} strokeWidth={thickness * 1.4} opacity={sweepOpacity}/>
      </svg>
      {/* Centre dot */}
      {centerDot && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 8, height: 8, borderRadius: '50%',
          background: color, boxShadow: `0 0 12px ${color}, 0 0 24px ${color}66`,
        }}/>
      )}
      {label && (
        <div style={{
          position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 12px)',
          font: '300 11px/1 "JetBrains Mono", monospace',
          letterSpacing: '0.18em', color, textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>{label}</div>
      )}
      <style>{`
        @keyframes rcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rcRipple {
          0%   { transform: scale(0.5); opacity: 0; }
          15%  { opacity: ${ringOpacity}; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// --- VU meter (analog needle) -------------------------------------------------
function VUMeter({
  width = 220, height = 110, level = 0.62, peak = 0.78,
  faceColor = '#f4ead0',
  needleColor = '#1b1b1b',
  redLine = 0.78,
  label = 'VU · L',
  showScale = true,
  inkColor = '#1b1b1b',
  redColor = '#b1322a',
}) {
  // Animated needle: gently bounces around `level`
  const [n, setN] = React.useState(level);
  React.useEffect(() => {
    let raf, t0 = performance.now();
    const tick = (t) => {
      const dt = (t - t0) / 1000;
      const wobble = Math.sin(dt * 4.7) * 0.04 + Math.sin(dt * 11.3) * 0.025 + Math.sin(dt * 1.7) * 0.06;
      setN(Math.max(0, Math.min(1, level + wobble)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  // Needle pivot at bottom-centre, sweep -50° to +50°
  const cx = width / 2, cy = height + 6;
  const arcR = height * 0.95;
  const ang = (-50 + n * 100) * Math.PI / 180;
  const tipX = cx + Math.sin(ang) * arcR;
  const tipY = cy - Math.cos(ang) * arcR;

  return (
    <div style={{
      position: 'relative',
      width, height,
      background: faceColor,
      borderRadius: 4,
      overflow: 'hidden',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -8px 16px rgba(0,0,0,0.08)',
    }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
        {/* Scale arc + tick marks */}
        {showScale && Array.from({ length: 11 }).map((_, i) => {
          const t = i / 10;
          const a = (-50 + t * 100) * Math.PI / 180;
          const r1 = arcR - 8, r2 = arcR - (i % 5 === 0 ? 22 : 16);
          const x1 = cx + Math.sin(a) * r1, y1 = cy - Math.cos(a) * r1;
          const x2 = cx + Math.sin(a) * r2, y2 = cy - Math.cos(a) * r2;
          const inRed = t > redLine;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={inRed ? redColor : inkColor} strokeWidth={i % 5 === 0 ? 1.6 : 1} opacity={inRed ? 0.95 : 0.75} />;
        })}
        {/* Scale labels */}
        {showScale && ['-20', '-10', '0', '+3'].map((s, i) => {
          const t = [0, 0.4, 0.7, 0.9][i];
          const a = (-50 + t * 100) * Math.PI / 180;
          const r = arcR - 30;
          const x = cx + Math.sin(a) * r, y = cy - Math.cos(a) * r;
          return <text key={s} x={x} y={y} fontFamily="JetBrains Mono, monospace" fontSize="9"
            fill={t > redLine ? redColor : inkColor} opacity="0.85" textAnchor="middle" dominantBaseline="middle">{s}</text>;
        })}
        {/* Red bar at top of red zone */}
        <path
          d={`M ${cx + Math.sin(redLine*Math.PI/180*100 - 50*Math.PI/180) * (arcR-8)} ${cy - Math.cos((-50+redLine*100)*Math.PI/180) * (arcR-8)}
              A ${arcR-8} ${arcR-8} 0 0 1
              ${cx + Math.sin(50*Math.PI/180)*(arcR-8)} ${cy - Math.cos(50*Math.PI/180)*(arcR-8)}`}
          fill="none" stroke={redColor} strokeWidth="2" opacity="0.9"/>
        {/* Needle */}
        <line x1={cx} y1={cy} x2={tipX} y2={tipY}
          stroke={needleColor} strokeWidth="1.6" strokeLinecap="round" />
        {/* Pivot */}
        <circle cx={cx} cy={cy} r="5" fill={needleColor} />
        <circle cx={cx} cy={cy} r="2" fill={faceColor} />
        {/* Label */}
        <text x={12} y={height - 10} fontFamily="JetBrains Mono, monospace" fontSize="9"
          fill={inkColor} opacity="0.6" letterSpacing="2">{label}</text>
        <text x={width - 12} y={height - 10} fontFamily="JetBrains Mono, monospace" fontSize="9"
          fill={inkColor} opacity="0.6" textAnchor="end" letterSpacing="2">VU</text>
      </svg>
    </div>
  );
}

// --- Spectrum bars (animated) ------------------------------------------------
function Spectrum({ bars = 24, height = 28, color = '#fff', baseHeight = 0.18, gap = 2, width = 'auto' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height, width }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          flex: 1,
          background: color,
          borderRadius: 1,
          height: `${(baseHeight + Math.random() * (1 - baseHeight)) * 100}%`,
          animation: `specBar ${0.5 + Math.random() * 0.6}s ease-in-out ${-Math.random() * 1}s infinite alternate`,
        }}/>
      ))}
      <style>{`
        @keyframes specBar {
          0%   { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

// --- Tuning dial strip (used in retro variant) -------------------------------
function TuningStrip({ width, height = 70, freq = 101.5, min = 88, max = 108, color = '#f0d089', ink = '#1b1207' }) {
  // Compute tick layout
  const ticks = [];
  for (let f = Math.ceil(min); f <= Math.floor(max); f++) {
    ticks.push(f);
  }
  // Needle position
  const nx = ((freq - min) / (max - min)) * width;

  return (
    <div style={{
      position: 'relative',
      width, height,
      background: `linear-gradient(180deg, ${color} 0%, #e8c075 50%, ${color} 100%)`,
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.25), inset 0 -2px 4px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.15)',
      overflow: 'hidden',
      borderRadius: 2,
    }}>
      {/* Tick marks */}
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
        {ticks.map(f => {
          const x = ((f - min) / (max - min)) * width;
          const major = f % 5 === 0;
          return (
            <g key={f}>
              <line x1={x} y1={6} x2={x} y2={major ? 22 : 14} stroke={ink} strokeWidth={major ? 1.4 : 1} opacity="0.85"/>
              {major && (
                <text x={x} y={36} fontFamily="DM Serif Display, serif" fontSize="14" fill={ink}
                  opacity="0.95" textAnchor="middle">{f}</text>
              )}
              <line x1={x} y1={height - 6} x2={x} y2={height - (major ? 22 : 14)} stroke={ink} strokeWidth={major ? 1.4 : 1} opacity="0.85"/>
            </g>
          );
        })}
        {/* Frequency band labels */}
        <text x={10} y={height - 8} fontFamily="JetBrains Mono, monospace" fontSize="9"
          fill={ink} opacity="0.7" letterSpacing="2">FM · MHz</text>
        <text x={width - 10} y={height - 8} fontFamily="JetBrains Mono, monospace" fontSize="9"
          fill={ink} opacity="0.7" textAnchor="end" letterSpacing="2">STEREO</text>
      </svg>
      {/* Red needle */}
      <div style={{
        position: 'absolute', left: nx - 1, top: 0, width: 2, height: '100%',
        background: '#c8281f',
        boxShadow: '0 0 6px rgba(200,40,31,0.7)',
      }}/>
      <div style={{
        position: 'absolute', left: nx - 5, top: -4, width: 10, height: 10,
        background: '#c8281f', clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
      }}/>
    </div>
  );
}

// --- Rotary knob (used in retro variant) -------------------------------------
function Knob({ size = 92, value = 0.55, label = '', sublabel = '', tickColor = '#3b2410', faceGradient }) {
  // value 0..1 maps to -135deg..+135deg
  const angle = -135 + value * 270;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        position: 'relative', width: size, height: size,
      }}>
        {/* Tick ring */}
        <svg viewBox="0 0 100 100" width={size} height={size}
          style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 25 }).map((_, i) => {
            const a = (-135 + (i / 24) * 270) * Math.PI / 180;
            const r1 = 49, r2 = 44;
            const x1 = 50 + Math.sin(a) * r1, y1 = 50 - Math.cos(a) * r1;
            const x2 = 50 + Math.sin(a) * r2, y2 = 50 - Math.cos(a) * r2;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tickColor} strokeWidth={i % 6 === 0 ? 1.4 : 0.6} opacity="0.9"/>;
          })}
        </svg>
        {/* Knob face */}
        <div style={{
          position: 'absolute', inset: size * 0.085,
          borderRadius: '50%',
          background: faceGradient || 'radial-gradient(circle at 35% 30%, #f6e7c2, #c69247 45%, #6a4111 100%)',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.45)',
          transform: `rotate(${angle}deg)`,
        }}>
          {/* Indicator dot */}
          <div style={{
            position: 'absolute', left: '50%', top: '8%', transform: 'translateX(-50%)',
            width: size * 0.07, height: size * 0.18,
            borderRadius: size * 0.05,
            background: '#1b1207',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}/>
        </div>
      </div>
      {label && (
        <div style={{
          font: '500 9px/1 "JetBrains Mono", monospace', letterSpacing: '0.25em',
          color: tickColor, textTransform: 'uppercase',
        }}>{label}</div>
      )}
      {sublabel && (
        <div style={{
          font: '400 8px/1 "JetBrains Mono", monospace', letterSpacing: '0.18em',
          color: tickColor, opacity: 0.6, textTransform: 'uppercase',
        }}>{sublabel}</div>
      )}
    </div>
  );
}

// Wrapper that crops the earth image around a target location
function EarthBg({ src = 'assets/earth-globe.png', focusX = 0.595, focusY = 0.46, zoom = 1.15 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: '#000',
    }}>
      <img src={src} alt="" style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: `translate(-50%, -50%) scale(${zoom})`,
        transformOrigin: `${focusX * 100}% ${focusY * 100}%`,
        width: '100%', height: '100%',
        objectFit: 'cover',
        objectPosition: `${focusX * 100}% ${focusY * 100}%`,
      }}/>
    </div>
  );
}

Object.assign(window, {
  STATIONS, NEARBY, RadarCursor, VUMeter, Spectrum, TuningStrip, Knob, EarthBg,
});
