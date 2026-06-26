import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import LockIcon from '../components/LockIcon'
import { useLang } from '../i18n'
import { api } from '../api'

const MINT_BG = 'oklch(0.93 0.05 165)', MINT_FG = 'oklch(0.42 0.09 165)'
const ROSE_BG = 'oklch(0.93 0.05 30)',  ROSE_FG = 'oklch(0.45 0.11 30)'

const STATES = { LOADING: 'loading', UNLOCKED: 'unlocked', LOCKED: 'locked', SUCCESS: 'success', ERROR: 'error' }

export default function LockerPage() {
  const { id } = useParams()
  const { t } = useLang()
  const slotLabel = String(id).padStart(2, '0')
  const [status, setStatus] = useState(STATES.LOADING)
  const [phone, setPhone] = useState('')
  const [sentPhone, setSentPhone] = useState('')
  const [msg, setMsg] = useState('')
  const [msgError, setMsgError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)   // full-screen loader while awaiting 202 Accepted
  const [phase, setPhase] = useState('idle') // idle | lockedOk | unlockedOk
  const [doorOpened, setDoorOpened] = useState(false)

  useEffect(() => {
    api(`locker/${id}`)
      .then(r => r.json())
      .then(d => setStatus(d.locked ? STATES.LOCKED : STATES.UNLOCKED))
      .catch(() => { setStatus(STATES.ERROR); setMsg(t('lk.err.server')) })
  }, [id])

  const setError = (m) => { setMsg(m); setMsgError(true) }
  const clearMsg = () => { setMsg(''); setMsgError(false) }

  const handleOpenDoor = async () => {
    setBusy(true); clearMsg()
    const res = await api(`locker/${id}/open`, { method: 'POST' })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setDoorOpened(true); setMsg(t('lk.door.released')); setMsgError(false) }
    else setError(data.error || t('lk.err.open'))
  }

  const handleLock = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) return setError(t('lk.err.phone'))
    // Full-screen loader until the gateway confirms (backend waits for 202 Accepted)
    setSending(true); clearMsg()
    try {
      const res = await api(`locker/${id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, base_url: window.location.origin }),
      })
      const data = await res.json()
      if (res.ok) { setStatus(STATES.SUCCESS); setPhase('lockedOk'); setSentPhone(data.phone || ''); setMsgError(!data.sms_sent) }
      else setError(data.error || t('lk.err.lock'))
    } catch {
      setError(t('lk.err.server'))
    } finally {
      setSending(false)
    }
  }

  const handleUnlock = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) return setError(t('lk.err.phonedrop'))
    setBusy(true); clearMsg()
    const res = await api(`locker/${id}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setStatus(STATES.SUCCESS); setPhase('unlockedOk') }
    else setError(data.error || t('lk.err.nomatch'))
  }

  const handleDone = () => {
    setPhase('idle'); setPhone(''); setSentPhone(''); clearMsg()
    api(`locker/${id}`).then(r => r.json()).then(d => setStatus(d.locked ? STATES.LOCKED : STATES.UNLOCKED))
  }

  // Derived display values
  const success = phase !== 'idle'
  const lockedOk = phase === 'lockedOk'
  const isLocked = status === STATES.LOCKED
  const pillLocked = success ? lockedOk : isLocked
  const heroOpen = success ? !lockedOk : !isLocked

  const gradFrom = pillLocked ? 'oklch(0.88 0.07 295)' : 'oklch(0.9 0.07 165)'
  const gradTo   = pillLocked ? 'oklch(0.9 0.07 30)'   : 'oklch(0.88 0.07 235)'

  let pageTitle, statusText, statusCopy
  if (success && lockedOk) {
    pageTitle = t('lk.title.sealed'); statusText = t('lk.pill.sealed')
    statusCopy = sentPhone ? t('lk.copy.sealed', { phone: sentPhone }) : t('lk.copy.sealed_nophone')
  } else if (success) {
    pageTitle = t('lk.title.unlocked'); statusText = t('lk.pill.openagain')
    statusCopy = t('lk.copy.unlocked')
  } else if (isLocked) {
    pageTitle = t('lk.title.inuse'); statusText = t('lk.pill.locked')
    statusCopy = t('lk.copy.inuse')
  } else {
    pageTitle = t('lk.title.drop'); statusText = t('lk.pill.open')
    statusCopy = t('lk.copy.drop')
  }

  const showLockForm   = status === STATES.UNLOCKED && !success
  const showUnlockForm = status === STATES.LOCKED && !success
  const showSuccess    = success

  if (status === STATES.LOADING) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 12, color: '#8A8499', letterSpacing: '0.1em' }}>{t('lk.loading')}</div>
      </div>
    )
  }

  if (sending) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, animation: 'riseIn 0.4s cubic-bezier(0.2,0.7,0.2,1) both' }}>
          <div style={{ position: 'relative', width: 116, height: 116, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(0.88 0.07 295), oklch(0.9 0.07 30))', display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px oklch(0.62 0.1 295 / 0.25)' }}>
            {/* spinning dashed ring */}
            <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1.5px dashed oklch(0.6 0.12 295 / 0.45)', animation: 'spinSlow 8s linear infinite' }} />
            {/* spinner arc */}
            <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '2.5px solid transparent', borderTopColor: 'oklch(0.55 0.14 295)', animation: 'spin 0.9s linear infinite' }} />
            {/* pulse rings */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid oklch(0.7 0.11 295)', animation: 'ringPulse 1.8s ease-out infinite' }} />
            <div style={{ animation: 'planeLaunch 1.4s ease-in-out infinite' }}><PaperPlaneIcon size={44} /></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)', marginBottom: 10 }}>
              {t('lk.bayslot', { n: slotLabel })}
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {t('lk.send.title')}
              <span style={{ animation: 'dotsBlink 1.4s infinite' }}>.</span>
              <span style={{ animation: 'dotsBlink 1.4s 0.2s infinite' }}>.</span>
              <span style={{ animation: 'dotsBlink 1.4s 0.4s infinite' }}>.</span>
            </h1>
            <p style={{ color: '#6E6880', fontSize: 14, lineHeight: 1.55 }}>{t('lk.send.copy')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 70px' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, animation: 'riseIn 0.5s cubic-bezier(0.2,0.7,0.2,1) both' }}>

        {/* Hero badge */}
        <div style={{ position: 'relative', width: 116, height: 116, borderRadius: '50%', background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`, display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px oklch(0.62 0.1 295 / 0.25)', animation: 'popIn 0.5s cubic-bezier(0.2,0.8,0.3,1.2) both' }}>
          {/* Dashed ring */}
          <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1.5px dashed oklch(0.6 0.12 295 / 0.5)', animation: 'spinSlow 26s linear infinite' }} />
          {/* Pulse rings on success */}
          {success && <>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid oklch(0.7 0.11 ${heroOpen ? 165 : 295})`, animation: 'ringPulse 1.8s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid oklch(0.7 0.11 ${heroOpen ? 165 : 295})`, animation: 'ringPulse 1.8s ease-out 0.9s infinite' }} />
          </>}
          {success && lockedOk ? <PaperPlaneIcon size={44} /> : <LockIcon open={heroOpen} size={46} />}
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)', marginBottom: 8 }}>
            {t('lk.bayslot', { n: slotLabel })}
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>{pageTitle}</h1>
          <div style={{ display: 'inline-block', fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: pillLocked ? ROSE_BG : MINT_BG, color: pillLocked ? ROSE_FG : MINT_FG, marginBottom: 12 }}>
            {statusText}
          </div>
          <p style={{ color: '#6E6880', fontSize: 15, lineHeight: 1.55 }}>{statusCopy}</p>
        </div>

        {/* Step 1: Open door */}
        {showLockForm && !doorOpened && (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)', animation: 'riseIn 0.45s 0.05s both' }}>
            <p style={{ color: '#6E6880', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
              {t('lk.open.hint')}
            </p>
            {msg && <MsgBox text={msg} error={msgError} />}
            <button className="sl-btn-primary" onClick={handleOpenDoor} disabled={busy}>
              {busy ? t('lk.open.busy') : t('lk.open.btn')}
            </button>
          </div>
        )}

        {/* Step 2: phone + send SMS */}
        {showLockForm && doorOpened && (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)', animation: 'riseIn 0.45s 0.05s both' }}>
            <FormField
              label={t('lk.label.rphone')}
              type="tel"
              inputMode="tel"
              placeholder={t('lk.ph.phone')}
              value={phone}
              onChange={e => { setPhone(e.target.value); clearMsg() }}
              onKeyDown={e => e.key === 'Enter' && handleLock()}
            />
            {msg && <MsgBox text={msg} error={msgError} />}
            <button className="sl-btn-primary" onClick={handleLock} disabled={busy}>{busy ? t('lk.btn.sending') : t('lk.btn.locksms')}</button>
            <button onClick={handleOpenDoor} disabled={busy} style={{
              width: '100%', padding: 13, borderRadius: 14,
              border: '1px solid rgba(43,39,51,0.12)', background: 'transparent',
              color: '#2B2733', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              {t('lk.open.again')}
            </button>
          </div>
        )}

        {/* Locked: unlock by phone number (or use the SMS link) */}
        {showUnlockForm && (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)', animation: 'riseIn 0.45s 0.05s both' }}>
            <FormField
              label={t('lk.label.yphone')}
              type="tel"
              inputMode="tel"
              placeholder={t('lk.ph.yphone')}
              value={phone}
              onChange={e => { setPhone(e.target.value); clearMsg() }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            />
            {msg && <MsgBox text={msg} error={msgError} />}
            <button className="sl-btn-primary" onClick={handleUnlock} disabled={busy}>{busy ? t('lk.btn.unlocking') : t('lk.btn.unlock')}</button>
            <p style={{ color: '#8A8499', fontSize: 12, textAlign: 'center', margin: 0 }}>
              {t('lk.hint.orsms')}
            </p>
          </div>
        )}

        {showSuccess && (
          <button onClick={handleDone} style={{ width: '100%', maxWidth: 280, padding: 14, borderRadius: 16, border: '1px solid rgba(43,39,51,0.12)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', color: '#2B2733', fontSize: 15, fontWeight: 600, cursor: 'pointer', animation: 'riseIn 0.45s 0.15s both' }}>
            {t('lk.btn.done')}
          </button>
        )}

        {status === STATES.ERROR && (
          <MsgBox text={msg} error />
        )}
      </div>
    </div>
  )
}

function PaperPlaneIcon({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2B2733" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -2, marginTop: 2 }}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9z" />
    </svg>
  )
}

function FormField({ label, type, ...props }) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div>
      <label style={{ display: 'block', fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#8A8499', marginBottom: 7 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="sl-input"
          type={isPw && show ? 'text' : type}
          style={isPw ? { paddingRight: 56 } : undefined}
          {...props}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              border: 'none', background: 'transparent',
              fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.12em',
              color: '#6E6880', cursor: 'pointer', padding: '8px 10px', borderRadius: 10,
            }}
          >
            {show ? 'HIDE' : 'SHOW'}
          </button>
        )}
      </div>
    </div>
  )
}

function MsgBox({ text, error }) {
  return (
    <div style={{
      padding: '11px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.45,
      background: error ? 'oklch(0.96 0.03 30)' : 'oklch(0.96 0.03 165)',
      color: error ? ROSE_FG : MINT_FG,
      border: `1px solid ${error ? 'oklch(0.88 0.05 30)' : 'oklch(0.88 0.05 165)'}`,
      animation: 'riseIn 0.3s both',
    }}>{text}</div>
  )
}
