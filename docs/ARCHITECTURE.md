# Architecture

`main/entry.cts` configures the dedicated userData directory and loopback Chromium debugging port before Electron becomes ready. `main/main.ts` is the composition root and trusted IPC boundary. `main/browser.ts` owns WebContentsViews and the persistent partition. The React shell has a narrow preload bridge; external web contents have no preload or Node access.

`packages/core` owns task leases, idempotent requests, consent and SQLite metadata. `packages/capabilities` derives candidates from agent-browser accessibility refs. Approval promotes the exact screen/input action to a recorded contract; it does not create blanket site authority. A fresh snapshot, target ID, origin, revision, lease and selected file are validated before execution. Browser acknowledgement is not a business success assertion.

`packages/agent-adapter` serializes pinned native CLI calls and selects an exact Chromium target before every operation. Viewport dimensions are synchronized with the native view to avoid Windows scaling and initial view-layout mismatches. The CLI talks only to HONMOON's embedded Electron process. A transparent native view intercepts physical interaction during a lease; clicking it cancels the task and returns control, while CDP continues to address the underlying web contents.

`packages/codex-adapter` speaks app-server JSON-RPC over stdio. It uses a dedicated CODEX_HOME and workspace, read-only sandbox, no shell/unified exec/web search/plugins/apps/browser/computer tools, and only HONMOON dynamic tool definitions. Host-side action permissions remain mandatory. Unknown app-server tool requests are refused. Generated schemas were checked against the installed CLI. Model-level tool inventory and end-to-end execution still require authenticated pilot verification.

`packages/mcp` provides the same service operations over stdio via a local authenticated named-pipe gateway. It never exports raw agent-browser MCP. Secrets, cookie APIs, arbitrary JavaScript and arbitrary filesystem paths are not public tools.

The app persists profile login state in Chromium. A separate Auth Vault uses upstream encrypted credential files and a DPAPI-protected key. No claim is made that the complete profile is encrypted. Auth shielding combines an explicit user mode and conservative visible-login detection; unrecognized authentication pages should be opened in explicit login mode.

Production boundaries: local single-user prototype, unsigned Windows package, one task per profile, no auto-update, no remote execution. The original theme prototype is independent and unchanged.
