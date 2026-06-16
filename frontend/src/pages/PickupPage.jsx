import { useState } from 'react'
import { useParams } from 'react-router-dom'
import LockIcon from '../components/LockIcon'

const MINT_BG = 'oklch(0.93 0.05 165)', MINT_FG = 'oklch(0.42 0.09 165)'
const ROSE_BG = 'oklch(0.93 0.05 30)',  ROSE_FG = 'oklch(0.45 0.11 30)'

export default function PickupPage() {
  const { token } = useParams()
  const [phase, setPhase] = useState('idle')   // idle | unlocking | success | error
  const [lockerId, setLockerId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleUnlock = async () => {
    setPhase('unlocking')
    try {
      const res = await fetch(`/api/pickup/${token}`)
      const data = await res.json()
      if (res.ok) { setPhase('success'); setLockerId(data.locker_id) }
      else { setPhase('error'); setErrorMsg(data.error || 'Link is invalid or already used.') }
    } catch {
      setPhase('error')
      setErrorMsg('Could not reach server.')
    }
  }

  const isSuccess = phase === 'success'
  const isIdle = phase === 'idle'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 70px' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, animation: 'riseIn 0.5s cubic-bezier(0.2,0.7,0.2,1) both' }}>

        {/* Hero badge */}
        <div style={{ position: 'relative', width: 116, height: 116, borderRadius: '50%', background: isSuccess ? 'linear-gradient(135deg, oklch(0.9 0.07 165), oklch(0.88 0.07 235))' : 'linear-gradient(135deg, oklch(0.88 0.07 295), oklch(0.9 0.07 30))', display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px oklch(0.62 0.1 295 / 0.25)', animation: 'popIn 0.5s cubic-bezier(0.2,0.8,0.3,1.2) both' }}>
          <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1.5px dashed oklch(0.6 0.12 295 / 0.5)', animation: 'spinSlow 26s linear infinite' }} />
          {isSuccess && <>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid oklch(0.7 0.11 165)', animation: 'ringPulse 1.8s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid oklch(0.7 0.11 165)', animation: 'ringPulse 1.8s ease-out 0.9s infinite' }} />
          </>}
          <LockIcon open={isSuccess} size={46} />
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)', marginBottom: 8 }}>
            PICKUP LINK
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {isIdle && 'Your delivery.'}
            {phase === 'unlocking' && 'Opening…'}
            {isSuccess && 'Unlocked.'}
            {phase === 'error' && 'Invalid Link.'}
          </h1>
          {isIdle && <div style={{ display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: ROSE_BG, color: ROSE_FG, marginBottom: 12 }}>LOCKED</div>}
          {isSuccess && <div style={{ display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: MINT_BG, color: MINT_FG, marginBottom: 12 }}>OPEN</div>}
          {phase === 'error' && <div style={{ display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: ROSE_BG, color: ROSE_FG, marginBottom: 12 }}>EXPIRED</div>}
          <p style={{ color: '#6E6880', fontSize: 15, lineHeight: 1.55 }}>
            {isIdle && 'Tap the button below to unlock the locker and retrieve your parcel.'}
            {phase === 'unlocking' && 'Verifying and unlocking…'}
            {isSuccess && `Door released — grab your delivery from slot ${String(lockerId).padStart(2, '0')}. This link is now expired.`}
            {phase === 'error' && errorMsg}
          </p>
        </div>

        {/* Big round unlock button */}
        {isIdle && (
          <button onClick={handleUnlock} style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'oklch(0.4 0.13 295)', color: '#FBFAF7',
            border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
            fontFamily: "'Space Mono', monospace",
            boxShadow: '0 12px 36px oklch(0.55 0.13 295 / 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'popIn 0.5s 0.15s cubic-bezier(0.2,0.8,0.3,1.2) both',
          }}
            onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 18px 48px oklch(0.55 0.13 295 / 0.5)' }}
            onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 12px 36px oklch(0.55 0.13 295 / 0.4)' }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1.06)'}
          >
            UNLOCK
          </button>
        )}

        {phase === 'error' && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#8A8499', textAlign: 'center' }}>
            Ask the sender to generate a new link.
          </p>
        )}

      </div>
    </div>
  )
}
