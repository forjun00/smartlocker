const express = require('express')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const cors = require('cors')

const app = express()
const PORT = 3001
const DATA_FILE = path.join(__dirname, 'lockers.json')
const NUM_LOCKERS = 10

app.use(express.json())
app.use(cors())
app.use(express.static(path.join(__dirname, '../frontend/dist')))

function initLockers() {
  if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  const lockers = {}
  for (let i = 1; i <= NUM_LOCKERS; i++) {
    lockers[i] = { locked: false, passwordHash: null }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(lockers, null, 2))
  return lockers
}

function save(lockers) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(lockers, null, 2))
}

let lockers = initLockers()

// Get all lockers
app.get('/api/lockers', (req, res) => {
  const list = Object.entries(lockers).map(([id, data]) => ({
    id,
    locked: data.locked,
  }))
  res.json(list)
})

// Get single locker status
app.get('/api/locker/:id', (req, res) => {
  const locker = lockers[req.params.id]
  if (!locker) return res.status(404).json({ error: 'Locker not found' })
  res.json({ id: req.params.id, locked: locker.locked })
})

// Lock a locker
app.post('/api/locker/:id/lock', async (req, res) => {
  const { id } = req.params
  const { password } = req.body
  if (!lockers[id]) return res.status(404).json({ error: 'Locker not found' })
  if (lockers[id].locked) return res.status(400).json({ error: 'Already locked' })
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' })

  lockers[id].passwordHash = await bcrypt.hash(password, 10)
  lockers[id].locked = true
  save(lockers)
  res.json({ success: true })
})

// Unlock a locker
app.post('/api/locker/:id/unlock', async (req, res) => {
  const { id } = req.params
  const { password } = req.body
  if (!lockers[id]) return res.status(404).json({ error: 'Locker not found' })
  if (!lockers[id].locked) return res.status(400).json({ error: 'Not locked' })

  const match = await bcrypt.compare(password, lockers[id].passwordHash)
  if (!match) return res.status(401).json({ error: 'Wrong password' })

  lockers[id] = { locked: false, passwordHash: null }
  save(lockers)
  res.json({ success: true })
})

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLocker running on http://0.0.0.0:${PORT}`)
})
