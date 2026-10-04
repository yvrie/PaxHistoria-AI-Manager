// One stylesheet for the whole panel, injected once into the shadow root.
// Colours, spacing and radii are CSS variables so a theme is a token change.

export const CSS = `
:host {
  all: initial;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  vertical-align: middle;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: dark;

  --bg: #0f1722;
  --surface: #162131;
  --surface-2: #1d2a3d;
  --border: #2f3d52;
  --border-strong: #4a5b75;
  --fg: #e8edf5;
  --muted: #a3b2c7;
  --accent: #6ea8ff;
  --accent-fg: #07111f;
  --accent-soft: #1b3558;
  --ok: #5fd3a0;
  --ok-soft: #123628;
  --warn: #f0c36b;
  --warn-soft: #3a2f14;
  --danger: #ff8c9a;
  --danger-soft: #3b1d25;
  --shadow: 0 20px 60px rgba(0, 0, 0, .55);
  --radius: 12px;
  --radius-sm: 8px;
  --gap: 12px;
  color: var(--fg);
}

@media (prefers-color-scheme: light) {
  :host {
    color-scheme: light;
    --bg: #f6f8fb;
    --surface: #ffffff;
    --surface-2: #eef2f8;
    --border: #d5dde9;
    --border-strong: #9fb0c8;
    --fg: #172033;
    --muted: #556379;
    --accent: #1f5fd1;
    --accent-fg: #ffffff;
    --accent-soft: #e2ecfd;
    --ok: #137a4d;
    --ok-soft: #dff5ea;
    --warn: #8a5a00;
    --warn-soft: #fdf1d3;
    --danger: #b3261e;
    --danger-soft: #fde8e6;
    --shadow: 0 20px 60px rgba(20, 30, 50, .25);
  }
}

:host(.relay-launcher-positioned),
:host(.relay-launcher-fallback) { position: fixed; z-index: 2147483646; }
:host(.relay-launcher-fallback) {
  top: calc(7px + env(safe-area-inset-top));
  left: min(62vw, calc(100vw - 96px - env(safe-area-inset-right)));
}

* { box-sizing: border-box; min-width: 0; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
[hidden] { display: none !important; }

/* Launcher ---------------------------------------------------------- */
#launch {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 62px; height: 36px; padding: 0 12px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--fg);
  font-family: inherit; font-size: 12px; font-weight: 650; line-height: 1; cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,.4);
  transition: background-color .15s, border-color .15s;
}
#launch:hover { background: var(--surface-2); border-color: var(--accent); }
#launch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Dialog ------------------------------------------------------------ */
dialog {
  width: min(720px, calc(100vw - 24px)); max-height: min(88dvh, 880px);
  padding: 0; margin: auto; overflow: hidden;
  color: var(--fg); background: var(--bg);
  border: 1px solid var(--border); border-radius: 18px; box-shadow: var(--shadow);
  font: inherit;
}
dialog[open] { display: flex; flex-direction: column; }
dialog::backdrop { background: rgba(5, 9, 15, .66); backdrop-filter: blur(2px); }

.dlg-head {
  display: flex; align-items: center; justify-content: space-between; gap: var(--gap);
  padding: 14px 18px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.dlg-head h2 { margin: 0; font-size: 16px; font-weight: 650; }
.dlg-head p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
.dlg-main { flex: 1 1 auto; overflow-y: auto; padding: 18px; display: grid; gap: 16px; align-content: start; overscroll-behavior: contain; }
.dlg-foot {
  display: grid; gap: 8px; padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border); background: var(--surface);
}
.foot-row { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); flex-wrap: wrap; }
.foot-status { margin: 0; color: var(--muted); font-size: 13px; flex: 1 1 200px; overflow-wrap: anywhere; }
.foot-status.ok { color: var(--ok); }
.foot-status.bad { color: var(--danger); }
.foot-actions { display: flex; gap: 8px; margin-left: auto; }
.todo { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.todo li { padding: 3px 10px; border-radius: 999px; background: var(--warn-soft); color: var(--warn); font-size: 12px; }

/* Cards and sections ------------------------------------------------ */
.card { display: grid; gap: var(--gap); padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.card > h3, .card-head h3 { margin: 0; font-size: 15px; font-weight: 650; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--gap); flex-wrap: wrap; }
.chip { display: inline-block; margin-left: 10px; padding: 2px 10px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); font-size: 12px; font-weight: 600; vertical-align: middle; }
.chip.ok { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
.chip.bad { background: var(--danger-soft); color: var(--danger); border-color: transparent; }
.chip.busy { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
.lede, .hint { margin: 0; color: var(--muted); font-size: 13px; }
.hint { font-size: 12px; }
.muted { color: var(--muted); }

/* Forms ------------------------------------------------------------- */
.field { display: grid; gap: 5px; }
.field label { font-weight: 600; font-size: 13px; }
.req { color: var(--danger); }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); }
button, input, select, textarea { font: inherit; color: inherit; }
input:not([type=checkbox]), select, textarea {
  width: 100%; min-height: 40px; padding: 8px 11px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg);
}
textarea { min-height: 84px; resize: vertical; font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; }
input::placeholder { color: var(--muted); opacity: .8; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, summary:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
[aria-invalid="true"] { border-color: var(--danger) !important; }
.field-error { margin: 0; color: var(--danger); font-size: 12.5px; }
.secret { display: flex; gap: 8px; }
.secret input { flex: 1; }
.check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.check input { width: 18px; height: 18px; margin-top: 2px; flex: none; accent-color: var(--accent); }
.check small { display: block; }

/* Buttons ----------------------------------------------------------- */
button {
  min-height: 40px; padding: 8px 16px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  background: var(--surface-2); cursor: pointer; font-weight: 600; transition: background-color .15s, border-color .15s, opacity .15s;
}
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: .5; cursor: not-allowed; }
button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
button.primary:hover:not(:disabled) { filter: brightness(1.08); }
button.ghost { background: transparent; border-color: transparent; color: var(--muted); }
button.ghost:hover:not(:disabled) { color: var(--fg); background: var(--surface-2); }
button.danger { color: var(--danger); border-color: var(--danger); background: transparent; }
button.small { min-height: 32px; padding: 4px 10px; font-size: 12.5px; }
button[aria-busy="true"] { position: relative; color: transparent; pointer-events: none; }
button[aria-busy="true"]::after {
  content: ""; position: absolute; inset: 0; margin: auto; width: 16px; height: 16px;
  border: 2px solid var(--accent-fg); border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite;
}
button:not(.primary)[aria-busy="true"]::after { border-color: var(--accent); border-right-color: transparent; }
.icon-btn { width: 40px; padding: 0; font-size: 18px; line-height: 1; }
@keyframes spin { to { transform: rotate(360deg); } }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.row.end { justify-content: flex-end; }

/* Provider picker --------------------------------------------------- */
.group-label { margin: 6px 0 0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.provider-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.provider { display: grid; gap: 2px; align-content: start; text-align: left; min-height: 62px; padding: 10px 12px; background: var(--bg); }
.provider strong { font-size: 13.5px; overflow-wrap: anywhere; }
.provider span { color: var(--muted); font-size: 12px; font-weight: 400; overflow-wrap: anywhere; }
.provider[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.provider:disabled { opacity: .55; }

/* Status, notices, badges ------------------------------------------- */
.conn-status { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 13px; overflow-wrap: anywhere; }
.conn-status::before { content: ""; flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--border-strong); }
.conn-status.ok { color: var(--ok); } .conn-status.ok::before { background: var(--ok); }
.conn-status.bad { color: var(--danger); } .conn-status.bad::before { background: var(--danger); }
.conn-status.busy::before { background: var(--accent); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .3; } }
.notice { margin: 0; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 13px; background: var(--surface-2); border: 1px solid var(--border); overflow-wrap: anywhere; }
.notice.warn { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); }
.notice.bad { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
.notice.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.notice .row { margin-top: 8px; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.badge { padding: 2px 9px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); font-size: 12px; }
.badge.ok { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
.badge.warn { background: var(--warn-soft); color: var(--warn); border-color: transparent; }

/* Features ---------------------------------------------------------- */
.feature { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); }
.feature-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.feature-head strong { font-size: 13.5px; }
.backups { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.backup { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--surface-2); }
.backup span { flex: 1; overflow-wrap: anywhere; font-size: 13px; }
.backup button { min-height: 30px; padding: 2px 8px; }

/* Disclosure -------------------------------------------------------- */
details { border-top: 1px solid var(--border); padding-top: 4px; }
details > summary { cursor: pointer; padding: 8px 0; font-weight: 600; color: var(--fg); list-style-position: inside; }
details[open] > summary { margin-bottom: 8px; }
details > .stack, .stack { display: grid; gap: var(--gap); }
.card details:first-of-type { border-top: 0; padding-top: 0; }
pre.events { margin: 0; padding: 10px; max-height: 200px; overflow: auto; border-radius: var(--radius-sm); background: var(--bg); border: 1px solid var(--border); font-size: 12px; white-space: pre-wrap; }

/* Done screen & messages -------------------------------------------- */
.summary { display: grid; gap: 8px; margin: 0; }
.summary div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.summary dt { color: var(--muted); }
.summary dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.center { text-align: center; padding: 8px 0; }
.big-check { width: 52px; height: 52px; margin: 0 auto 8px; display: grid; place-items: center; border-radius: 50%; background: var(--ok-soft); color: var(--ok); font-size: 26px; }

/* Small screens ----------------------------------------------------- */
@media (max-width: 600px) {
  dialog { width: 100vw; max-width: 100vw; max-height: 92dvh; margin: auto 0 0; border-radius: 18px 18px 0 0; border-bottom: 0; }
  .dlg-main { padding: 14px; }
  .dlg-head, .dlg-foot { padding-left: 14px; padding-right: 14px; }
  .grid-2 { grid-template-columns: 1fr; }
  input:not([type=checkbox]), select, textarea { font-size: 16px; }
  button { min-height: 44px; }
  button.small { min-height: 36px; }
  .foot-actions { width: 100%; }
  .foot-actions button { flex: 1; }
  .provider-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition: none !important; }
}
`;
