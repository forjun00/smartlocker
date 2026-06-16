import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import LockIcon from '../components/LockIcon'

const MINT_BG = 'oklch(0.93 0.05 165)', MINT_FG = 'oklch(0.42 0.09 165)'
const ROSE_BG = 'oklch(0.93 0.05 30)',  ROSE_FG = 'oklch(0.45 0.11 30)'

const STATES = { LOADING: 'loading', UNLOCKED: 'unlocked', LOCKED: 'locked', SUCCESS: 'success', ERROR: 'error' }

export default function LockerPage() {
  const { id } = useParams()
  const slotLabel = String(id).padStart(2, '0')
  const [status, setStatus] = useState(STATES.LOADING)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [msgError, setMsgError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | lockedOk | unlockedOk
  const [doorOpened, setDoorOpened] = useState(false)

  useEffect(() => {
    fetch(`/api/locker/${id}`)
      .then(r => r.json())
      .then(d => setStatus(d.locked ? STATES.LOCKED : STATES.UNLOCKED))
      .catch(() => { setStatus(STATES.ERROR); setMsg('Could not reach server.') })
  }, [id])

  const setError = (m) => { setMsg(m); setMsgError(true) }
  const clearMsg = () => { setMsg(''); setMsgError(false) }

  const handleOpenDoor = async () => {
    setBusy(true); clearMsg()
    const res = await fetch(`/api/locker/${id}/open`, { method: 'POST' })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setDoorOpened(true); setMsg('Door released — drop your parcel, then set a passcode.'); setMsgError(false) }
    else setError(data.error || 'Could not open the door.')
  }

  const handleLock = async () => {
    if (pw.length < 4) return setError('Passcode needs at least 4 characters.')
    if (pw !== confirm) return setError('Passcodes do not match.')
    setBusy(true); clearMsg()
    const res = await fetch(`/api/locker/${id}/lock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setStatus(STATES.SUCCESS); setPhase('lockedOk') }
    else setError(data.error || 'Failed to lock.')
  }

  const handleUnlock = async () => {
    if (!pw) return setError('Enter your passcode.')
    setBusy(true); clearMsg()
    const res = await fetch(`/api/locker/${id}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setStatus(STATES.SUCCESS); setPhase('unlockedOk') }
    else setError(data.error || 'Wrong passcode. Try again.')
  }

  const handleDone = () => {
    setPhase('idle'); setPw(''); setConfirm(''); clearMsg()
    fetch(`/api/locker/${id}`).then(r => r.json()).then(d => setStatus(d.locked ? STATES.LOCKED : STATES.UNLOCKED))
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
    pageTitle = 'Locked in.'; statusText = 'SEALED'
    statusCopy = 'Your parcel is sealed behind this door. Keep the passcode handy for pickup.'
  } else if (success) {
    pageTitle = 'Unlocked.'; statusText = 'OPEN AGAIN'
    statusCopy = 'Door released — grab your delivery. The slot is free for the next drop.'
  } else if (isLocked) {
    pageTitle = 'Pick it up.'; statusText = 'LOCKED'
    statusCopy = 'A delivery is waiting. Enter your passcode to pop the door.'
  } else {
    pageTitle = 'Drop it off.'; statusText = 'OPEN'
    statusCopy = 'This slot is open. Stow your parcel, set a passcode, and lock it down.'
  }

  const showLockForm   = status === STATES.UNLOCKED && !success
  const showUnlockForm = status === STATES.LOCKED && !success
  const showSuccess    = success

  if (status === STATES.LOADING) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#8A8499', letterSpacing: '0.1em' }}>LOADING…</div>
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
          <LockIcon open={heroOpen} size={46} />
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)', marginBottom: 8 }}>
            BAY A · SLOT {slotLabel}
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>{pageTitle}</h1>
          <div style={{ display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: pillLocked ? ROSE_BG : MINT_BG, color: pillLocked ? ROSE_FG : MINT_FG, marginBottom: 12 }}>
            {statusText}
          </div>
          <p style={{ color: '#6E6880', fontSize: 15, lineHeight: 1.55 }}>{statusCopy}</p>
        </div>

        {/* Step 1: Open door */}
        {showLockForm && !doorOpened && (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)', animation: 'riseIn 0.45s 0.05s both' }}>
            <p style={{ color: '#6E6880', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
              Tap to release the door, then drop your parcel inside.
            </p>
            {msg && <MsgBox text={msg} error={msgError} />}
            <button className="sl-btn-primary" onClick={handleOpenDoor} disabled={busy}>
              {busy ? 'Opening…' : 'Open door'}
            </button>
          </div>
        )}

        {/* Step 2: Lock form */}
        {showLockForm && doorOpened && (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)', animation: 'riseIn 0.45s 0.05s both' }}>
            <FormField label="SET PASSCODE" type="password" placeholder="Min 4 characters" value={pw} onChange={e => { setPw(e.target.value); clearMsg() }} />
            <FormField label="CONFIRM PASSCODE" type="password" placeholder="Repeat passcode" value={confirm} onChange={e => { setConfirm(e.target.value); clearMsg() }} />
            {msg && <MsgBox text={msg} error={msgError} />}
            <button className="sl-btn-primary" onClick={handleLock} disabled={busy}>{busy ? 'Locking…' : 'Lock it down'}</button>
          </div>
        )}

        {/* Unlock form */}
        {showUnlockForm && (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)', animation: 'riseIn 0.45s 0.05s both' }}>
            <FormField label="PASSCODE" type="password" placeholder="Enter your passcode" value={pw} onChange={e => { setPw(e.target.value); clearMsg() }} />
            {msg && <MsgBox text={msg} error={msgError} />}
            <button className="sl-btn-primary" onClick={handleUnlock} disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
          </div>
        )}

        {showSuccess && (
          <button onClick={handleDone} style={{ width: '100%', maxWidth: 280, padding: 14, borderRadius: 16, border: '1px solid rgba(43,39,51,0.12)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', color: '#2B2733', fontSize: 15, fontWeight: 600, cursor: 'pointer', animation: 'riseIn 0.45s 0.15s both' }}>
            Done
          </button>
        )}

        {status === STATES.ERROR && (
          <MsgBox text={msg} error />
        )}
      </div>
    </div>
  )
}

function FormField({ label, type, ...props }) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div>
      <label style={{ display: 'block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#8A8499', marginBottom: 7 }}>{label}</label>
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
              fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.12em',
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
