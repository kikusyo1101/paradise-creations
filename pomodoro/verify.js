const createTimer = require('./pomodoro.js');

// Use tiny durations so we can fast-forward: work=3s, break=2s, longBreak=4s, interval=4
function drive(label, t) {
  const transitions = [];
  let prevMode = t.getState().mode;
  t.start();
  for (let i = 0; i < 3 * 60; i++) { // plenty of ticks
    const s = t.tick();
    if (s.mode !== prevMode) {
      transitions.push(`${prevMode} -> ${s.mode} @remaining=${s.remaining} completed=${s.completed} cyclePos=${s.cyclePosition}`);
      prevMode = s.mode;
    }
    if (transitions.length >= 10) break;
  }
  console.log(`\n[${label}]`);
  transitions.forEach(x => console.log('  ' + x));
  return transitions;
}

// Test 1: default-duration semantics but fast via config
const t = createTimer({ workDuration: 3, breakDuration: 2, longBreakDuration: 4, longBreakInterval: 4 });
console.log('Initial:', JSON.stringify(t.getState()));
drive('cycles', t);

// Test 2: real defaults, single work session fast-forward (1500 ticks) -> break, completed++
const t2 = createTimer();
console.log('\nDefaults initial:', JSON.stringify(t2.getState()), '=> 25:00?', t2.getState().remaining === 1500);
t2.start();
for (let i = 0; i < 1500; i++) t2.tick();
const s2 = t2.getState();
console.log('After 1500 work ticks:', JSON.stringify(s2));
console.log('AC-2 work->break:', s2.mode === 'break', '| remaining=300:', s2.remaining === 300, '| completed=1:', s2.completed === 1);

// Test 3: pause preserves remaining
const t3 = createTimer();
t3.start(); t3.tick(); t3.tick(); // 1498
const r = t3.getState().remaining;
t3.pause(); t3.tick(); t3.tick(); // no change
console.log('\nPause preserves:', t3.getState().remaining === r, `(remaining=${t3.getState().remaining})`);

// Test 4: reset
t3.start(); t3.tick(); t3.reset();
const s4 = t3.getState();
console.log('Reset ok:', s4.mode==='work' && s4.remaining===1500 && s4.completed===0 && s4.cyclePosition===0 && s4.running===false, JSON.stringify(s4));
