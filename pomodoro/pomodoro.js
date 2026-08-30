/**
 * Pomodoro Timer — pure logic (no DOM, no real clock).
 *
 * Time advances ONLY when the caller invokes tick(). This keeps the module
 * deterministic and unit-testable under node. The browser drives it with a
 * setInterval that calls tick() once per second.
 *
 * Loadable in both environments:
 *   - node:    const createTimer = require('./pomodoro.js');
 *   - browser: <script src="pomodoro.js"></script>  // window.createTimer
 *
 * Backward-compatible with the original API (createTimer factory, start/pause/
 * reset/tick/getState, live getters, durationForMode, config). Extended with:
 *   - config: autoStartBreaks, autoStartPomodoros (default TRUE so legacy tests
 *     that start() once and tick through many transitions keep running).
 *   - skip():       end the current session now, applying the same transition
 *                   rules (and the same auto-start behavior) as a natural end.
 *   - setConfig():  change durations / interval / auto-start live.
 *   - getStats():   { completedToday, focusSeconds } — focusSeconds accrues
 *                   ONLY on work ticks.
 *   - createTimer.PRESETS: { quick, classic, deepWork }.
 */
(function () {
  'use strict';

  // Preset durations in SECONDS (minutes * 60). longBreakInterval = 4 each.
  var PRESETS = {
    quick:    { workDuration: 15 * 60, breakDuration:  3 * 60, longBreakDuration: 10 * 60, longBreakInterval: 4 },
    classic:  { workDuration: 25 * 60, breakDuration:  5 * 60, longBreakDuration: 15 * 60, longBreakInterval: 4 },
    deepWork: { workDuration: 50 * 60, breakDuration: 10 * 60, longBreakDuration: 30 * 60, longBreakInterval: 4 }
  };

  function createTimer(config) {
    config = config || {};

    var cfg = {
      workDuration:       config.workDuration       != null ? config.workDuration       : 25 * 60, // 1500
      breakDuration:      config.breakDuration      != null ? config.breakDuration      :  5 * 60, //  300
      longBreakDuration:  config.longBreakDuration  != null ? config.longBreakDuration  : 15 * 60, //  900
      longBreakInterval:  config.longBreakInterval  != null ? config.longBreakInterval  : 4,
      // Default TRUE: preserves legacy behavior where a single start() drives
      // cycles automatically. Turn off so a transition halts (running=false)
      // and the user must start() the next session.
      autoStartBreaks:    config.autoStartBreaks    != null ? config.autoStartBreaks    : true,
      autoStartPomodoros: config.autoStartPomodoros != null ? config.autoStartPomodoros : true
    };

    var state = {
      mode: 'work',
      remaining: cfg.workDuration,
      running: false,
      completed: 0,
      cyclePosition: 0
    };

    // Stats are cumulative for the timer's lifetime ("today" from the caller's
    // perspective). They are independent of reset(), which only rewinds the
    // running timer, not the day's tally.
    var stats = {
      completedToday: 0,
      focusSeconds: 0
    };

    function durationForMode(mode) {
      if (mode === 'work') return cfg.workDuration;
      if (mode === 'break') return cfg.breakDuration;
      return cfg.longBreakDuration; // longBreak
    }

    // Advance the state machine to the next session and decide whether the
    // timer keeps running through the boundary (auto-start) or halts.
    function transition() {
      if (state.mode === 'work') {
        state.completed += 1;
        stats.completedToday += 1;
        state.cyclePosition += 1;
        if (state.cyclePosition >= cfg.longBreakInterval) {
          state.mode = 'longBreak';
          state.remaining = cfg.longBreakDuration;
        } else {
          state.mode = 'break';
          state.remaining = cfg.breakDuration;
        }
        // Entering a break: keep running only if breaks auto-start.
        state.running = !!cfg.autoStartBreaks;
      } else if (state.mode === 'break') {
        state.mode = 'work';
        state.remaining = cfg.workDuration;
        // Entering work: keep running only if pomodoros auto-start.
        state.running = !!cfg.autoStartPomodoros;
      } else { // longBreak
        state.mode = 'work';
        state.remaining = cfg.workDuration;
        state.cyclePosition = 0;
        state.running = !!cfg.autoStartPomodoros;
      }
    }

    var timer = {
      start: function () { state.running = true; return timer.getState(); },
      pause: function () { state.running = false; return timer.getState(); },
      reset: function () {
        state.mode = 'work';
        state.remaining = cfg.workDuration;
        state.running = false;
        state.completed = 0;
        state.cyclePosition = 0;
        return timer.getState();
      },
      tick: function () {
        if (!state.running) return timer.getState();
        if (state.mode === 'work') stats.focusSeconds += 1; // focus time only
        state.remaining -= 1;
        if (state.remaining <= 0) {
          transition();
        }
        return timer.getState();
      },
      // End the current session immediately, applying the same transition
      // rules (and the same auto-start behavior) as a natural expiry. Skipping
      // does NOT credit focus time for the unspent seconds.
      skip: function () {
        transition();
        return timer.getState();
      },
      // Change configuration live. Any provided duration for the CURRENT mode
      // is reflected into `remaining` so the change is visible immediately.
      setConfig: function (partial) {
        partial = partial || {};
        var keys = ['workDuration', 'breakDuration', 'longBreakDuration',
                    'longBreakInterval', 'autoStartBreaks', 'autoStartPomodoros'];
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (partial[k] != null) cfg[k] = partial[k];
        }
        // Reflect the current mode's (possibly new) duration immediately.
        state.remaining = durationForMode(state.mode);
        return timer.getState();
      },
      getStats: function () {
        return { completedToday: stats.completedToday, focusSeconds: stats.focusSeconds };
      },
      getState: function () {
        return {
          mode: state.mode,
          remaining: state.remaining,
          running: state.running,
          completed: state.completed,
          cyclePosition: state.cyclePosition,
          completedToday: stats.completedToday,
          focusSeconds: stats.focusSeconds
        };
      },
      durationForMode: durationForMode,
      config: cfg
    };

    // live read-only-ish getters for convenience
    Object.defineProperty(timer, 'mode',          { get: function () { return state.mode; } });
    Object.defineProperty(timer, 'remaining',     { get: function () { return state.remaining; } });
    Object.defineProperty(timer, 'running',       { get: function () { return state.running; } });
    Object.defineProperty(timer, 'completed',     { get: function () { return state.completed; } });
    Object.defineProperty(timer, 'cyclePosition', { get: function () { return state.cyclePosition; } });
    Object.defineProperty(timer, 'focusSeconds',  { get: function () { return stats.focusSeconds; } });
    Object.defineProperty(timer, 'completedToday',{ get: function () { return stats.completedToday; } });
    Object.defineProperty(timer, 'stats',         { get: function () { return timer.getStats(); } });

    return timer;
  }

  // Presets exposed on the factory for both environments.
  createTimer.PRESETS = PRESETS;

  // UMD-style guard: node require() OR browser <script>
  (typeof module !== 'undefined' && module.exports)
    ? (module.exports = createTimer)
    : (window.createTimer = createTimer);
})();
