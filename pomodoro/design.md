# Pomodoro Timer — Design

## 1. Basic Design

### Overview
Two concerns are separated:
- **`pomodoro.js`** — pure logic. A factory `createTimer(config)` owns all state
  and transitions. No DOM, no timers, no `setInterval`. Time only advances when
  the caller invokes `tick()`. This makes it unit-testable under node.
- **`index.html`** — presentation. It owns the real clock (`setInterval` calling
  `tick()` once per second), reads the timer's state, and renders it. It never
  computes transitions itself.

The same `pomodoro.js` file loads in both environments via a UMD-style guard:
```js
(typeof module !== 'undefined' && module.exports)
  ? module.exports = createTimer
  : window.createTimer = createTimer;
```

## 2. Detailed Design

### 2.1 State Model
The timer holds a single state object:

| Field             | Type                              | Meaning                                   |
|-------------------|-----------------------------------|-------------------------------------------|
| `mode`            | `'work' \| 'break' \| 'longBreak'`| Current interval type                     |
| `remaining`       | `number` (seconds)                | Seconds left in the current interval      |
| `running`         | `boolean`                         | Whether `tick()` advances time            |
| `completed`       | `number`                          | Total completed work sessions             |
| `cyclePosition`   | `number` (0..3)                   | Position within the current set of four   |

### 2.2 Configuration
`createTimer(config)` accepts optional overrides (defaults in seconds):
```js
{
  workDuration:      1500, // 25:00
  breakDuration:      300, //  5:00
  longBreakDuration:  900, // 15:00
  longBreakInterval:    4  // long break after every Nth work session
}
```
Durations are configurable so tests can fast-forward with tiny values.

### 2.3 Core Functions and Signatures
```js
createTimer(config?) -> timer

timer.start()  -> void      // sets running = true (no-op if already at 0? no: resumes)
timer.pause()  -> void      // sets running = false, preserves remaining
timer.reset()  -> void      // back to fresh work, stopped, counts cleared
timer.tick()   -> state     // if running: remaining--, handle transition at 0
timer.getState() -> state   // returns a shallow copy of the state
```

State readable via `getState()` (and via live getters on the instance):
`{ mode, remaining, running, completed, cyclePosition }`.

### 2.4 Transition Logic (inside `tick()`)
1. If `running` is false, do nothing.
2. Decrement `remaining` by 1.
3. If `remaining > 0`, return.
4. If `remaining === 0`, the interval ended — call the transition:
   - **From `work`:**
     - `completed += 1`
     - `cyclePosition += 1`
     - If `cyclePosition === longBreakInterval`: `mode = 'longBreak'`,
       `remaining = longBreakDuration`.
     - Else: `mode = 'break'`, `remaining = breakDuration`.
   - **From `break`:** `mode = 'work'`, `remaining = workDuration`.
   - **From `longBreak`:** `mode = 'work'`, `remaining = workDuration`,
     `cyclePosition = 0` (start a fresh set of four).
   - `running` stays true so cycles continue automatically.

### 2.5 UI Mapping (index.html)
| UI element        | Bound to state                                             |
|-------------------|------------------------------------------------------------|
| MM:SS display     | `formatTime(remaining)`                                     |
| Mode label        | `mode` → "Focus" / "Short Break" / "Long Break"            |
| Cycle dots (x4)   | dot `i` filled when `i < cyclePosition` (or all 4 mid-long-break) |
| Completed count   | `completed`                                                 |
| Progress ring/bar | `1 - remaining / durationForMode(mode)`                    |
| Accent color      | `work`→ red/orange, `break`→ green, `longBreak`→ blue       |
| Start/Pause btn   | toggles `start()` / `pause()` based on `running`           |
| Reset btn         | calls `reset()`                                            |

The page runs one `setInterval(() => { timer.tick(); render(); }, 1000)`,
started/stopped in sync with the timer's `running` flag. `render()` reads
`getState()` and updates the DOM + CSS accent variable each second.
