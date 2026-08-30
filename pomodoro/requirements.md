# Pomodoro Timer — Requirements (v1, complete)

*Grounded in `findings.md` (discover phase). Every 🔴 must-have and 🟠 high
feature from the ranked landscape is in scope. Each acceptance criterion (AC) is
numbered and testable. The pure state machine lives in `pomodoro.js` (tick-driven,
no DOM, no real clock — deterministic under node); the browser UI lives in
`index.html` and drives the module with a 1 Hz `setInterval → tick()`.*

## Scope summary
A free, no-login, fully-customizable pomodoro timer with presets, auto-start
toggles, end-of-session notification (sound + visual + tab title), local-only
today-stats, and settings persisted across reloads. All 🔴 must-haves are
non-negotiable per the Creation Judge bar in findings.md.

---

## 1. Custom durations — 🔴 must
- **1.1** The user can set the **work** duration in whole minutes (≥ 1).
- **1.2** The user can set the **short break** duration in whole minutes (≥ 1).
- **1.3** The user can set the **long break** duration in whole minutes (≥ 1).
- **1.4** Durations are held internally in **seconds**; a change to the current
  mode's duration is reflected in the displayed remaining time immediately
  (`setConfig` updates `remaining` for the active mode).
- **1.5** Default durations are Classic **25 / 5 / 15** when no config is given.

## 2. Configurable long-break interval — 🔴 must
- **2.1** The user can set **N** = number of work sessions before a long break (≥ 1).
- **2.2** After every **N**-th completed work session the next break is a
  **long break**; otherwise it is a **short break**.
- **2.3** Completing a long break resets the cycle counter to 0.
- **2.4** Default interval N = **4**.

## 3. Start / Pause / Reset / Skip — 🔴 must
- **3.1** **Start** sets the timer running; each `tick()` decrements remaining by 1s.
- **3.2** **Pause** halts counting; `tick()` while paused is a no-op.
- **3.3** **Reset** returns to a fresh **work** session, not running, cycle
  counter 0. (Reset rewinds the timer; it does NOT clear today-stats.)
- **3.4** **Skip** ends the current session immediately, applying the **same**
  transition rules as a natural expiry (work→break/longBreak, break→work,
  longBreak→work + cycle reset) and the same auto-start behavior.
- **3.5** Skipping a work session **credits its completion** (completed +1,
  cyclePosition +1) but does **not** credit focus time for unspent seconds.

## 4. End-of-session notification — 🔴 must
- **4.1** On any session boundary the UI plays an **audible beep** (WebAudio
  oscillator; no external audio file).
- **4.2** On any session boundary the UI shows a **visual flash** cue.
- **4.3** The **document title** shows a live `MM:SS · mode` countdown while
  running, and announces the new session on transition (tab-title countdown).

## 5. Presets + custom — 🟠 high
- **5.1** Three presets are selectable, in seconds:
  - **Quick** 15 / 3 / 10
  - **Classic** 25 / 5 / 15
  - **Deep Work** 50 / 10 / 30
- **5.2** Presets are exposed on the factory as `createTimer.PRESETS`
  (`quick`, `classic`, `deepWork`).
- **5.3** Editing any duration field puts the user in **Custom** mode; presets
  are one-click shortcuts, not a lock.

## 6. Auto-start toggles — 🟠 high
- **6.1** **Auto-start breaks**: when on, running continues through a
  work→break boundary; when off, the transition sets `running = false` and the
  user must Start the break.
- **6.2** **Auto-start next pomodoro**: when on, running continues through a
  break→work boundary; when off, the transition halts.
- **6.3** Both default **on** (preserves the single-`start()`-drives-all-cycles
  behavior the base test suite relies on).

## 7. Today-stats (local only) — 🟠 high
- **7.1** The UI shows **pomodoros completed today** and **focus minutes** today.
- **7.2** `getStats()` returns `{ completedToday, focusSeconds }`.
- **7.3** `focusSeconds` accumulates **only** on work-mode ticks (breaks never
  add focus time).
- **7.4** Stats are **local-only** (localStorage), keyed by calendar date, and
  reset automatically on a new day. No network, no account.

## 8. Persistence — 🟠 high
- **8.1** Settings (durations, interval, both auto-start toggles, selected
  preset) are saved to **localStorage** on change.
- **8.2** On reload the saved settings are restored and applied to the timer.
- **8.3** Today-stats persist across reloads for the same calendar day.

## 9. Module contract (backward-compatible) — invariant
- **9.1** `createTimer(config)` factory; UMD guard supports `require()` **and**
  `window.createTimer`.
- **9.2** Methods: `start()`, `pause()`, `reset()`, `tick()`, `getState()`,
  plus new `skip()`, `setConfig(partial)`, `getStats()`.
- **9.3** Live getters: `mode`, `remaining`, `running`, `completed`,
  `cyclePosition`, `focusSeconds`, `completedToday`, `stats`.
- **9.4** The existing `pomodoro.test.js` (initial work/25:00, tick decrements,
  pause no-op, reset, work→break→work, longBreak every interval) **must still
  pass unchanged**.

---

## Non-goals (explicit, per findings.md 🟡 "Deferred")
These are **scope decisions, not defects**:
- **Task list / current-task label** — out of scope for v1.
- **Ambient focus sound** (rain, white noise, etc.) — out of scope for v1.
- **Themes / theme switching** — out of scope; a single polished dark theme only.
- (Also deferred: cloud sync, accounts, cross-device stats history.)

## UI accent colors
- **Work** → red / orange, **Break** → green, **Long break** → blue.
