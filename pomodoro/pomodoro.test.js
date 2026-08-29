#!/usr/bin/env node
/**
 * POMODORO :: Self-test
 * Proves the pure-logic pomodoro timer state machine actually works.
 * Pure Node, no test framework. Exit 0 = pomodoro is healthy.
 *
 * Real module API (confirmed by reading pomodoro.js):
 *   module.exports = createTimer(config)
 *   config keys: workDuration, breakDuration, longBreakDuration, longBreakInterval
 *   methods:     start(), pause(), reset(), tick(), getState()
 *   state:       { mode:'work'|'break'|'longBreak', remaining, running, completed, cyclePosition }
 */
'use strict';
const assert = require('assert');
const path = require('path');
const createTimer = require(path.join(__dirname, 'pomodoro.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); pass++; }
  catch (e) { console.log('  \u2717 ' + name + '\n      ' + e.message); fail++; }
}

// Shortened, fast config. Task-requested shape mapped to the real API names:
//   work:2 -> workDuration, break:1 -> breakDuration,
//   longBreak:3 -> longBreakDuration, cyclesBeforeLongBreak:4 -> longBreakInterval
const CFG = { workDuration: 2, breakDuration: 1, longBreakDuration: 3, longBreakInterval: 4 };

// Advance a running timer by n ticks; returns final state.
function ticks(t, n) { let s; for (let i = 0; i < n; i++) s = t.tick(); return s || t.getState(); }

console.log('Pomodoro timer:');

// (a) initial state is work mode with full work duration and 0 completed
test('initial state: work mode, full work duration, 0 completed, not running', () => {
  const t = createTimer(CFG);
  const s = t.getState();
  assert.strictEqual(s.mode, 'work', 'starts in work mode');
  assert.strictEqual(s.remaining, CFG.workDuration, 'remaining == workDuration');
  assert.strictEqual(s.completed, 0, 'no sessions completed yet');
  assert.strictEqual(s.running, false, 'not running until start()');
});

// (b) start then tick decrements remaining
test('start then tick decrements remaining', () => {
  const t = createTimer(CFG);
  t.start();
  const s = t.tick();
  assert.strictEqual(s.running, true, 'running after start()');
  assert.strictEqual(s.remaining, CFG.workDuration - 1, 'one tick decrements by 1');
});

// (c) pause stops the countdown (tick after pause does not decrement)
test('pause stops the countdown (tick after pause is a no-op)', () => {
  const t = createTimer(CFG);
  t.start();
  t.tick(); // remaining: 2 -> 1
  const before = t.getState().remaining;
  t.pause();
  const s = t.tick(); // should NOT decrement
  assert.strictEqual(s.running, false, 'not running after pause()');
  assert.strictEqual(s.remaining, before, 'remaining unchanged while paused');
});

// (d) reset returns to initial
test('reset returns to initial state', () => {
  const t = createTimer(CFG);
  t.start();
  ticks(t, 3); // run past a work session into a break
  t.reset();
  const s = t.getState();
  assert.strictEqual(s.mode, 'work', 'mode back to work');
  assert.strictEqual(s.remaining, CFG.workDuration, 'remaining back to full work');
  assert.strictEqual(s.completed, 0, 'completed reset to 0');
  assert.strictEqual(s.running, false, 'not running after reset');
  assert.strictEqual(s.cyclePosition, 0, 'cyclePosition reset to 0');
});

// (e) a work session running to zero transitions to break and increments completed
test('work session to zero -> break, completed increments', () => {
  const t = createTimer(CFG);
  t.start();
  const s = ticks(t, CFG.workDuration); // 2 ticks drive work to zero
  assert.strictEqual(s.mode, 'break', 'transitions from work to break');
  assert.strictEqual(s.completed, 1, 'one work session completed');
  assert.strictEqual(s.remaining, CFG.breakDuration, 'remaining reset to break duration');
});

// (f) after the configured number of work sessions, the next break is a longBreak
test('after longBreakInterval work sessions the break is a longBreak', () => {
  const t = createTimer(CFG);
  t.start();
  // Complete (interval-1) full work+break cycles, then one more work session.
  for (let i = 0; i < CFG.longBreakInterval - 1; i++) {
    ticks(t, CFG.workDuration);  // work -> break
    ticks(t, CFG.breakDuration); // break -> work
  }
  const s = ticks(t, CFG.workDuration); // the 4th work session completes
  assert.strictEqual(s.completed, CFG.longBreakInterval, 'four work sessions completed');
  assert.strictEqual(s.mode, 'longBreak', 'the interval-th break is a longBreak');
  assert.strictEqual(s.remaining, CFG.longBreakDuration, 'remaining == longBreakDuration');
});

// (g) break running to zero returns to work
test('break to zero returns to work', () => {
  const t = createTimer(CFG);
  t.start();
  ticks(t, CFG.workDuration); // work -> break
  assert.strictEqual(t.getState().mode, 'break', 'precondition: in break');
  const s = ticks(t, CFG.breakDuration); // break -> work
  assert.strictEqual(s.mode, 'work', 'returns to work after break');
  assert.strictEqual(s.remaining, CFG.workDuration, 'remaining reset to work duration');
});

// (g') longBreak running to zero also returns to work and resets the cycle
test('longBreak to zero returns to work and resets cyclePosition', () => {
  const t = createTimer(CFG);
  t.start();
  for (let i = 0; i < CFG.longBreakInterval - 1; i++) {
    ticks(t, CFG.workDuration);
    ticks(t, CFG.breakDuration);
  }
  ticks(t, CFG.workDuration); // -> longBreak
  assert.strictEqual(t.getState().mode, 'longBreak', 'precondition: in longBreak');
  const s = ticks(t, CFG.longBreakDuration); // longBreak -> work
  assert.strictEqual(s.mode, 'work', 'returns to work after longBreak');
  assert.strictEqual(s.cyclePosition, 0, 'cyclePosition reset after longBreak');
});

// Extra: tick before start() does nothing (guarded countdown)
test('tick before start() is a no-op', () => {
  const t = createTimer(CFG);
  const s = t.tick();
  assert.strictEqual(s.remaining, CFG.workDuration, 'no decrement while not running');
  assert.strictEqual(s.running, false, 'still not running');
});

// Extra: default config yields the standard 25/5/15 durations
test('default config uses 25/5/15 minute durations', () => {
  const t = createTimer();
  assert.strictEqual(t.getState().remaining, 25 * 60, 'default work is 25 min');
  assert.strictEqual(t.durationForMode('break'), 5 * 60, 'default break is 5 min');
  assert.strictEqual(t.durationForMode('longBreak'), 15 * 60, 'default longBreak is 15 min');
});

console.log(`\nPomodoro self-test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
