// Central API base so the same code runs on different hosts:
//   - default (Flask, or Apache with the .htaccess rewrite):  /api/
//   - PHP host without URL rewriting (nginx/FTP):  set VITE_API_BASE at build,
//     e.g. VITE_API_BASE=/smartlocker/api.php?p=
//
// Routes are passed without the leading slash, e.g. api('lockers'),
// api(`locker/${id}/lock`, { method: 'POST', ... }).
const API_BASE = import.meta.env.VITE_API_BASE || '/api/'

export const apiUrl = (path) => API_BASE + path

// Always fetch fresh: cache:'no-store' + a unique ?_=timestamp so a previously
// cached GET (e.g. an old lock status) can never be served from the browser/CDN.
export const api = (path, opts = {}) => {
  const u = apiUrl(path)
  const bust = `${u.includes('?') ? '&' : '?'}_=${Date.now()}`
  return fetch(u + bust, { cache: 'no-store', ...opts })
}

// Public app URL for QR codes / unlock links. Hash routing, no rewrites needed.
//   appUrl('/locker/1')  ->  https://host/<base>#/locker/1
export const appUrl = (hashPath) =>
  `${window.location.origin}${import.meta.env.BASE_URL}#${hashPath}`
