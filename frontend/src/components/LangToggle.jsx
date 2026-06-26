import { useLang } from '../i18n'

export default function LangToggle() {
  const { lang, setLang } = useLang()
  const opt = (code, label) => (
    <button
      onClick={() => setLang(code)}
      style={{
        border: 'none', cursor: 'pointer',
        fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.08em',
        padding: '6px 12px', borderRadius: 999,
        background: lang === code ? '#2B2733' : 'transparent',
        color: lang === code ? '#FBFAF7' : '#6E6880',
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{
      position: 'fixed', top: 18, right: 18, zIndex: 70,
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: 4, borderRadius: 999,
      border: '1px solid rgba(43,39,51,0.08)',
      boxShadow: '0 8px 24px oklch(0.6 0.1 295 / 0.14)',
    }}>
      {opt('th', 'TH')}
      {opt('en', 'ENG')}
    </div>
  )
}
