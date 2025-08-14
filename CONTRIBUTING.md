# Contributing to keepitalive

Thanks for your interest! We want contributions to be simple and welcoming.

## Basic flow

1. Fork the repository.
2. Create a branch from `main` (e.g., `feat/my-improvement` or `fix/my-bug`).
3. Make small, well-described changes.
4. Open a Pull Request explaining the rationale and what changed.

## Code style

- HTML with no inline CSS/JS.
- JavaScript as ES Modules:
  - Main logic in `assets/js/core.js`.
  - Entry point in `assets/js/app.js`.
- CSS in `assets/css/styles.css`.

## Local development

- Open `index.html` directly in the browser, or use a local server if your browser blocks ES Modules over `file://`.
- Test the main flows:
  - ON/OFF button.
  - Presets 15/30/60/120/240/∞.
  - +5/-5 controls and manual input.
  - "No limit" mode.

## Principles

- Keep the code simple and readable.
- Avoid unnecessary dependencies.
- Comment non-obvious decisions.

## License

By contributing you agree that your contributions are licensed under MIT.
