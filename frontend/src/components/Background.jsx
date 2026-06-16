export default function Background() {
  const blobs = [
    { size: '55vw', style: { top: '-18vw', left: '-12vw' }, color: 'oklch(0.88 0.07 295 / 0.9)', anim: 'blobA 26s ease-in-out infinite' },
    { size: '48vw', style: { top: '-10vw', right: '-14vw' }, color: 'oklch(0.9 0.07 165 / 0.85)', anim: 'blobB 30s ease-in-out infinite' },
    { size: '50vw', style: { bottom: '-20vw', left: '8vw' }, color: 'oklch(0.9 0.07 55 / 0.8)', anim: 'blobC 34s ease-in-out infinite' },
    { size: '42vw', style: { bottom: '-16vw', right: '-8vw' }, color: 'oklch(0.89 0.07 235 / 0.8)', anim: 'blobA 38s ease-in-out infinite' },
  ]

  const parcels = [
    { left: '6%',  size: 26, dur: 23, delay: -2,  color: 'oklch(0.88 0.07 295)' },
    { left: '18%', size: 20, dur: 28, delay: -9,  color: 'oklch(0.9 0.07 165)' },
    { left: '34%', size: 30, dur: 25, delay: -16, color: 'oklch(0.9 0.07 55)' },
    { left: '52%', size: 22, dur: 31, delay: -5,  color: 'oklch(0.88 0.07 235)' },
    { left: '70%', size: 28, dur: 26, delay: -12, color: 'oklch(0.88 0.07 15)' },
    { left: '86%', size: 21, dur: 21, delay: -19, color: 'oklch(0.88 0.07 295)' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* Tech grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(110,90,170,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(110,90,170,0.06) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
        maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%)',
      }} />

      {/* Blobs */}
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', width: b.size, height: b.size, borderRadius: '50%',
          background: `radial-gradient(circle at 50% 50%, ${b.color}, transparent 70%)`,
          filter: 'blur(40px)', animation: b.anim, ...b.style,
        }} />
      ))}

      {/* Parcels */}
      {parcels.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: -40, left: p.left,
          width: p.size, height: p.size, borderRadius: 7,
          background: p.color, border: '1px solid rgba(43,39,51,0.08)',
          opacity: 0.55,
          animation: `floatUp ${p.dur}s linear infinite`,
          animationDelay: `${p.delay}s`,
        }}>
          <div style={{
            position: 'absolute', top: 0, left: '50%',
            width: Math.max(4, p.size * 0.2), height: '100%',
            marginLeft: -Math.max(2, p.size * 0.1),
            background: 'rgba(255,255,255,0.75)',
          }} />
        </div>
      ))}
    </div>
  )
}
