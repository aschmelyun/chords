// ── Grid config ──
const COLS = 32, ROWS = 32;
const CANVAS_SIZE = 480;
const CELL = CANVAS_SIZE / COLS; // 15px
const grid = new Array(COLS * ROWS).fill(0); // 0 = empty

// ── Colors & Chords ──
const PALETTE = [
  { color: '#FF0000', name: 'Cmaj',  notes: [261.63, 329.63, 392.00] },
  { color: '#FF8800', name: 'Dm',    notes: [293.66, 349.23, 440.00] },
  { color: '#FFD700', name: 'Em',    notes: [329.63, 392.00, 493.88] },
  { color: '#00CC44', name: 'Fmaj',  notes: [349.23, 440.00, 523.25] },
  { color: '#00DDFF', name: 'Gmaj',  notes: [392.00, 493.88, 587.33] },
  { color: '#0088FF', name: 'Am',    notes: [440.00, 523.25, 659.25] },
  { color: '#0000FF', name: 'Bdim',  notes: [493.88, 587.33, 739.99] },
  { color: '#9900CC', name: 'C5',    notes: [523.25, 659.25, 783.99] },
  { color: '#FF00CC', name: 'Dm5',   notes: [587.33, 698.46, 880.00] },
];

// ── Build toolbar ──
const toolbar = document.getElementById('toolbar');
const toolName = document.getElementById('toolName');
let activeColor = 1; // 1-indexed into PALETTE, 0 = eraser

function updateToolName(name) {
  toolName.textContent = name;
}

PALETTE.forEach((p, i) => {
  const sw = document.createElement('div');
  sw.className = 'color-swatch' + (i === 0 ? ' active' : '');
  sw.style.background = p.color;
  const lbl = document.createElement('span');
  lbl.className = 'chord-label';
  lbl.textContent = p.name;
  sw.appendChild(lbl);
  sw.onclick = () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    activeColor = i + 1;
    updateToolName(p.name);
  };
  toolbar.appendChild(sw);
});

// Add eraser
const eraser = document.createElement('div');
eraser.className = 'color-swatch eraser';
eraser.title = 'Eraser';
eraser.onclick = () => {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  eraser.classList.add('active');
  activeColor = 0;
  updateToolName('Eraser');
};
toolbar.appendChild(eraser);

// ── Canvas drawing ──
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

function drawGrid() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Grid lines
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, CANVAS_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(CANVAS_SIZE, y * CELL);
    ctx.stroke();
  }

  // Filled cells
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > 0) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      ctx.fillStyle = PALETTE[grid[i] - 1].color;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }

  // Ball
  if (playing) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }
}

// ── Mouse and Touch painting ──
let painting = false;
let lastPaintX = null;
let lastPaintY = null;

function startPaint(e) {
  painting = true;
  const coords = getGridCoords(e);
  if (coords) {
    lastPaintX = coords.x;
    lastPaintY = coords.y;
    paintCell(coords.x, coords.y);
  }
}

function continuePaint(e) {
  if (painting) {
    const coords = getGridCoords(e);
    if (coords) {
      // Interpolate between last position and current position
      if (lastPaintX !== null && lastPaintY !== null) {
        interpolatePaint(lastPaintX, lastPaintY, coords.x, coords.y);
      }
      lastPaintX = coords.x;
      lastPaintY = coords.y;
    }
  }
}

function endPaint() {
  painting = false;
  lastPaintX = null;
  lastPaintY = null;
}

// Mouse events
canvas.addEventListener('mousedown', startPaint);
canvas.addEventListener('mousemove', continuePaint);
canvas.addEventListener('mouseup', endPaint);
canvas.addEventListener('mouseleave', endPaint);

// Touch events
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  startPaint(touch);
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  continuePaint(touch);
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  endPaint();
});
canvas.addEventListener('touchcancel', (e) => {
  e.preventDefault();
  endPaint();
});

function getGridCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = CANVAS_SIZE / rect.width;
  const sy = CANVAS_SIZE / rect.height;
  const x = Math.floor((e.clientX - rect.left) * sx / CELL);
  const y = Math.floor((e.clientY - rect.top) * sy / CELL);
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
  return { x, y };
}

function paintCell(x, y) {
  grid[y * COLS + x] = activeColor;
  drawGrid();
}

function interpolatePaint(x0, y0, x1, y1) {
  // Bresenham's line algorithm to fill in cells between two points
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    paintCell(x0, y0);
    
    if (x0 === x1 && y0 === y1) break;
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// ── Audio ──
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

const activeChords = new Map(); // colorIndex -> { timeout }

function playChord(colorIndex) {
  ensureAudio();
  const p = PALETTE[colorIndex];
  if (!p) return;

  // Debounce: don't replay same chord if it's still ringing
  if (activeChords.has(colorIndex)) {
    clearTimeout(activeChords.get(colorIndex).timeout);
  }

  const now = audioCtx.currentTime;
  const duration = 0.6;

  p.notes.forEach((freq, ni) => {
    // Main oscillator
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = ni === 0 ? 'triangle' : 'sine';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
  });

  activeChords.set(colorIndex, {
    timeout: setTimeout(() => activeChords.delete(colorIndex), duration * 1000)
  });
}

// ── Ball physics ──
let playing = false;
const ball = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2, r: 7, vx: 3.5, vy: 2.8 };
let animId = null;
const hitCooldown = new Set();

function resetBall() {
  ball.x = CANVAS_SIZE / 2;
  ball.y = CANVAS_SIZE / 2;
  const angle = Math.random() * Math.PI * 2;
  const speed = 4;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  // Ensure it's not too horizontal/vertical
  if (Math.abs(ball.vx) < 1.5) ball.vx = 2.5 * Math.sign(ball.vx || 1);
  if (Math.abs(ball.vy) < 1.5) ball.vy = 2.5 * Math.sign(ball.vy || 1);
}

function tick() {
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce
  if (ball.x - ball.r <= 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
  if (ball.x + ball.r >= CANVAS_SIZE) { ball.x = CANVAS_SIZE - ball.r; ball.vx = -Math.abs(ball.vx); }
  if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
  if (ball.y + ball.r >= CANVAS_SIZE) { ball.y = CANVAS_SIZE - ball.r; ball.vy = -Math.abs(ball.vy); }

  // Check cell collision at ball edges (4 cardinal points)
  const checks = [
    [ball.x, ball.y - ball.r],  // top
    [ball.x, ball.y + ball.r],  // bottom
    [ball.x - ball.r, ball.y],  // left
    [ball.x + ball.r, ball.y],  // right
  ];

  for (const [cx, cy] of checks) {
    const col = Math.floor(cx / CELL);
    const row = Math.floor(cy / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    const idx = row * COLS + col;
    const colorIdx = grid[idx];
    if (colorIdx > 0) {
      const key = idx;
      if (!hitCooldown.has(key)) {
        playChord(colorIdx - 1);
        hitCooldown.add(key);
        setTimeout(() => hitCooldown.delete(key), 200);

        // Bounce: determine which side we hit
        const cellCx = (col + 0.5) * CELL;
        const cellCy = (row + 0.5) * CELL;
        const dx = ball.x - cellCx;
        const dy = ball.y - cellCy;

        if (Math.abs(dx) > Math.abs(dy)) {
          ball.vx = -ball.vx;
        } else {
          ball.vy = -ball.vy;
        }
      }
    }
  }

  drawGrid();
  animId = requestAnimationFrame(tick);
}

// ── Controls ──
// Auto-start on load
window.addEventListener('load', () => {
  ensureAudio();
  playing = true;
  resetBall();
  tick();
});

// Spacebar to toggle play/pause
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    ensureAudio();
    if (!playing) {
      playing = true;
      resetBall();
      tick();
    } else {
      playing = false;
      cancelAnimationFrame(animId);
      drawGrid();
    }
  }
});

// Initial draw
drawGrid();
