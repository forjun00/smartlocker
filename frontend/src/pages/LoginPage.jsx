import { useState } from 'react'
import LockIcon from '../components/LockIcon'
import { useLang } from '../i18n'
import { api } from '../api'

export default function LoginPage({ onLogin }) {
  const { t } = useLang()
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  const handleLogin = async () => {
    if (!pw) return setError(t('lg.err.enter'))
    setBusy(true); setError('')
    const res = await api('admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { onLogin(data.token) }
    else setError(data.error || t('lg.err.wrong'))
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, animation: 'riseIn 0.5s cubic-bezier(0.2,0.7,0.2,1) both' }}>

        {/* Hero */}
        <div style={{ position: 'relative', width: 116, height: 116, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(0.88 0.07 295), oklch(0.9 0.07 30))', display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px oklch(0.62 0.1 295 / 0.25)', animation: 'popIn 0.5s cubic-bezier(0.2,0.8,0.3,1.2) both' }}>
          <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '1.5px dashed oklch(0.6 0.12 295 / 0.5)', animation: 'spinSlow 26s linear infinite' }} />
          <LockIcon open={false} size={46} />
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.2em', color: 'oklch(0.5 0.12 295)', marginBottom: 8 }}>{t('lg.tag')}</div>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{t('lg.title')}</h1>
          <p style={{ color: '#6E6880', fontSize: 15, lineHeight: 1.55 }}>{t('lg.copy')}</p>
        </div>

        {/* Form */}
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(43,39,51,0.07)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 18px 50px oklch(0.65 0.08 295 / 0.14)' }}>
          <div>
            <label style={{ display: 'block', fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#8A8499', marginBottom: 7 }}>{t('lg.label.pw')}</label>
            <div style={{ position: 'relative' }}>
              <input
                className="sl-input"
                type={show ? 'text' : 'password'}
                placeholder={t('lg.ph.pw')}
                value={pw}
                onChange={e => { setPw(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ paddingRight: 56 }}
                autoFocus
              />
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
            </div>
          </div>
          {error && (
            <div style={{ padding: '11px 14px', borderRadius: 12, fontSize: 13, background: 'oklch(0.96 0.03 30)', color: 'oklch(0.45 0.11 30)', border: '1px solid oklch(0.88 0.05 30)', animation: 'riseIn 0.3s both' }}>
              {error}
            </div>
          )}
          <button className="sl-btn-primary" onClick={handleLogin} disabled={busy}>
            {busy ? t('lg.btn.signing') : t('lg.btn.signin')}
          </button>
        </div>

      </div>
    </div>
  )
}
