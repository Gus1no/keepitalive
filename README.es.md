# keepitalive
Web: https://keepitalive.app

Pequeña utilidad web para mantener despierto el equipo usando la API de Wake Lock y fallbacks (canvas/video y audio inaudible) cuando no está disponible.

## Estructura

- `index.html` — HTML mínimo que referencia los assets.
- `assets/css/styles.css` — estilos globales.
- `assets/js/core.js` — módulo ES con la lógica principal, exporta `initKeepAlive()`.
- `assets/js/app.js` — punto de entrada que inicializa la app.
- `assets/img/logo.png` — icono y logo.
- `LICENSE` — licencia MIT.

## Uso

- Abre `index.html` en tu navegador.
- Si tu navegador bloquea imports de ES Modules en `file://`, sirve la carpeta con un servidor local.

Opcional (Windows PowerShell):

```powershell
# Python 3.x
python -m http.server 5500
# o con Node (si tienes npx)
npx serve . -l 5500
```

Luego abre http://localhost:5500

## Desarrollo

- HTML limpio, sin inline CSS/JS; usa los archivos en `assets/`.
- Lógica: edita `assets/js/core.js` (recomendado) y `assets/js/app.js` para el arranque.
- Estilos: edita `assets/css/styles.css`.

### API mínima

- `initKeepAlive(options?): { enable, disable, setMinutes, getMinutes }`
  - `enable()` / `disable()` activan/desactivan el modo keep-alive.
  - `setMinutes(number|null)` permite configurar minutos o `null` para sin límite.
  - `getMinutes()` devuelve el valor actual o `null`.

## Contribuir

- Lee `CONTRIBUTING.md` para guidelines y flujo de trabajo.
- Este proyecto usa la licencia MIT (ver `LICENSE`).
