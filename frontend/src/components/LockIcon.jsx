export default function LockIcon({ open = false, size = 46, ink = '#2B2733' }) {
  const bw = Math.max(2, Math.round(size * 0.12))
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.06, flexShrink: 0 }}>
      {/* Shackle */}
      <div style={{
        position: 'absolute', top: 0, left: '50%',
        width: size * 0.56, height: size * 0.46,
        marginLeft: -(size * 0.28),
        border: `${bw}px solid ${ink}`, borderBottom: 'none',
        borderRadius: `${size * 0.3}px ${size * 0.3}px 0 0`,
        transformOrigin: `${size * 0.08}px ${size * 0.46}px`,
        transform: open ? 'rotate(-32deg)' : 'none',
        transition: 'transform 0.55s cubic-bezier(0.3, 1.4, 0.4, 1)',
      }} />
      {/* Body */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        width: size * 0.92, height: size * 0.62,
        marginLeft: -(size * 0.46),
        background: ink, borderRadius: size * 0.18,
      }}>
        {/* Keyhole circle */}
        <div style={{
          position: 'absolute', left: '50%', top: '30%',
          width: size * 0.15, height: size * 0.15,
          marginLeft: -(size * 0.075),
          borderRadius: '50%', background: '#FBFAF7',
        }} />
        {/* Keyhole stem */}
        <div style={{
          position: 'absolute', left: '50%', top: '46%',
          width: size * 0.07, height: size * 0.2,
          marginLeft: -(size * 0.035),
          borderRadius: size, background: '#FBFAF7',
        }} />
      </div>
    </div>
  )
}
