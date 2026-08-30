# Pomodoro Timer — Discovery Findings

*Produced by the discover phase (market-researcher). Grounds the spec in the
real world, per Constitution Article 8. Sources: Pomofocus.io, 101planners,
Forest, Session, Focus Keeper, Focus To-Do, Reclaim/ClickUp reviews (2025–2026).*

## The real need
The wish "I want a pomodoro timer" is not a request for a bare 25/5 countdown.
Users who reach for a pomodoro app expect **control over their own rhythm**
(everyone's focus length differs), **to be told when to switch** (audible +
visual), and **to see that it's working** (a count of what they accomplished).
A timer without these reads as broken, not minimal.

## Prior art (leading solutions)
- **Pomofocus.io** — the de-facto web standard: custom durations, long-break
  interval, auto-start toggles, alarm sound + volume, tasks, keyboard shortcuts.
- **101planners** — three presets (Quick 15/3/10, Classic 25/5/15, Deep Work
  50/10/30) + custom; long break after every 2/3/4/5; local privacy-respecting stats.
- **Forest / Focus Keeper / Session** — gamification, tactile circular timer,
  detailed stats history.

## Feature landscape — ranked by adoption
| Priority | Feature | Evidence |
|----------|---------|----------|
| 🔴 must | **Custom durations** (work / short / long, in minutes) | universal — every app |
| 🔴 must | **Long-break interval** configurable (every N pomodoros) | Pomofocus, 101planners |
| 🔴 must | **End-of-session notification** (sound + visual) | universal |
| 🔴 must | **Start / Pause / Reset** + **Skip** current session | universal |
| 🟠 high | **Presets** (Quick / Classic / Deep Work) | 101planners |
| 🟠 high | **Auto-start** breaks / next pomodoro (toggle) | Pomofocus |
| 🟠 high | **Stats**: pomodoros completed today + focus minutes, **local-only** | Focus Keeper, 101planners |
| 🟠 high | **Persistence** of settings across reloads (localStorage) | expected of web apps |
| 🟡 nice | Task list / current-task label | Pomofocus, Focus To-Do |
| 🟡 nice | Keyboard shortcuts (Space / 1 / 2 / 3) | Pomofocus |
| 🟡 nice | Ambient focus sound, themes, tab-title countdown | Pomofocus, StudyFoc.us |

## Unmet needs / differentiators
- Many apps hide customization behind accounts/paywalls — a **free, no-login,
  fully-customizable** timer is genuinely valued (Pomofocus, StudyFoc.us praised for this).
- Stats that **stay in the browser** (privacy) are explicitly appreciated.

## Recommended scope (v1, credible & complete)
**Non-negotiable (🔴 + settings persistence):** custom durations, configurable
long-break interval, start/pause/reset/**skip**, end-of-session sound + visual
notification, settings persisted to localStorage.
**Included (🟠):** three presets + custom, auto-start toggles, local today-stats
(count + focus minutes), tab-title countdown.
**Deferred (🟡):** task list, ambient sound, themes, cloud sync. Named as
non-goals so their absence is a scope decision, not a defect.

*The 🔴 must-haves are the minimum bar. A creation missing any of them is
incomplete and the Creation Judge should not SHIP it.*
