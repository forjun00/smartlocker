import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import './App.css'

const STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  OPENING: 'opening',
  SUCCESS: 'success',
  ERROR: 'error',
}

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [message, setMessage] = useState('')
  const [scannedUrl, setScannedUrl] = useState('')
  const scannerRef = useRef(null)
  const scannerElId = 'qr-reader'

  const startScanning = async () => {
    setStatus(STATUS.SCANNING)
    setMessage('')
    setScannedUrl('')

    const scanner = new Html5Qrcode(scannerElId)
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrResult(decodedText, scanner)
        },
        () => {}
      )
    } catch (err) {
      setStatus(STATUS.ERROR)
      setMessage('Camera access denied or unavailable.')
    }
  }

  const handleQrResult = async (url, scanner) => {
    await scanner.stop()
    scannerRef.current = null

    setScannedUrl(url)
    setStatus(STATUS.OPENING)
    setMessage('Opening locker…')

    try {
      const res = await fetch(url, { method: 'GET' })
      if (res.ok) {
        setStatus(STATUS.SUCCESS)
        setMessage('Locker opened!')
      } else {
        setStatus(STATUS.ERROR)
        setMessage(`Server returned ${res.status}: ${res.statusText}`)
      }
    } catch (err) {
      setStatus(STATUS.ERROR)
      setMessage(`Failed to reach locker: ${err.message}`)
    }
  }

  const reset = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setStatus(STATUS.IDLE)
    setMessage('')
    setScannedUrl('')
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="container">
      <header>
        <div className="lock-icon">{status === STATUS.SUCCESS ? '🔓' : '🔒'}</div>
        <h1>SmartLocker</h1>
        <p className="subtitle">Scan the QR code on a locker to open it</p>
      </header>

      <main>
        {status === STATUS.IDLE && (
          <button className="btn-primary" onClick={startScanning}>
            Scan QR Code
          </button>
        )}

        {status === STATUS.SCANNING && (
          <div className="scanner-wrapper">
            <div id={scannerElId} />
            <button className="btn-secondary" onClick={reset}>Cancel</button>
          </div>
        )}

        {status === STATUS.OPENING && (
          <div className="status-card opening">
            <div className="spinner" />
            <p>{message}</p>
            {scannedUrl && <code className="url-display">{scannedUrl}</code>}
          </div>
        )}

        {status === STATUS.SUCCESS && (
          <div className="status-card success">
            <div className="check">✓</div>
            <p className="status-text">{message}</p>
            <button className="btn-primary" onClick={reset}>Scan Another</button>
          </div>
        )}

        {status === STATUS.ERROR && (
          <div className="status-card error">
            <div className="x-mark">✕</div>
            <p className="status-text">{message}</p>
            {scannedUrl && <code className="url-display">{scannedUrl}</code>}
            <button className="btn-primary" onClick={reset}>Try Again</button>
          </div>
        )}
      </main>
    </div>
  )
}
