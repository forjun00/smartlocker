import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import LockIcon from '../components/LockIcon'
import { api } from '../api'

const MINT_BG = 'oklch(0.93 0.05 165)', MINT_FG = 'oklch(0.42 0.09 165)'
const ROSE_BG = 'oklch(0.93 0.05 30)',  ROSE_FG = 'oklch(0.45 0.11 30)'

export default function ScanUnlockPage() {
  const { id, token } = useParams()
  const slotLabel = String(id).padStart(2, '0')
  const [phase, setPhase] = useState('idle')   // idle | scanning | unlocking | success | error
  const [msg, setMsg] = useState('')
  const scannerRef = useRef(null)

  const startScan = async () => {
    setPhase('scanning')
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => handleScan(decoded, scanner),
        () => {}
      )
    } catch {
      setPhase('error')
      setMsg('Camera access denied. Please allow camera and try again.')
    }
  }

  const handleScan = async (decoded, scanner) => {
    await scanner.stop()
    scannerRef.current = null

    // Extract locker ID from scanned URL (e.g. https://xxx/locker/3)
    const match = decoded.match(/\/locker\/(\w+)/)
    if (!match) {
      setPhase('error')
      setMsg('This QR code is not a SmartLocker slot. Please scan the correct locker.')
      return
    }

    const scannedId = match[1]
    if (scannedId !== String(id)) {
      setPhase('error')
      setMsg(`Wrong slot! You scanned slot ${String(scannedId).padStart(2, '0')} but this link is for slot ${slotLabel}.`)
      return
    }

    setPhase('unlocking')
    try {
      const res = await api(`pickup/${token}`)
      const data = await res.json()
      if (res.ok) setPhase('success')
      else { setPhase('error'); setMsg(data.error || 'Unlock failed.') }
    } catch {
      setPhase('error')
      setMsg('Could not reach server.')
    }
  }

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}) }, [])

  const isSuccess = phase === 'success'
  const isScanning = phase === 'scanning'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 70px' }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, animation: 'riseIn 0.5s cubic-bezier(0.2,0.7,0.2,1) both' }}>

        {/* Hero badge */}
        {!isScanning && (
          <div style={{ position: 'relative', width: 116, height: 116, borderRadius: '50%', background: isSuccess ? 'linear-gradient(135deg, oklch(0.9 0.07 165), oklch(0.88 0.07 235))' : 'linear-gradient(135deg, oklch(0.88 0.07 295), oklch(0.9 0.07 30))', display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px oklch(0.62 0.1 295 / 0.25)', animation: 'popIn 0.5s cubic-bezier(0.2,0.8,0.3,1.2) both' }}>
            <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1.5px dashed oklch(0.6 0.12 295 / 0.5)', animation: 'spinSlow 26s linear infinite' }} />
            {isSuccess && <>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid oklch(0.7 0.11 165)', animation: 'ringPulse 1.8s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid oklch(0.7 0.11 165)', animation: 'ringPulse 1.8s ease-out 0.9s infinite' }} />
            </>}
            <LockIcon open={isSuccess} size={46} />
          </div>
        )}

        {/* Header */}
        {!isScanning && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)', marginBottom: 8 }}>
              BAY A · SLOT {slotLabel}
            </div>
            <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
              {phase === 'idle' && 'Scan to unlock.'}
              {phase === 'unlocking' && 'Opening…'}
              {phase === 'success' && 'Unlocked.'}
              {phase === 'error' && 'Failed.'}
            </h1>
            {phase === 'idle' && (
              <div style={{ display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: ROSE_BG, color: ROSE_FG, marginBottom: 12 }}>LOCKED</div>
            )}
            {phase === 'success' && (
              <div style={{ display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', padding: '6px 14px', borderRadius: 999, background: MINT_BG, color: MINT_FG, marginBottom: 12 }}>OPEN</div>
            )}
            <p style={{ color: '#6E6880', fontSize: 15, lineHeight: 1.55 }}>
              {phase === 'idle' && `Point your camera at the QR code on locker slot ${slotLabel} to unlock it.`}
              {phase === 'unlocking' && 'Verifying and unlocking the slot…'}
              {phase === 'success' && 'Door released — grab your delivery. This link is now expired.'}
              {phase === 'error' && msg}
            </p>
          </div>
        )}

        {/* Scanner */}
        {isScanning && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)' }}>
              SCAN SLOT {slotLabel} QR CODE
            </div>
            <div id="qr-reader" style={{ width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(43,39,51,0.1)' }} />
            <button onClick={() => { scannerRef.current?.stop().catch(() => {}); setPhase('idle') }}
              style={{ border: '1px solid rgba(43,39,51,0.12)', background: 'transparent', color: '#6E6880', padding: '9px 24px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* Action buttons */}
        {phase === 'idle' && (
          <button className="sl-btn-primary" style={{ width: '100%', maxWidth: 280 }} onClick={startScan}>
            Open Camera
          </button>
        )}

        {phase === 'error' && (
          <button className="sl-btn-primary" style={{ width: '100%', maxWidth: 280 }} onClick={() => { setPhase('idle'); setMsg('') }}>
            Try Again
          </button>
        )}

      </div>
    </div>
  )
}
