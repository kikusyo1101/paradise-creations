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

// ---------------------------------------------------------------------------
// NEW FEATURES (skip / setConfig / PRESETS / stats / autoStart flags)
// Real API (confirmed by reading pomodoro.js):
//   timer.skip()                     -> applies transition() immediately
//   timer.setConfig(partial)         -> live config change; reflects current
//                                       mode's duration into remaining
//   timer.getStats()                 -> { completedToday, focusSeconds }
//   getState() also carries completedToday & focusSeconds
//   createTimer.PRESETS = { quick, classic, deepWork } (durations in SECONDS)
//   config flags: autoStartBreaks, autoStartPomodoros (default TRUE)
// ---------------------------------------------------------------------------
console.log('\nPomodoro new features:');

// (a) skip() during work ends the session immediately: work -> break,
//     completed+1, remaining == breakDuration, WITHOUT ticking to zero.
test('skip() during work: immediate work->break, completed increments', () => {
  const t = createTimer(CFG);
  t.start();
  const s = t.skip();
  assert.strictEqual(s.mode, 'break', 'work skips straight to break');
  assert.strictEqual(s.completed, 1, 'skipped work session counts as completed');
  assert.strictEqual(s.remaining, CFG.breakDuration, 'remaining == breakDuration');
});

// (b) skip() during a break returns to work.
test('skip() during break returns to work', () => {
  const t = createTimer(CFG);
  t.start();
  t.skip(); // work -> break
  assert.strictEqual(t.getState().mode, 'break', 'precondition: in break');
  const s = t.skip(); // break -> work
  assert.strictEqual(s.mode, 'work', 'break skips back to work');
  assert.strictEqual(s.remaining, CFG.workDuration, 'remaining == workDuration');
});

// (c) setConfig({workDuration:N}) changes work duration; reset()/next work
//     session uses the new value.
test('setConfig({workDuration}) changes work duration for reset/new sessions', () => {
  const t = createTimer(CFG);
  t.setConfig({ workDuration: 9 });
  // Reflected immediately for the current (work) mode.
  assert.strictEqual(t.getState().remaining, 9, 'current work remaining reflects new duration');
  t.start();
  t.tick(); // 9 -> 8
  t.reset();
  assert.strictEqual(t.getState().remaining, 9, 'reset uses new workDuration');
  // A fresh work session reached via skip cycle also uses the new duration.
  t.start();
  t.skip(); // work -> break
  const s = t.skip(); // break -> work
  assert.strictEqual(s.mode, 'work', 'back to work');
  assert.strictEqual(s.remaining, 9, 'new work session uses new workDuration');
});

// (d) PRESETS exist on the factory with the expected durations (SECONDS).
test('createTimer.PRESETS: Classic 25/5/15, Quick 15/3/10, Deep Work 50/10/30', () => {
  const P = createTimer.PRESETS;
  assert.ok(P, 'PRESETS is exposed on the factory');
  assert.deepStrictEqual(
    [P.classic.workDuration, P.classic.breakDuration, P.classic.longBreakDuration],
    [25 * 60, 5 * 60, 15 * 60], 'Classic = 25/5/15 minutes');
  assert.deepStrictEqual(
    [P.quick.workDuration, P.quick.breakDuration, P.quick.longBreakDuration],
    [15 * 60, 3 * 60, 10 * 60], 'Quick = 15/3/10 minutes');
  assert.deepStrictEqual(
    [P.deepWork.workDuration, P.deepWork.breakDuration, P.deepWork.longBreakDuration],
    [50 * 60, 10 * 60, 30 * 60], 'Deep Work = 50/10/30 minutes');
  // A preset object is usable as a config.
  const t = createTimer(P.quick);
  assert.strictEqual(t.getState().remaining, 15 * 60, 'preset drives initial remaining');
});

// (e) autoStartBreaks flag governs running across the work->break boundary.
test('autoStartBreaks:true keeps running and enters break at work zero', () => {
  const t = createTimer({ ...CFG, autoStartBreaks: true });
  t.start();
  const s = ticks(t, CFG.workDuration); // drive work to zero
  assert.strictEqual(s.mode, 'break', 'auto-continued into break');
  assert.strictEqual(s.running, true, 'still running (auto-started break)');
});

test('autoStartBreaks:false halts (running=false) at work->break transition', () => {
  const t = createTimer({ ...CFG, autoStartBreaks: false });
  t.start();
  const s = ticks(t, CFG.workDuration); // drive work to zero
  assert.strictEqual(s.mode, 'break', 'transitioned to break');
  assert.strictEqual(s.running, false, 'running=false; user must start the break');
});

// (f) focusSeconds accumulates on WORK ticks only, not on break ticks.
test('stats.focusSeconds accrues on work ticks but not break ticks', () => {
  const t = createTimer({ ...CFG, autoStartBreaks: true });
  t.start();
  t.tick(); // work tick -> focus +1
  assert.strictEqual(t.getStats().focusSeconds, 1, 'one work tick = 1 focus second');
  // Finish the work session (1 more tick reaches zero -> break).
  t.tick(); // work -> break, focus +1 (this tick was still work)
  assert.strictEqual(t.getState().mode, 'break', 'now in break');
  const focusBeforeBreak = t.getStats().focusSeconds;
  assert.strictEqual(focusBeforeBreak, 2, 'two work ticks = 2 focus seconds');
  t.tick(); // break tick -> focus must NOT change
  assert.strictEqual(t.getStats().focusSeconds, focusBeforeBreak, 'break ticks add no focus time');
});

// (g) completedToday increments once per completed work session.
test('stats.completedToday increments per completed work session', () => {
  const t = createTimer(CFG);
  t.start();
  assert.strictEqual(t.getStats().completedToday, 0, 'starts at 0');
  ticks(t, CFG.workDuration); // work#1 -> break
  assert.strictEqual(t.getStats().completedToday, 1, 'after 1 work session');
  ticks(t, CFG.breakDuration); // break -> work
  ticks(t, CFG.workDuration); // work#2 -> break
  assert.strictEqual(t.getStats().completedToday, 2, 'after 2 work sessions');
  // skip() of a work session also counts.
  ticks(t, CFG.breakDuration); // back to work
  t.skip(); // skip work#3
  assert.strictEqual(t.getStats().completedToday, 3, 'skipped work session also counts');
});

console.log(`\nPomodoro self-test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
