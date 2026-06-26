import { useNavigate, useMatch } from 'react-router-dom'
import LockIcon from './LockIcon'
import { useLang } from '../i18n'

export default function Nav() {
  const navigate = useNavigate()
  const { t } = useLang()
  const lockerMatch = useMatch('/locker/:id')
  const isAdmin = !lockerMatch
  const slotLabel = lockerMatch ? String(lockerMatch.params.id).padStart(2, '0') : '—'

  const pill = (active) => ({
    border: 'none', cursor: 'pointer',
    padding: '9px 16px', borderRadius: 999,
    fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.1em',
    transition: 'background 0.25s, color 0.25s',
    background: active ? '#2B2733' : 'transparent',
    color: active ? '#FBFAF7' : '#6E6880',
  })

  return (
    <div style={{
      position: 'fixed', top: 18, left: 18,
      zIndex: 60, display: 'flex', alignItems: 'center', gap: 4,
      background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      padding: 5, borderRadius: 999,
      border: '1px solid rgba(43,39,51,0.08)',
      boxShadow: '0 10px 34px oklch(0.6 0.1 295 / 0.18)',
      whiteSpace: 'nowrap',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px 0 12px',
        fontFamily: "'Space Mono', 'IBM Plex Sans Thai', monospace", fontSize: 11, letterSpacing: '0.12em', color: '#6E6880',
      }}>
        <LockIcon open={false} size={13} />
        SMARTLOCKER
      </div>
      {!lockerMatch && <button style={pill(isAdmin)} onClick={() => navigate('/')}>{t('nav.admin')}</button>}
      {lockerMatch && (
        <button style={pill(true)}>{t('nav.slot')} {slotLabel}</button>
      )}
    </div>
  )
}
