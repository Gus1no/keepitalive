# keepitalive
# keepitalive
Live: https://keepitalive.app

Small web utility to prevent your device from sleeping, using the Wake Lock API when available and fallbacks (canvas/video or near‑silent audio) otherwise.

## Structure

- `index.html` — minimal HTML that references the assets.
- `assets/css/styles.css` — global styles.
- `assets/js/core.js` — ES module with the main logic, exports `initKeepAlive()`.
- `assets/js/app.js` — entry point that initializes the app.
- `assets/img/logo.png` — icon and logo.
- `LICENSE` — MIT license.

## Usage

- Open `index.html` in your browser.
- If your browser blocks ES Modules over `file://`, serve the folder with a local server.

Optional (Windows PowerShell):

```powershell
# Python 3.x
python -m http.server 5500
# or with Node (if you have npx)
npx serve . -l 5500
```

Then open http://localhost:5500

## Development

- Keep HTML clean (no inline CSS/JS); use files under `assets/`.
- Logic: edit `assets/js/core.js` (recommended) and `assets/js/app.js` for bootstrapping.
- Styles: edit `assets/css/styles.css`.

### Minimal API

- `initKeepAlive(options?): { enable, disable, setMinutes, getMinutes }`
  - `enable()` / `disable()` turn keep-alive mode on/off.
  - `setMinutes(number|null)` sets the minutes or `null` for no limit.
  - `getMinutes()` returns the current value or `null`.

## Contributing

- See `CONTRIBUTING.md` for guidelines and workflow.
- Licensed under MIT (`LICENSE`).