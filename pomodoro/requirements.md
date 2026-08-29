# Pomodoro Timer — Requirements

## Intent
Provide a simple, distraction-free web app that helps a user work in focused
25-minute intervals separated by short breaks, following the Pomodoro
Technique. The app should make the current mode, time remaining, and progress
through a cycle obvious at a glance, and require no setup or accounts.

## User Stories
- **US-1** As a user, I want to start a 25-minute work session so I can focus.
- **US-2** As a user, I want the timer to automatically switch to a break when a
  work session ends so I don't have to manage transitions manually.
- **US-3** As a user, I want short breaks (5 min) between work sessions and a
  longer break (15 min) after every 4th work session so I can rest properly.
- **US-4** As a user, I want to pause and resume the timer so I can handle
  interruptions.
- **US-5** As a user, I want to reset everything back to the start so I can begin
  a fresh series of pomodoros.
- **US-6** As a user, I want to see how many work sessions I've completed and
  where I am in the current set of four so I can track progress.

## Functional Requirements
1. The app SHALL run a countdown timer with three modes: **work**, **break**
   (short break), and **longBreak**.
2. A work session SHALL last 25 minutes (1500 seconds).
3. A short break SHALL last 5 minutes (300 seconds).
4. A long break SHALL last 15 minutes (900 seconds).
5. The app SHALL provide **Start**, **Pause**, and **Reset** controls.
6. When a work session reaches zero, the app SHALL automatically switch to a
   break and increment the completed-pomodoros count.
7. After every 4th completed work session, the following break SHALL be a
   **long break**; otherwise it SHALL be a short break.
8. When any break reaches zero, the app SHALL automatically switch back to a
   work session.
9. The app SHALL display the time remaining in the current mode as MM:SS.
10. The app SHALL display the current mode label.
11. The app SHALL display a visible cycle counter showing progress through the
    current set of four work sessions.
12. The app SHALL display the total number of completed work sessions.
13. Pause SHALL stop the countdown without losing the remaining time; Start
    SHALL resume from the remaining time.
14. Reset SHALL return the app to a fresh work session with the completed count
    and cycle position cleared, in a stopped state.

## Acceptance Criteria
- **AC-1** Given a fresh app, the mode is `work` and the display reads `25:00`.
- **AC-2** Given a running work session that reaches `00:00`, the mode becomes
  `break`, the display reads `05:00`, and the completed count increases by 1.
- **AC-3** Given a running short break that reaches `00:00`, the mode becomes
  `work` and the display reads `25:00`.
- **AC-4** Given 4 completed work sessions, the break that begins after the 4th
  is `longBreak` with the display reading `15:00`.
- **AC-5** Given a `longBreak` that reaches `00:00`, the mode returns to `work`
  reading `25:00`, and the cycle position restarts at the first of four.
- **AC-6** Pressing Pause stops the countdown; the displayed time does not change
  while paused. Pressing Start resumes counting from that same time.
- **AC-7** Pressing Reset from any state returns mode to `work`, display to
  `25:00`, completed count to `0`, cycle dots to empty, and the timer stopped.
- **AC-8** The cycle counter shows exactly 4 positions and fills one position per
  completed work session, resetting to empty after the long break completes.
- **AC-9** The accent color is red/orange during `work`, green during `break`,
  and blue during `longBreak`.
