import { createContext, useContext, useState, useCallback } from 'react'

const STRINGS = {
  // ---- Nav ----
  'nav.admin':        { th: 'หน้าผู้ดูแล', en: 'ADMIN GRID' },
  'nav.slot':         { th: 'ช่อง',        en: 'SLOT' },

  // ---- LockerPage ----
  'lk.bayslot':       { th: 'จุด A · ช่อง {n}', en: 'BAY A · SLOT {n}' },
  'lk.title.drop':    { th: 'ฝากพัสดุ',        en: 'Drop it off.' },
  'lk.title.inuse':   { th: 'มีพัสดุอยู่',      en: 'In use.' },
  'lk.title.sealed':  { th: 'ส่ง SMS แล้ว',    en: 'SMS has sent.' },
  'lk.title.unlocked':{ th: 'ปลดล็อกแล้ว',     en: 'Unlocked.' },
  'lk.pill.open':     { th: 'ว่าง',    en: 'OPEN' },
  'lk.pill.locked':   { th: 'ล็อก',    en: 'LOCKED' },
  'lk.pill.sealed':   { th: 'ปิดผนึก', en: 'SEALED' },
  'lk.pill.openagain':{ th: 'ว่างอีกครั้ง', en: 'OPEN AGAIN' },
  'lk.copy.drop':     { th: 'ช่องนี้ว่าง วางพัสดุ ใส่เบอร์โทรผู้รับ แล้วระบบจะส่งลิงก์ปลดล็อกทาง SMS ให้',
                        en: 'This slot is open. Stow the parcel, enter the recipient’s phone, and we’ll text them the unlock link.' },
  'lk.copy.inuse':    { th: 'มีพัสดุรออยู่ ผู้รับได้รับลิงก์ปลดล็อกทาง SMS แล้ว แตะลิงก์นั้นเพื่อเปิด',
                        en: 'A delivery is waiting. The recipient received an unlock link by SMS — tap that link to open.' },
  'lk.copy.sealed':   { th: 'ปิดผนึกแล้ว ส่งลิงก์ปลดล็อกไปที่ {phone} เรียบร้อย',
                        en: 'Sealed. We texted the unlock link to {phone}.' },
  'lk.copy.sealed_nophone': { th: 'ปิดผนึกแล้ว แต่ SMS อาจส่งไม่สำเร็จ ตรวจสอบเบอร์แล้วรีเซ็ตหากจำเป็น',
                        en: 'Sealed — but the SMS may not have gone through. Check the number and reset if needed.' },
  'lk.copy.unlocked': { th: 'ประตูเปิดแล้ว หยิบพัสดุได้เลย ช่องพร้อมสำหรับการฝากครั้งต่อไป',
                        en: 'Door released — grab your delivery. The slot is free for the next drop.' },
  'lk.open.hint':     { th: 'แตะเพื่อปลดประตู แล้ววางพัสดุด้านใน', en: 'Tap to release the door, then drop the parcel inside.' },
  'lk.open.btn':      { th: 'เปิดประตู',   en: 'Open door' },
  'lk.open.again':    { th: 'เปิดประตูอีกครั้ง', en: 'Open door again' },
  'lk.open.busy':     { th: 'กำลังเปิด…',  en: 'Opening…' },
  'lk.door.released': { th: 'ประตูเปิดแล้ว — วางพัสดุ แล้วใส่เบอร์โทรผู้รับ', en: 'Door released — drop the parcel, then enter the recipient’s phone.' },
  'lk.label.rphone':  { th: 'เบอร์โทรผู้รับ', en: 'RECIPIENT PHONE NUMBER' },
  'lk.ph.phone':      { th: 'เช่น 0812345678', en: 'e.g. 0812345678' },
  'lk.btn.locksms':   { th: 'ล็อกและส่ง SMS', en: 'Lock & send SMS' },
  'lk.btn.sending':   { th: 'กำลังส่ง…',  en: 'Sending…' },
  'lk.send.title':    { th: 'กำลังส่ง SMS', en: 'Sending SMS' },
  'lk.send.copy':     { th: 'กำลังยืนยันกับเกตเวย์ รอสักครู่', en: 'Confirming with the gateway — one moment.' },
  'lk.label.yphone':  { th: 'เบอร์โทรของคุณ', en: 'YOUR PHONE NUMBER' },
  'lk.ph.yphone':     { th: 'เบอร์ที่ได้รับ SMS', en: 'The number from your SMS' },
  'lk.btn.unlock':    { th: 'ปลดล็อก',    en: 'Unlock' },
  'lk.btn.unlocking': { th: 'กำลังปลดล็อก…', en: 'Unlocking…' },
  'lk.hint.orsms':    { th: 'หรือแตะลิงก์ปลดล็อกที่ส่งทาง SMS', en: 'or tap the unlock link we texted you.' },
  'lk.btn.done':      { th: 'เสร็จสิ้น',   en: 'Done' },
  'lk.err.phone':     { th: 'กรุณาใส่เบอร์โทร 10 หลัก', en: 'Enter a 10-digit phone number.' },
  'lk.err.phonedrop': { th: 'ใส่เบอร์โทร 10 หลักที่ใช้ตอนฝากพัสดุ', en: 'Enter the 10-digit number used at drop-off.' },
  'lk.err.open':      { th: 'เปิดประตูไม่สำเร็จ', en: 'Could not open the door.' },
  'lk.err.lock':      { th: 'ล็อกไม่สำเร็จ', en: 'Failed to lock.' },
  'lk.err.nomatch':   { th: 'เบอร์โทรไม่ตรงกัน', en: 'Phone number does not match.' },
  'lk.loading':       { th: 'กำลังโหลด…', en: 'LOADING…' },
  'lk.err.server':    { th: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', en: 'Could not reach server.' },

  // ---- PickupPage ----
  'pk.tag':           { th: 'ลิงก์รับพัสดุ', en: 'PICKUP LINK' },
  'pk.title.idle':    { th: 'พัสดุของคุณ',   en: 'Your delivery.' },
  'pk.title.opening': { th: 'กำลังเปิด…',    en: 'Opening…' },
  'pk.title.success': { th: 'ปลดล็อกแล้ว',   en: 'Unlocked.' },
  'pk.title.error':   { th: 'ลิงก์ไม่ถูกต้อง', en: 'Invalid Link.' },
  'pk.pill.locked':   { th: 'ล็อก',  en: 'LOCKED' },
  'pk.pill.open':     { th: 'เปิด',   en: 'OPEN' },
  'pk.pill.expired':  { th: 'หมดอายุ', en: 'EXPIRED' },
  'pk.copy.idle':     { th: 'แตะปุ่มด้านล่างเพื่อปลดล็อกและรับพัสดุ', en: 'Tap the button below to unlock the locker and retrieve your parcel.' },
  'pk.copy.opening':  { th: 'กำลังตรวจสอบและปลดล็อก…', en: 'Verifying and unlocking…' },
  'pk.copy.success':  { th: 'ประตูเปิดแล้ว — หยิบพัสดุจากช่อง {n} ลิงก์นี้หมดอายุแล้ว', en: 'Door released — grab your delivery from slot {n}. This link is now expired.' },
  'pk.btn.unlock':    { th: 'ปลดล็อก', en: 'UNLOCK' },
  'pk.err.newlink':   { th: 'ขอลิงก์ใหม่จากผู้ส่ง', en: 'Ask the sender to generate a new link.' },
  'pk.err.invalid':   { th: 'ลิงก์ไม่ถูกต้องหรือถูกใช้ไปแล้ว', en: 'Link is invalid or already used.' },

  // ---- LoginPage ----
  'lg.tag':           { th: 'สำหรับผู้ดูแล', en: 'ADMIN ACCESS' },
  'lg.title':         { th: 'เข้าสู่ระบบ',   en: 'Sign in.' },
  'lg.copy':          { th: 'ใส่รหัสผ่านผู้ดูแลเพื่อเข้าหน้าจัดการ', en: 'Enter the admin password to access the dashboard.' },
  'lg.label.pw':      { th: 'รหัสผ่าน', en: 'PASSWORD' },
  'lg.ph.pw':         { th: 'รหัสผ่านผู้ดูแล', en: 'Admin password' },
  'lg.btn.signin':    { th: 'เข้าสู่ระบบ', en: 'Sign In' },
  'lg.btn.signing':   { th: 'กำลังเข้าสู่ระบบ…', en: 'Signing in…' },
  'lg.err.enter':     { th: 'กรุณาใส่รหัสผ่าน', en: 'Enter admin password.' },
  'lg.err.wrong':     { th: 'รหัสผ่านไม่ถูกต้อง', en: 'Wrong password.' },

  // ---- AdminPage ----
  'ad.tag':           { th: 'ตารางช่อง · จุด A', en: 'DELIVERY GRID · BAY A' },
  'ad.title':         { th: 'แตะที่ช่อง', en: 'Tap a slot.' },
  'ad.copy':          { th: 'พิมพ์ QR ของแต่ละช่องติดที่ประตู ผู้ส่งสแกน ใส่เบอร์ผู้รับ พัสดุถูกล็อกจนกว่าจะมารับ',
                        en: 'Print a QR for each slot and stick it on the door. Couriers scan, set a code, parcel stays sealed until pickup.' },
  'ad.signout':       { th: 'ออกจากระบบ', en: 'SIGN OUT' },
  'ad.stat.total':    { th: 'ทั้งหมด', en: 'TOTAL' },
  'ad.stat.open':     { th: 'ว่าง',    en: 'OPEN' },
  'ad.stat.locked':   { th: 'ล็อก',    en: 'LOCKED' },
  'ad.label.baseurl': { th: 'ที่อยู่เว็บ (BASE URL)', en: 'BASE URL' },
  'ad.sms.label':     { th: 'ส่ง SMS เมื่อล็อก', en: 'Send SMS on lock' },
  'ad.sms.on':        { th: 'เปิด', en: 'ON' },
  'ad.sms.off':       { th: 'ปิด', en: 'OFF' },
  'ad.sms.hint':      { th: 'ปิดเพื่อไม่ส่งข้อความจริง — ผู้รับยังปลดล็อกด้วยเบอร์โทรหรือลิงก์ได้',
                        en: 'Off = no real texts sent. Recipients can still unlock by phone or link.' },
  'ad.slot.occupied': { th: 'มีพัสดุ · ภายในช่อง', en: 'Occupied · parcel inside' },
  'ad.slot.available':{ th: 'ว่าง · พร้อมรับฝาก',  en: 'Available · ready for drop' },
  'ad.slot.locked':   { th: 'ล็อก',  en: 'LOCKED' },
  'ad.slot.open':     { th: 'ว่าง',  en: 'OPEN' },
  'ad.qr':            { th: 'QR ของช่อง', en: 'SLOT QR' },
  'ad.btn.openpage':  { th: 'เปิดหน้าช่อง →', en: 'Open locker page →' },
  'ad.btn.genlink':   { th: 'สร้างลิงก์ปลดล็อก', en: 'Generate unlock link' },
  'ad.btn.gen':       { th: 'กำลังสร้าง…', en: 'Generating…' },
  'ad.link.title':    { th: 'ลิงก์ปลดล็อก · ใช้ได้ครั้งเดียว', en: 'UNLOCK LINK · ONE TIME USE' },
  'ad.btn.copy':      { th: 'คัดลอกลิงก์', en: 'Copy link' },
  'ad.btn.copied':    { th: 'คัดลอกแล้ว ✓', en: 'Copied ✓' },
  'ad.btn.clear':     { th: 'ล้าง', en: 'Clear' },
  'ad.btn.reset':     { th: 'รีเซ็ตช่อง', en: 'Reset slot' },
  'ad.reset.ok':      { th: 'รีเซ็ตช่องแล้ว — เปิดใหม่ได้', en: 'Slot reset — open again.' },
  'ad.log':           { th: 'ประวัติการใช้งาน', en: 'ACTIVITY LOG' },
  'ad.log.empty':     { th: 'ยังไม่มีกิจกรรม', en: 'No activity yet.' },
}

const LangContext = createContext({ lang: 'th', setLang: () => {}, t: (k) => k })

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem('lang') || 'th')
  const setLang = (l) => { localStorage.setItem('lang', l); setLangState(l) }
  const t = useCallback((key, vars) => {
    const entry = STRINGS[key]
    let s = entry ? (entry[lang] ?? entry.en) : key
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k])
    return s
  }, [lang])
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
