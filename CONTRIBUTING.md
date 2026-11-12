# Contributing to DataForge

1. Create a focused branch or pull request.
2. Run `npm run verify:all` before opening a pull request when browser dependencies are available; at minimum run `npm run verify`.
3. Add or update tests for behavior changes.
4. Keep changes local-first and avoid sending user data to external services.
5. Describe the user-visible behavior and any platform-specific limitations.
6. Do not commit datasets, `.env` files, credentials, build output, or generated Tauri targets.
7. Use the provided issue and pull request templates. Include screenshots for UI changes.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web preview |
| `npm run verify` | TypeScript, frontend, Rust, Clippy, and production build gate |
| `npm run verify:all` | Full gate including sync server, E2E, and audit |
| `npm run tauri dev` | Run the native desktop shell |
| `npm run sync:server` | Run the local authenticated sync reference server |
