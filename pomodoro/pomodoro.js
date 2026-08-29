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
 */
(function () {
  'use strict';

  function createTimer(config) {
    config = config || {};

    var cfg = {
      workDuration:      config.workDuration      != null ? config.workDuration      : 25 * 60, // 1500
      breakDuration:     config.breakDuration     != null ? config.breakDuration     :  5 * 60, //  300
      longBreakDuration: config.longBreakDuration != null ? config.longBreakDuration : 15 * 60, //  900
      longBreakInterval: config.longBreakInterval != null ? config.longBreakInterval : 4
    };

    var state = {
      mode: 'work',
      remaining: cfg.workDuration,
      running: false,
      completed: 0,
      cyclePosition: 0
    };

    function durationForMode(mode) {
      if (mode === 'work') return cfg.workDuration;
      if (mode === 'break') return cfg.breakDuration;
      return cfg.longBreakDuration; // longBreak
    }

    function transition() {
      if (state.mode === 'work') {
        state.completed += 1;
        state.cyclePosition += 1;
        if (state.cyclePosition >= cfg.longBreakInterval) {
          state.mode = 'longBreak';
          state.remaining = cfg.longBreakDuration;
        } else {
          state.mode = 'break';
          state.remaining = cfg.breakDuration;
        }
      } else if (state.mode === 'break') {
        state.mode = 'work';
        state.remaining = cfg.workDuration;
      } else { // longBreak
        state.mode = 'work';
        state.remaining = cfg.workDuration;
        state.cyclePosition = 0;
      }
      // running stays true so cycles continue automatically
    }

    var timer = {
      start: function () { state.running = true; },
      pause: function () { state.running = false; },
      reset: function () {
        state.mode = 'work';
        state.remaining = cfg.workDuration;
        state.running = false;
        state.completed = 0;
        state.cyclePosition = 0;
      },
      tick: function () {
        if (!state.running) return timer.getState();
        state.remaining -= 1;
        if (state.remaining <= 0) {
          transition();
        }
        return timer.getState();
      },
      getState: function () {
        return {
          mode: state.mode,
          remaining: state.remaining,
          running: state.running,
          completed: state.completed,
          cyclePosition: state.cyclePosition
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

    return timer;
  }

  // UMD-style guard: node require() OR browser <script>
  (typeof module !== 'undefined' && module.exports)
    ? (module.exports = createTimer)
    : (window.createTimer = createTimer);
})();
