import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useLang } from '../i18n'

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

function pad(n) { return String(n).padStart(2, '0') }

export default function AdminPage({ token, onLogout }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [lockers, setLockers] = useState([])
  const [baseUrl, setBaseUrl] = useState(window.location.origin)
  const [resetMsg, setResetMsg] = useState({})
  const [unlockLinks, setUnlockLinks] = useState({})
  const [generatingLink, setGeneratingLink] = useState({})
  const [copied, setCopied] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [log, setLog] = useState([])
  const [showLog, setShowLog] = useState(false)
  const [smsEnabled, setSmsEnabled] = useState(true)
  const [smsBusy, setSmsBusy] = useState(false)

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  const guard = (res) => { if (res.status === 401) onLogout(); return res }

  const refresh = () => fetch('/api/lockers').then(r => r.json()).then(setLockers)
  const refreshLog = () => fetch('/api/log', { headers: authHeaders }).then(guard).then(r => r.ok ? r.json() : []).then(setLog)
  const refreshSettings = () => fetch('/api/admin/settings', { headers: authHeaders }).then(guard).then(r => r.ok ? r.json() : null).then(s => { if (s) setSmsEnabled(!!s.sms_enabled) })

  const toggleSms = async () => {
    const next = !smsEnabled
    setSmsEnabled(next)          // optimistic
    setSmsBusy(true)
    const res = guard(await fetch('/api/admin/settings', { method: 'POST', headers: authHeaders, body: JSON.stringify({ sms_enabled: next }) }))
    setSmsBusy(false)
    if (res.ok) { const s = await res.json(); setSmsEnabled(!!s.sms_enabled) }
    else setSmsEnabled(!next)    // revert on failure
  }

  useEffect(() => { refresh(); refreshLog(); refreshSettings() }, [])
  useEffect(() => { const t = setInterval(refresh, 4000); return () => clearInterval(t) }, [])

  const generateLink = async (id) => {
    setGeneratingLink(g => ({ ...g, [id]: true }))
    const res = guard(await fetch(`/api/locker/${id}/generate-token`, { method: 'POST', headers: authHeaders }))
    const data = await res.json()
    setGeneratingLink(g => ({ ...g, [id]: false }))
    if (res.ok) setUnlockLinks(l => ({ ...l, [id]: `${baseUrl}/pickup/${data.token}` }))
  }

  const handleReset = async (id) => {
    const res = guard(await fetch(`/api/locker/${id}/reset`, { method: 'POST', headers: authHeaders }))
    const data = await res.json()
    setResetMsg({ [id]: res.ok ? t('ad.reset.ok') : data.error })
    refresh(); refreshLog()
    setTimeout(() => setResetMsg(m => { const n = {...m}; delete n[id]; return n }), 2800)
  }

  const handleCopy = (id) => {
    copyText(unlockLinks[id])
    setCopied(c => ({ ...c, [id]: true }))
    setTimeout(() => setCopied(c => { const n = {...c}; delete n[id]; return n }), 1800)
  }

  const total = lockers.length
  const openCount = lockers.filter(l => !l.locked).length
  const lockedCount = lockers.filter(l => l.locked).length

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '28px 18px 80px', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ marginBottom: 22, animation: 'riseIn 0.5s cubic-bezier(0.2,0.7,0.2,1) both' }}>
        <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.18em', color: 'oklch(0.5 0.12 295)', marginBottom: 8 }}>
          {t('ad.tag')}
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('ad.title')}</h1>
        <p style={{ margin: 0, color: '#6E6880', fontSize: 14, lineHeight: 1.5 }}>
          {t('ad.copy')}
        </p>
      </div>

      {/* Sign out + stats */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, animation: 'riseIn 0.5s 0.04s cubic-bezier(0.2,0.7,0.2,1) both' }}>
        <button onClick={onLogout} style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.12em', minHeight: 36, padding: '7px 16px', borderRadius: 999, border: '1px solid rgba(43,39,51,0.12)', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', color: '#8A8499', cursor: 'pointer' }}>
          {t('ad.signout')}
        </button>
      </div>

      {/* Stats chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { count: total,       dot: 'oklch(0.75 0.1 295)', label: t('ad.stat.total'),  delay: '0.06s' },
          { count: openCount,   dot: 'oklch(0.78 0.1 165)', label: t('ad.stat.open'),   delay: '0.11s' },
          { count: lockedCount, dot: 'oklch(0.78 0.1 30)',  label: t('ad.stat.locked'), delay: '0.16s' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 18, padding: '14px 16px', boxShadow: '0 6px 20px oklch(0.65 0.08 295 / 0.07)', animation: `riseIn 0.5s ${s.delay} cubic-bezier(0.2,0.7,0.2,1) both` }}>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{s.count}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.14em', color: '#8A8499', marginTop: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Base URL control */}
      <div style={{ marginBottom: 20, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'riseIn 0.5s 0.2s cubic-bezier(0.2,0.7,0.2,1) both' }}>
        <div>
          <label style={{ display: 'block', fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#8A8499', marginBottom: 6 }}>{t('ad.label.baseurl')}</label>
          <input className="sl-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
        </div>

        {/* SMS on-lock toggle */}
        <div style={{ borderTop: '1px solid rgba(43,39,51,0.07)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2B2733' }}>{t('ad.sms.label')}</span>
              <span style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 9, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 999,
                background: smsEnabled ? 'oklch(0.93 0.05 165)' : 'oklch(0.94 0.01 295)',
                color: smsEnabled ? 'oklch(0.42 0.09 165)' : '#9A94A8' }}>
                {smsEnabled ? t('ad.sms.on') : t('ad.sms.off')}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#8A8499', lineHeight: 1.45, marginTop: 4 }}>{t('ad.sms.hint')}</div>
          </div>
          <button
            role="switch" aria-checked={smsEnabled} aria-label={t('ad.sms.label')}
            onClick={toggleSms} disabled={smsBusy}
            style={{
              position: 'relative', flexShrink: 0, width: 50, height: 30, borderRadius: 999, border: 'none',
              cursor: smsBusy ? 'default' : 'pointer', padding: 0,
              background: smsEnabled ? 'oklch(0.62 0.13 165)' : 'oklch(0.86 0.02 295)',
              opacity: smsBusy ? 0.6 : 1,
              transition: 'background 0.3s',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
            }}>
            <span style={{
              position: 'absolute', top: 3, left: 3, width: 24, height: 24, borderRadius: '50%', background: '#FBFAF7',
              boxShadow: '0 2px 5px rgba(0,0,0,0.22)',
              transform: smsEnabled ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.3, 1.3, 0.4, 1)',
            }} />
          </button>
        </div>
      </div>

      {/* 2-column slot grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {lockers.map((locker, i) => (
          <SlotCard
            key={locker.id}
            locker={locker}
            index={i}
            baseUrl={baseUrl}
            isExpanded={expanded === locker.id}
            unlockLink={unlockLinks[locker.id]}
            generating={generatingLink[locker.id]}
            resetMsg={resetMsg[locker.id]}
            isCopied={copied[locker.id]}
            onToggle={() => setExpanded(e => e === locker.id ? null : locker.id)}
            onOpen={() => navigate(`/locker/${locker.id}`)}
            onReset={() => handleReset(locker.id)}
            onGenerate={() => generateLink(locker.id)}
            onCopy={() => handleCopy(locker.id)}
            onClearLink={() => setUnlockLinks(l => { const n = {...l}; delete n[locker.id]; return n })}
          />
        ))}
      </div>

      {/* Activity log */}
      <div style={{ marginTop: 24 }}>
        <button onClick={() => { setShowLog(s => !s); refreshLog() }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 16, padding: '13px 16px', cursor: 'pointer' }}>
          <span style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.14em', color: '#6E6880' }}>{t('ad.log')}</span>
          <span style={{ fontSize: 12, color: '#ABA4BC', transform: showLog ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {showLog && (
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 16, overflow: 'hidden', animation: 'riseIn 0.3s both' }}>
            {log.length === 0 && <div style={{ padding: 16, fontSize: 13, color: '#8A8499', textAlign: 'center' }}>{t('ad.log.empty')}</div>}
            {log.map((e, i) => {
              const c = e.ok ? { bg: 'oklch(0.93 0.05 165)', fg: 'oklch(0.42 0.09 165)' } : { bg: 'oklch(0.93 0.05 30)', fg: 'oklch(0.45 0.11 30)' }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '1px solid rgba(43,39,51,0.05)' : 'none' }}>
                  <span style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, fontWeight: 700, minWidth: 26 }}>{pad(e.slot)}</span>
                  <span style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 9, letterSpacing: '0.1em', padding: '3px 8px', borderRadius: 999, background: c.bg, color: c.fg, textTransform: 'uppercase' }}>{e.action}{e.ok ? '' : ' ✗'}</span>
                  <span style={{ fontSize: 12, color: '#8A8499' }}>{e.method}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, color: '#ABA4BC' }}>{e.time.replace('T', ' ').slice(5)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function LockGlyph({ open }) {
  const s = 18, ink = '#FBFAF7', bw = Math.max(2, Math.round(s * 0.12))
  return (
    <div style={{ position: 'relative', width: s, height: s * 1.06 }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%',
        width: s * 0.56, height: s * 0.46, marginLeft: -(s * 0.28),
        border: `${bw}px solid ${ink}`, borderBottom: 'none',
        borderRadius: `${s * 0.3}px ${s * 0.3}px 0 0`,
        transformOrigin: `${s * 0.08}px ${s * 0.46}px`,
        transform: open ? 'rotate(-32deg)' : 'none',
        transition: 'transform 0.55s 0.2s cubic-bezier(0.3, 1.4, 0.4, 1)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        width: s * 0.92, height: s * 0.62, marginLeft: -(s * 0.46),
        background: ink, borderRadius: s * 0.18,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '30%',
          width: s * 0.18, height: s * 0.18, marginLeft: -(s * 0.09),
          borderRadius: '50%', background: '#2B2733',
        }} />
      </div>
    </div>
  )
}

function SlotCard({ locker, index, baseUrl, isExpanded, unlockLink, generating, resetMsg, isCopied, onToggle, onOpen, onReset, onGenerate, onCopy, onClearLink }) {
  const { t } = useLang()
  const locked = locker.locked
  const mint = { bg: 'oklch(0.93 0.05 165)', fg: 'oklch(0.42 0.09 165)', dot: 'oklch(0.7 0.12 165)' }
  const rose = { bg: 'oklch(0.93 0.05 30)',  fg: 'oklch(0.45 0.11 30)',  dot: 'oklch(0.68 0.15 30)' }
  const c = locked ? rose : mint

  return (
    <div style={{
      gridColumn: isExpanded ? '1 / -1' : 'auto',
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(12px)',
      border: `1.5px solid ${isExpanded ? 'oklch(0.78 0.1 295)' : (locked ? 'oklch(0.88 0.05 30)' : 'oklch(0.9 0.04 165)')}`,
      borderRadius: 22,
      overflow: 'hidden',
      boxShadow: isExpanded ? '0 18px 44px oklch(0.62 0.1 295 / 0.22)' : '0 4px 16px oklch(0.65 0.08 295 / 0.06)',
      animation: `riseIn 0.5s ${(0.08 + index * 0.06).toFixed(2)}s cubic-bezier(0.2,0.7,0.2,1) both`,
      transition: 'border-color 0.35s, box-shadow 0.35s',
    }}>

      {/* Tap target */}
      <button onClick={onToggle} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12,
        width: '100%', padding: 14, background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.15s',
      }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.985)'}
        onMouseUp={e => e.currentTarget.style.transform = ''}
        onMouseLeave={e => e.currentTarget.style.transform = ''}
      >

        {/* Top row: bullet + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {/* 3D flip bullet */}
          <div style={{ width: 44, height: 44, flexShrink: 0, perspective: '240px' }}>
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s cubic-bezier(0.3, 1.3, 0.4, 1)',
              transform: isExpanded ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              {/* Front face: number */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                borderRadius: 15, background: c.bg, color: c.fg,
                display: 'grid', placeItems: 'center',
                fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontWeight: 700, fontSize: 15,
              }}>
                {pad(locker.id)}
              </div>
              {/* Back face: lock glyph */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                borderRadius: 15, background: '#2B2733',
                display: 'grid', placeItems: 'center',
                transform: 'rotateY(180deg)',
              }}>
                <LockGlyph open={!locked} />
              </div>
            </div>
          </div>

          {/* Chevron */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: 'oklch(0.96 0.02 295)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
            transition: 'transform 0.45s cubic-bezier(0.3, 1.3, 0.4, 1)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <div style={{ width: 9, height: 9, borderRight: '2px solid #6E6880', borderBottom: '2px solid #6E6880', transform: 'rotate(45deg)', marginTop: -3 }} />
          </div>
        </div>

        {/* Slot label */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Slot {pad(locker.id)}</div>
          <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.08em', color: '#8A8499', marginTop: 3 }}>
            {locked ? t('ad.slot.occupied') : t('ad.slot.available')}
          </div>
        </div>

        {/* Status pill */}
        <div style={{ display: 'flex' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.12em',
            padding: '7px 12px', borderRadius: 999, background: c.bg, color: c.fg,
          }}>
            <span style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c.dot }} />
              {locked && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c.dot, animation: 'dotPing 1.8s ease-out infinite' }} />}
            </span>
            {locked ? t('ad.slot.locked') : t('ad.slot.open')}
          </div>
        </div>
      </button>

      {/* Expandable panel (spring expand via grid-template-rows) */}
      <div style={{
        display: 'grid',
        gridTemplateRows: isExpanded ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.55s cubic-bezier(0.3, 1.1, 0.3, 1)',
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{
            borderTop: '1px solid rgba(43,39,51,0.06)',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.4s 0.12s, transform 0.5s 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}>

            {/* QR block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', border: '1px solid rgba(43,39,51,0.06)', borderRadius: 16, padding: 12 }}>
              <div style={{ width: 92, height: 92, flexShrink: 0, animation: 'qrPop 0.5s 0.15s cubic-bezier(0.2, 0.8, 0.3, 1.2) both' }}>
                <QRCodeSVG value={`${baseUrl}/locker/${locker.id}`} size={92} fgColor="#2B2733" bgColor="transparent" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 9, letterSpacing: '0.14em', color: '#8A8499', marginBottom: 5 }}>{t('ad.qr')}</div>
                <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, color: '#9A94A8', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {baseUrl}/locker/{locker.id}
                </div>
              </div>
            </div>

            {/* Open locker page button */}
            <button onClick={onOpen} style={{
              position: 'relative', overflow: 'hidden', width: '100%', minHeight: 48,
              border: 'none', borderRadius: 14, background: 'oklch(0.4 0.13 295)', color: '#FBFAF7',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 8px 22px oklch(0.55 0.13 295 / 0.28)',
              transition: 'transform 0.15s',
            }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = ''}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              {t('ad.btn.openpage')}
            </button>

            {/* Locked-only actions */}
            {locked && (
              <>
                {!unlockLink ? (
                  <button onClick={onGenerate} disabled={generating} style={{
                    width: '100%', minHeight: 48,
                    border: '1.5px dashed oklch(0.75 0.08 295)',
                    borderRadius: 14, color: 'oklch(0.45 0.12 295)',
                    fontSize: 14, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                    background: generating
                      ? 'linear-gradient(105deg, oklch(0.96 0.02 295) 40%, oklch(0.9 0.05 295) 50%, oklch(0.96 0.02 295) 60%) 0 0 / 200% 100%'
                      : 'oklch(0.97 0.015 295)',
                    backgroundSize: generating ? '200% 100%' : undefined,
                    animation: generating ? 'shimmer 1.2s linear infinite' : undefined,
                    transition: 'transform 0.15s',
                  }}>
                    {generating ? t('ad.btn.gen') : t('ad.btn.genlink')}
                  </button>
                ) : (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
                    background: 'oklch(0.97 0.02 295)', borderRadius: 16,
                    border: '1px solid oklch(0.9 0.04 295)',
                    animation: 'riseIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                  }}>
                    <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 9, letterSpacing: '0.14em', color: '#8A8499' }}>
                      {t('ad.link.title')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', background: '#FFFFFF', borderRadius: 12, padding: 10, border: '1px solid rgba(43,39,51,0.06)' }}>
                      <div style={{ width: 104, height: 104, animation: 'qrPop 0.5s cubic-bezier(0.2, 0.8, 0.3, 1.2) both' }}>
                        <QRCodeSVG value={unlockLink} size={104} fgColor="#2B2733" bgColor="transparent" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={onCopy} style={{
                        flex: 1, minHeight: 44, border: '1px solid rgba(43,39,51,0.12)',
                        borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.25s, color 0.25s, transform 0.15s',
                        background: isCopied ? 'oklch(0.93 0.05 165)' : 'transparent',
                        color: isCopied ? 'oklch(0.42 0.09 165)' : '#2B2733',
                      }}>
                        {isCopied ? t('ad.btn.copied') : t('ad.btn.copy')}
                      </button>
                      <button onClick={onClearLink} style={{
                        flex: 1, minHeight: 44, border: '1px solid rgba(43,39,51,0.12)',
                        background: 'transparent', color: '#6E6880',
                        borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.2s, transform 0.15s',
                      }}
                        onMouseOver={e => e.currentTarget.style.background = 'oklch(0.95 0.03 295)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {t('ad.btn.clear')}
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={onReset} style={{
                  width: '100%', minHeight: 48, border: 'none',
                  background: 'oklch(0.93 0.05 30)', color: 'oklch(0.45 0.11 30)',
                  borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'filter 0.2s, transform 0.15s',
                }}
                  onMouseOver={e => e.currentTarget.style.filter = 'brightness(0.96)'}
                  onMouseOut={e => e.currentTarget.style.filter = ''}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseUp={e => e.currentTarget.style.transform = ''}
                >
                  {t('ad.btn.reset')}
                </button>
              </>
            )}

            {/* Status message */}
            {resetMsg && (
              <div style={{
                position: 'relative', overflow: 'hidden',
                padding: '11px 14px', borderRadius: 12, fontSize: 13,
                background: 'oklch(0.96 0.03 165)', color: 'oklch(0.42 0.09 165)',
                border: '1px solid oklch(0.88 0.05 165)',
                animation: 'riseIn 0.3s both',
              }}>
                {resetMsg}
                <span style={{
                  position: 'absolute', top: 0, bottom: 0, width: '40%',
                  background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.7), transparent)',
                  animation: 'sheen 1.2s ease-out 0.2s both',
                }} />
              </div>
            )}

          </div>
        </div>
      </div>

    </div>
  )
}
