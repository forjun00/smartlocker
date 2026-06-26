// Central API base so the same code runs on different hosts:
//   - default (Flask, or Apache with the .htaccess rewrite):  /api/
//   - PHP host without URL rewriting (nginx/FTP):  set VITE_API_BASE at build,
//     e.g. VITE_API_BASE=/smartlocker/api.php?p=
//
// Routes are passed without the leading slash, e.g. api('lockers'),
// api(`locker/${id}/lock`, { method: 'POST', ... }).
const API_BASE = import.meta.env.VITE_API_BASE || '/api/'

export const apiUrl = (path) => API_BASE + path
export const api = (path, opts) => fetch(apiUrl(path), opts)

// Public app URL for QR codes / unlock links. Uses hash routing and an explicit
// index.html so it works in a subfolder with no server rewrites.
//   appUrl('/locker/1')  ->  https://host/<base>index.html#/locker/1
export const appUrl = (hashPath) =>
  `${window.location.origin}${import.meta.env.BASE_URL}index.html#${hashPath}`
