/* ============================================================
   Glass — Mobile (iOS + Android)
   Same visual DNA as GlassVariant: frosted panels, mint accent,
   radar cursor over Earth. Adapted for portrait phone canvas.
   ============================================================ */

const GM_ACCENT = '#7CFFC4';
const GM_INK    = 'rgba(255,255,255,0.95)';
const GM_DIM    = 'rgba(255,255,255,0.55)';
const GM_FAINT  = 'rgba(255,255,255,0.28)';
const GM_BG     = 'rgba(14,18,22,0.42)';

const gmPanel = {
  background: GM_BG,
  backdropFilter: 'blur(28px) saturate(140%)',
  WebkitBackdropFilter: 'blur(28px) saturate(140%)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 18,
  boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 20px 40px rgba(0,0,0,0.35)',
};

const GMHair = ({ children, color = GM_DIM, size = 10 }) => (
  <div style={{
    font: `300 ${size}px/1 "JetBrains Mono", monospace`,
    letterSpacing: '0.26em',
    color,
    textTransform: 'uppercase',
  }}>{children}</div>
);

function GMIcon({ name, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'globe':  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case 'heart':  return <svg {...common}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>;
    case 'map':    return <svg {...common}><path d="M9 5 3 7v12l6-2 6 2 6-2V5l-6 2-6-2z"/><path d="M9 5v12M15 7v12"/></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3"/></svg>;
    case 'profile':return <svg {...common}><circle cx="12" cy="9" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>;
    case 'play':   return <svg {...common} fill="currentColor" stroke="none"><path d="M7 5v14l12-7z"/></svg>;
    case 'pause':  return <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
    case 'prev':   return <svg {...common} fill="currentColor" stroke="none"><path d="M7 5v14M19 5l-10 7 10 7z"/></svg>;
    case 'next':   return <svg {...common} fill="currentColor" stroke="none"><path d="M17 5v14M5 5l10 7-10 7z"/></svg>;
    case 'compass':return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 16 2.5-5.5L16 8l-2.5 5.5L8 16z"/></svg>;
    case 'plus':   return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':  return <svg {...common}><path d="M5 12h14"/></svg>;
    case 'list':   return <svg {...common}><path d="M4 7h16M4 12h16M4 17h10"/></svg>;
    default: return null;
  }
}

/* ──────────────── Shared mobile content ──────────────── */

function GMHeader({ withDynamicIslandPadding = false, withStatusBarPadding = true }) {
  return (
    <div style={{
      padding: `${withStatusBarPadding ? 56 : 16}px 20px 0`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{
        ...gmPanel, padding: '7px 12px', borderRadius: 999,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: GM_ACCENT, boxShadow: `0 0 8px ${GM_ACCENT}` }}/>
        <span style={{ font: '300 10px/1 "JetBrains Mono", monospace', color: GM_INK, letterSpacing: '0.22em' }}>EARTH RADIO</span>
      </div>
      <div style={{
        ...gmPanel, padding: '7px 12px', borderRadius: 999,
        display: 'flex', alignItems: 'center', gap: 8, color: GM_INK,
      }}>
        <GMIcon name="search" size={14}/>
      </div>
    </div>
  );
}

function GMLocationHeadline() {
  return (
    <div style={{ padding: '20px 20px 0' }}>
      <GMHair>Now tuning</GMHair>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8,
      }}>
        <div style={{
          font: '200 56px/1 "Inter", "Noto Sans SC"',
          color: GM_INK, letterSpacing: '-0.02em',
        }}>宁夏</div>
        <div style={{ font: '300 11px/1 "JetBrains Mono", monospace', color: GM_DIM, letterSpacing: '0.15em' }}>
          NINGXIA · CN
        </div>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10,
      }}>
        <GMHair color={GM_FAINT}>38°28′N · 106°15′E</GMHair>
        <GMHair color={GM_ACCENT}>● 12,652 stations</GMHair>
      </div>
    </div>
  );
}

function GMRadarStage({ height = 340 }) {
  return (
    <div style={{
      position: 'relative',
      height,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <RadarCursor size={250} color={GM_ACCENT} ringOpacity={0.6} sweepOpacity={0.85}
        showCrosshair={true} speed={4.5} thickness={1}/>
      {/* Floating compass + zoom on right edge of stage */}
      <div style={{
        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
      }}>
        <div style={{ ...gmPanel, padding: 2, display: 'flex', flexDirection: 'column', borderRadius: 14 }}>
          {['plus', 'minus'].map((s, i) => (
            <button key={s} style={{
              all: 'unset', cursor: 'pointer',
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: GM_INK,
              borderBottom: i === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <GMIcon name={s} size={14}/>
            </button>
          ))}
        </div>
        <div style={{
          ...gmPanel,
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', color: GM_INK,
        }}>
          <div style={{
            position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)',
            width: 2, height: 10, background: GM_ACCENT, borderRadius: 2,
          }}/>
          <div style={{ font: '500 11px/1 "Inter"' }}>N</div>
        </div>
      </div>
    </div>
  );
}

function GMNearbyChips() {
  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <GMHair>Nearby · 0–40km</GMHair>
        <GMHair color={GM_ACCENT}>● 6 in range</GMHair>
      </div>
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        padding: '4px 0 4px',
        scrollbarWidth: 'none',
      }}>
        {NEARBY.map((s, i) => (
          <div key={s.name} style={{
            ...gmPanel,
            borderRadius: 14,
            padding: '10px 14px',
            minWidth: 140,
            flexShrink: 0,
            borderColor: i === 0 ? GM_ACCENT : 'rgba(255,255,255,0.10)',
            border: i === 0 ? `1px solid ${GM_ACCENT}66` : '1px solid rgba(255,255,255,0.10)',
            boxShadow: i === 0
              ? `0 0 0 1px ${GM_ACCENT}33, 0 12px 24px rgba(0,0,0,0.35)`
              : '0 12px 24px rgba(0,0,0,0.35)',
          }}>
            <div style={{
              font: '300 11px/1 "JetBrains Mono", monospace',
              color: i === 0 ? GM_ACCENT : GM_DIM,
              letterSpacing: '0.1em',
            }}>{s.freq}</div>
            <div style={{
              font: '500 13px/1.25 "Inter", "Noto Sans SC"',
              color: GM_INK, marginTop: 6,
            }}>{s.name}</div>
            <div style={{
              font: '300 10px/1 "JetBrains Mono", monospace',
              color: GM_FAINT, letterSpacing: '0.12em', marginTop: 6,
            }}>{s.km}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GMNowPlaying() {
  const [playing, setPlaying] = React.useState(true);
  return (
    <div style={{
      ...gmPanel,
      margin: '14px 16px 0',
      padding: '14px 16px',
      borderRadius: 22,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg, ${GM_ACCENT}, #6CC3A6)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 20px ${GM_ACCENT}44`,
        }}>
          <Spectrum bars={4} height={24} color="rgba(14,18,22,0.85)" width={22} gap={2} baseHeight={0.4}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: '500 15px/1.2 "Inter", "Noto Sans SC"',
            color: GM_INK,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>宁夏交通广播</div>
          <div style={{
            font: '300 10px/1 "JetBrains Mono", monospace',
            color: GM_DIM, marginTop: 5, letterSpacing: '0.14em',
          }}>FM 101.5 · TRAFFIC RADIO · LIVE 03:14</div>
        </div>
        <button style={{
          all: 'unset', cursor: 'pointer',
          width: 44, height: 44, borderRadius: '50%',
          background: GM_ACCENT, color: '#0e1216',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 24px ${GM_ACCENT}66`,
        }} onClick={() => setPlaying(p => !p)}>
          <GMIcon name={playing ? 'pause' : 'play'} size={18}/>
        </button>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Spectrum bars={42} height={22} color={GM_INK} gap={2} width="100%"/>
      </div>
    </div>
  );
}

/* ──────────────── iOS-specific bottom bar (liquid glass tab bar) ──────────────── */

function GMIosTabBar() {
  const items = [
    { k: 'explore', ico: 'globe',   label: '探索' },
    { k: 'favs',    ico: 'heart',   label: '收藏' },
    { k: 'browse',  ico: 'map',     label: '浏览' },
    { k: 'search',  ico: 'search',  label: '搜索' },
    { k: 'me',      ico: 'profile', label: '我' },
  ];
  const [active, setActive] = React.useState('explore');
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 38,
      ...gmPanel,
      borderRadius: 28,
      padding: '8px 8px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map(it => {
        const on = active === it.k;
        return (
          <button key={it.k} onClick={() => setActive(it.k)} style={{
            all: 'unset', cursor: 'pointer', flex: 1,
            padding: '8px 4px',
            borderRadius: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: on ? GM_ACCENT : GM_INK,
            opacity: on ? 1 : 0.55,
            background: on ? 'rgba(124,255,196,0.08)' : 'transparent',
          }}>
            <GMIcon name={it.ico} size={20}/>
            <span style={{ font: '500 10px/1 "Inter", "Noto Sans SC"', letterSpacing: '0.04em' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────── Android-specific bottom bar (Material 3 nav) ──────────────── */

function GMAndroidTabBar() {
  const items = [
    { k: 'explore', ico: 'globe',   label: '探索' },
    { k: 'favs',    ico: 'heart',   label: '收藏' },
    { k: 'browse',  ico: 'map',     label: '浏览' },
    { k: 'search',  ico: 'search',  label: '搜索' },
    { k: 'me',      ico: 'profile', label: '我' },
  ];
  const [active, setActive] = React.useState('explore');
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 26,
      ...gmPanel,
      borderRadius: 0,
      border: 'none',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '6px 6px 10px',
      display: 'flex', justifyContent: 'space-around',
      boxShadow: 'none',
    }}>
      {items.map(it => {
        const on = active === it.k;
        return (
          <button key={it.k} onClick={() => setActive(it.k)} style={{
            all: 'unset', cursor: 'pointer', flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 4px',
            color: on ? '#0e1216' : GM_INK,
            opacity: on ? 1 : 0.7,
          }}>
            <div style={{
              padding: '4px 16px', borderRadius: 999,
              background: on ? GM_ACCENT : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: on ? `0 0 18px ${GM_ACCENT}55` : 'none',
            }}>
              <GMIcon name={it.ico} size={20}/>
            </div>
            <span style={{
              font: '500 10px/1 "Inter", "Noto Sans SC"',
              color: GM_INK, opacity: on ? 1 : 0.7,
              letterSpacing: '0.04em',
            }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────── Phone screens ──────────────── */

function GMPhoneEarthBg() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden' }}>
      <img src="assets/earth-globe.png" alt=""
        style={{
          position: 'absolute',
          width: '180%', height: '180%',
          left: '50%', top: '46%',
          transform: 'translate(-50%, -50%) scale(1.02)',
          objectFit: 'cover',
        }}/>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 45%, transparent 25%, rgba(0,0,0,0.55) 100%)',
      }}/>
    </div>
  );
}

function GlassMobileScreen({ platform = 'ios' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', color: GM_INK }}>
      <GMPhoneEarthBg/>
      <div style={{ position: 'relative', height: '100%' }}>
        <GMHeader withStatusBarPadding={platform === 'ios'}/>
        <GMLocationHeadline/>
        <GMRadarStage height={platform === 'ios' ? 320 : 310}/>
        <GMNearbyChips/>
        <GMNowPlaying/>
        {/* breathing room before bottom bar */}
        <div style={{ height: 100 }}/>
        {platform === 'ios' ? <GMIosTabBar/> : <GMAndroidTabBar/>}
      </div>
    </div>
  );
}

/* ──────────────── Public wrappers (device-framed) ──────────────── */

function GlassIOS() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #1d1f23 0%, #0a0a0b 70%)',
    }}>
      <IOSDevice width={402} height={874} dark={true}>
        <div style={{ position: 'relative', height: '100%' }}>
          <GlassMobileScreen platform="ios"/>
        </div>
      </IOSDevice>
    </div>
  );
}

function GlassAndroid() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #1d1f23 0%, #0a0a0b 70%)',
    }}>
      <AndroidDevice width={412} height={892} dark={true}>
        <div style={{ position: 'relative', height: '100%' }}>
          <GlassMobileScreen platform="android"/>
        </div>
      </AndroidDevice>
    </div>
  );
}

Object.assign(window, { GlassIOS, GlassAndroid });
