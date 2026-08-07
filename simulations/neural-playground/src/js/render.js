// Canvas rendering for the decision field, network signal flow, and learning history.
'use strict';

const PLOT = { left: 48, top: 26, right: FIELD_W - 24, bottom: FIELD_H - 44 };
const CLASS_A_RGB = [56, 205, 222];
const CLASS_B_RGB = [255, 116, 128];
const BG_RGB = [12, 19, 27];

function worldToCanvas(x, y) {
  return {
    x: lerp(PLOT.left, PLOT.right, (x + 1.05) / 2.1),
    y: lerp(PLOT.bottom, PLOT.top, (y + 1.05) / 2.1)
  };
}

function canvasToWorld(x, y) {
  return {
    x: clamp(((x - PLOT.left) / (PLOT.right - PLOT.left)) * 2.1 - 1.05, -1, 1),
    y: clamp(1.05 - ((y - PLOT.top) / (PLOT.bottom - PLOT.top)) * 2.1, -1, 1)
  };
}

function decisionColor(probability) {
  const certainty = Math.abs(probability - 0.5) * 2;
  const classColor = probability < 0.5 ? CLASS_A_RGB : CLASS_B_RGB;
  const t = 0.13 + certainty * 0.50;
  const mixed = mixRgb(BG_RGB, classColor, t);
  return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
}

function drawDecisionField() {
  const g = fieldCtx;
  g.clearRect(0, 0, FIELD_W, FIELD_H);
  g.fillStyle = '#091018';
  g.fillRect(0, 0, FIELD_W, FIELD_H);

  if (sim.model) {
    for (let py = PLOT.top; py < PLOT.bottom; py += FIELD_CELL) {
      for (let px = PLOT.left; px < PLOT.right; px += FIELD_CELL) {
        const w = canvasToWorld(px + FIELD_CELL * 0.5, py + FIELD_CELL * 0.5);
        const p = predictDetailed(sim.model, w.x, w.y).output;
        g.fillStyle = decisionColor(p);
        g.fillRect(px, py, FIELD_CELL + 1, FIELD_CELL + 1);
      }
    }
  }

  drawGrid(g);
  if (sim.model?.type === 'perceptron') drawPerceptronBoundary(g);
  else drawNetworkBoundary(g);
  drawTrainingPoints(g);
  drawFieldLabels(g);
}

function drawGrid(g) {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,.075)';
  g.lineWidth = 1;
  for (let v = -1; v <= 1.001; v += 0.25) {
    const px = worldToCanvas(v, 0).x;
    const py = worldToCanvas(0, v).y;
    g.beginPath(); g.moveTo(px, PLOT.top); g.lineTo(px, PLOT.bottom); g.stroke();
    g.beginPath(); g.moveTo(PLOT.left, py); g.lineTo(PLOT.right, py); g.stroke();
  }
  const zero = worldToCanvas(0, 0);
  g.strokeStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.moveTo(zero.x, PLOT.top); g.lineTo(zero.x, PLOT.bottom); g.stroke();
  g.beginPath(); g.moveTo(PLOT.left, zero.y); g.lineTo(PLOT.right, zero.y); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.16)';
  g.strokeRect(PLOT.left + .5, PLOT.top + .5, PLOT.right - PLOT.left - 1, PLOT.bottom - PLOT.top - 1);
  g.restore();
}

function drawPerceptronBoundary(g) {
  const { w, b } = sim.model;
  const candidates = [];
  if (Math.abs(w[1]) > 1e-8) {
    for (const x of [-1.05, 1.05]) {
      const y = -(w[0] * x + b) / w[1];
      if (y >= -1.05 && y <= 1.05) candidates.push(worldToCanvas(x, y));
    }
  }
  if (Math.abs(w[0]) > 1e-8) {
    for (const y of [-1.05, 1.05]) {
      const x = -(w[1] * y + b) / w[0];
      if (x >= -1.05 && x <= 1.05) candidates.push(worldToCanvas(x, y));
    }
  }
  if (candidates.length < 2) return;
  g.save();
  g.strokeStyle = 'rgba(255,255,255,.95)';
  g.lineWidth = 3;
  g.shadowColor = 'rgba(255,255,255,.35)';
  g.shadowBlur = 12;
  g.beginPath();
  g.moveTo(candidates[0].x, candidates[0].y);
  g.lineTo(candidates[1].x, candidates[1].y);
  g.stroke();
  g.restore();
}

function drawNetworkBoundary(g) {
  const step = 10;
  g.save();
  g.strokeStyle = 'rgba(255,255,255,.88)';
  g.lineWidth = 2.1;
  g.shadowColor = 'rgba(255,255,255,.22)';
  g.shadowBlur = 8;
  for (let py = PLOT.top; py < PLOT.bottom - step; py += step) {
    for (let px = PLOT.left; px < PLOT.right - step; px += step) {
      const samples = [
        [px, py], [px + step, py], [px + step, py + step], [px, py + step]
      ].map(([cx, cy]) => {
        const w = canvasToWorld(cx, cy);
        return predictDetailed(sim.model, w.x, w.y).output >= 0.5 ? 1 : 0;
      });
      const count = samples[0] + samples[1] + samples[2] + samples[3];
      if (count === 0 || count === 4) continue;
      const edges = [];
      if (samples[0] !== samples[1]) edges.push([px + step * .5, py]);
      if (samples[1] !== samples[2]) edges.push([px + step, py + step * .5]);
      if (samples[2] !== samples[3]) edges.push([px + step * .5, py + step]);
      if (samples[3] !== samples[0]) edges.push([px, py + step * .5]);
      if (edges.length >= 2) {
        g.beginPath(); g.moveTo(edges[0][0], edges[0][1]); g.lineTo(edges[1][0], edges[1][1]); g.stroke();
        if (edges.length === 4) {
          g.beginPath(); g.moveTo(edges[2][0], edges[2][1]); g.lineTo(edges[3][0], edges[3][1]); g.stroke();
        }
      }
    }
  }
  g.restore();
}

function drawTrainingPoints(g) {
  for (const point of sim.points) {
    const p = worldToCanvas(point.x, point.y);
    const active = point.id === sim.activePointId;
    const selected = point.id === sim.selectedPointId;
    const hovered = point.id === sim.hoveredPointId;
    const prediction = sim.model ? predictDetailed(sim.model, point.x, point.y).output >= .5 ? CLASS_B : CLASS_A : point.label;
    const wrong = prediction !== point.label;
    const radius = active ? 9.5 : 8;

    if (active) {
      const pulse = 14 + Math.sin(sim.flowPhase * Math.PI * 2) * 4;
      g.strokeStyle = 'rgba(255,255,255,.30)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, pulse, 0, Math.PI * 2); g.stroke();
    }

    g.save();
    g.shadowColor = point.label === CLASS_A ? 'rgba(56,205,222,.48)' : 'rgba(255,116,128,.48)';
    g.shadowBlur = active || selected || hovered ? 16 : 8;
    g.fillStyle = point.label === CLASS_A ? '#38cdde' : '#ff7480';
    g.strokeStyle = selected || hovered ? '#ffffff' : 'rgba(5,10,15,.88)';
    g.lineWidth = selected || hovered ? 3 : 2;
    if (point.label === CLASS_A) {
      g.beginPath(); g.arc(p.x, p.y, radius, 0, Math.PI * 2); g.fill(); g.stroke();
    } else {
      g.beginPath();
      g.moveTo(p.x, p.y - radius - 1); g.lineTo(p.x + radius + 1, p.y);
      g.lineTo(p.x, p.y + radius + 1); g.lineTo(p.x - radius - 1, p.y); g.closePath();
      g.fill(); g.stroke();
    }
    g.restore();

    if (wrong) {
      g.strokeStyle = '#ffd166';
      g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, radius + 5, -.8, 1.35); g.stroke();
    }
  }
}

function drawFieldLabels(g) {
  g.save();
  g.fillStyle = 'rgba(230,238,244,.70)';
  g.font = '12px ui-monospace, SFMono-Regular, Consolas, monospace';
  g.fillText('x₁', PLOT.right - 14, worldToCanvas(0, 0).y - 9);
  g.fillText('x₂', worldToCanvas(0, 0).x + 8, PLOT.top + 14);
  g.fillStyle = 'rgba(230,238,244,.52)';
  g.fillText('← class A', PLOT.left + 10, PLOT.bottom + 27);
  g.textAlign = 'right';
  g.fillText('class B →', PLOT.right - 8, PLOT.bottom + 27);
  g.restore();
}

function nodePositions(count, x, top = 74, bottom = NETWORK_H - 55) {
  if (count === 1) return [{ x, y: (top + bottom) / 2 }];
  return Array.from({ length: count }, (_, i) => ({ x, y: lerp(top, bottom, i / (count - 1)) }));
}

function hiddenNodeRadius(count) {
  if (count <= 4) return 28;
  if (count <= 6) return 22;
  return 17;
}

function drawConnection(g, a, b, weight, activeAmount = 0, pulseT = null) {
  const positive = weight >= 0;
  const magnitude = clamp(Math.abs(weight), 0, 2.4);
  g.save();
  g.strokeStyle = positive ? `rgba(82,225,191,${0.30 + magnitude * .25})` : `rgba(255,112,139,${0.30 + magnitude * .25})`;
  g.lineWidth = 1.8 + magnitude * 2.5;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  if (pulseT !== null && activeAmount > .03) {
    const t = clamp(pulseT, 0, 1);
    const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t);
    g.globalAlpha = clamp(.45 + activeAmount * .55, .45, 1);
    g.fillStyle = positive ? '#b8ffea' : '#ffc0cb';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 22;
    g.beginPath(); g.arc(x, y, 5 + activeAmount * 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawNode(g, p, label, value, kind = 'hidden', radius = 32) {
  const v = clamp(Number.isFinite(value) ? value : 0, -1, 1);
  const abs = Math.abs(v);
  const fill = kind === 'output'
    ? (value >= .5 ? `rgba(255,116,128,${.40 + value * .50})` : `rgba(56,205,222,${.40 + (1 - value) * .50})`)
    : (v >= 0 ? `rgba(82,225,191,${.30 + abs * .58})` : `rgba(255,112,139,${.30 + abs * .58})`);
  const halo = kind === 'output'
    ? (value >= .5 ? 'rgba(255,116,128,.34)' : 'rgba(56,205,222,.34)')
    : (v >= 0 ? 'rgba(82,225,191,.30)' : 'rgba(255,112,139,.30)');
  const labelSize = radius >= 28 ? 15 : radius >= 23 ? 13 : 11;
  const valueSize = radius >= 28 ? 13 : radius >= 23 ? 11 : 9;

  g.save();
  g.strokeStyle = halo;
  g.lineWidth = 7;
  g.beginPath(); g.arc(p.x, p.y, radius + 4, 0, Math.PI * 2); g.stroke();

  g.fillStyle = fill;
  g.strokeStyle = 'rgba(255,255,255,.92)';
  g.lineWidth = 2.5;
  g.shadowColor = 'rgba(255,255,255,.30)';
  g.shadowBlur = 20;
  g.beginPath(); g.arc(p.x, p.y, radius, 0, Math.PI * 2); g.fill(); g.stroke();

  g.shadowBlur = 6;
  g.shadowColor = 'rgba(0,0,0,.8)';
  g.fillStyle = '#ffffff';
  g.font = `900 ${labelSize}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, p.x, p.y - radius * .20);
  g.fillStyle = 'rgba(255,255,255,.94)';
  g.font = `800 ${valueSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  g.fillText(Number.isFinite(value) ? fmt(value, 2) : '—', p.x, p.y + radius * .28);
  g.restore();
}

function drawNetwork() {
  const g = networkCtx;
  g.clearRect(0, 0, NETWORK_W, NETWORK_H);
  const gradient = g.createLinearGradient(0, 0, NETWORK_W, NETWORK_H);
  gradient.addColorStop(0, '#0b1724');
  gradient.addColorStop(1, '#111827');
  g.fillStyle = gradient;
  g.fillRect(0, 0, NETWORK_W, NETWORK_H);

  const signal = sim.currentSignal || (() => {
    const point = sim.points[0];
    return point && sim.model ? { point, detail: predictDetailed(sim.model, point.x, point.y) } : null;
  })();
  const detail = signal?.detail;
  const inputPos = nodePositions(2, 86, 130, 290);
  const outputPos = nodePositions(1, NETWORK_W - 82, 118, 302)[0];

  g.fillStyle = 'rgba(235,242,248,.78)';
  g.font = '900 14px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('INPUTS', inputPos[0].x, 42);
  g.fillText('OUTPUT', outputPos.x, 42);

  if (sim.model?.type === 'perceptron') {
    const weights = sim.model.w;
    const phase = sim.flowPhase;
    for (let i = 0; i < 2; i++) {
      drawConnection(g, inputPos[i], outputPos, weights[i], Math.abs(detail?.inputs?.[i] || 0), phase);
    }
    drawNode(g, inputPos[0], 'x₁', detail?.inputs?.[0], 'input', 34);
    drawNode(g, inputPos[1], 'x₂', detail?.inputs?.[1], 'input', 34);
    drawNode(g, outputPos, 'ŷ', detail?.output, 'output', 36);
    drawBias(g, NETWORK_W * .51, 326, sim.model.b, 'bias');
    drawEquationHint(g, `score = ${fmt(weights[0],2)}x₁ ${weights[1] >= 0 ? '+' : '−'} ${fmt(Math.abs(weights[1]),2)}x₂ ${sim.model.b >= 0 ? '+' : '−'} ${fmt(Math.abs(sim.model.b),2)}`);
  } else if (sim.model) {
    const hiddenRadius = hiddenNodeRadius(sim.model.hiddenUnits);
    const hiddenPos = nodePositions(sim.model.hiddenUnits, NETWORK_W * .51, 82, 304);
    g.fillText('HIDDEN LAYER', NETWORK_W * .51, 42);
    const phase1 = clamp(sim.flowPhase * 2, 0, 1);
    const phase2 = clamp((sim.flowPhase - .5) * 2, 0, 1);
    for (let h = 0; h < sim.model.hiddenUnits; h++) {
      for (let i = 0; i < 2; i++) {
        const pulse = sim.flowPhase < .5 ? phase1 : null;
        drawConnection(g, inputPos[i], hiddenPos[h], sim.model.w1[h][i], Math.abs(detail?.inputs?.[i] || 0), pulse);
      }
      const pulse = sim.flowPhase >= .5 ? phase2 : null;
      drawConnection(g, hiddenPos[h], outputPos, sim.model.w2[h], Math.abs(detail?.hidden?.[h] || 0), pulse);
    }
    drawNode(g, inputPos[0], 'x₁', detail?.inputs?.[0], 'input', 32);
    drawNode(g, inputPos[1], 'x₂', detail?.inputs?.[1], 'input', 32);
    hiddenPos.forEach((p, i) => drawNode(g, p, `h${i + 1}`, detail?.hidden?.[i], 'hidden', hiddenRadius));
    drawNode(g, outputPos, 'ŷ', detail?.output, 'output', 34);
    drawBias(g, NETWORK_W * .68, 336, sim.model.b2, 'output bias');
    drawEquationHint(g, `${sim.model.hiddenUnits} tanh units combine into one sigmoid output`);
  }

  if (signal?.point) {
    const label = signal.point.label === CLASS_A ? 'A' : 'B';
    g.fillStyle = 'rgba(255,255,255,.84)';
    g.textAlign = 'left';
    g.font = '800 13px ui-monospace, SFMono-Regular, Consolas, monospace';
    g.fillText(`sample ${label}  (${fmt(signal.point.x,2)}, ${fmt(signal.point.y,2)})`, 18, NETWORK_H - 15);
  }
}

function drawBias(g, x, y, value, label) {
  g.save();
  g.fillStyle = 'rgba(255,209,102,.22)';
  g.strokeStyle = 'rgba(255,209,102,.78)';
  g.lineWidth = 2;
  g.setLineDash([5, 4]);
  g.shadowColor = 'rgba(255,209,102,.22)';
  g.shadowBlur = 12;
  g.beginPath(); g.arc(x, y, 21, 0, Math.PI * 2); g.fill(); g.stroke();
  g.setLineDash([]);
  g.shadowBlur = 0;
  g.fillStyle = '#ffe39a'; g.textAlign = 'center'; g.font = '900 12px system-ui, sans-serif';
  g.fillText('b', x, y + 4);
  g.fillStyle = 'rgba(255,232,174,.90)'; g.textAlign = 'left'; g.font = '800 11px ui-monospace, monospace';
  g.fillText(`${label} ${fmt(value,2)}`, x + 29, y + 4);
  g.restore();
}

function drawEquationHint(g, text) {
  g.save();
  g.fillStyle = 'rgba(255,255,255,.075)';
  g.strokeStyle = 'rgba(255,255,255,.15)';
  g.beginPath(); g.roundRect(96, NETWORK_H - 66, NETWORK_W - 192, 34, 10); g.fill(); g.stroke();
  g.fillStyle = 'rgba(245,249,252,.86)';
  g.font = '800 12px ui-monospace, SFMono-Regular, Consolas, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, NETWORK_W / 2, NETWORK_H - 49);
  g.restore();
}

function drawHistory() {
  const g = historyCtx;
  g.clearRect(0, 0, HISTORY_W, HISTORY_H);
  g.fillStyle = '#0b131c'; g.fillRect(0, 0, HISTORY_W, HISTORY_H);
  const left = 42, right = HISTORY_W - 18, top = 18, bottom = HISTORY_H - 28;
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = lerp(top, bottom, i / 4);
    g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke();
  }
  if (sim.history.length < 2) {
    g.fillStyle = 'rgba(235,242,247,.48)'; g.font = '12px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Train for a few epochs and the learning trace will appear here.', HISTORY_W / 2, HISTORY_H / 2);
    return;
  }
  const maxLoss = Math.max(1, ...sim.history.map(h => h.loss));
  const xAt = i => lerp(left, right, i / Math.max(1, sim.history.length - 1));
  g.save();
  g.strokeStyle = '#ffd166'; g.lineWidth = 2.4; g.beginPath();
  sim.history.forEach((h, i) => {
    const y = lerp(bottom, top, clamp(h.loss / maxLoss, 0, 1));
    if (!i) g.moveTo(xAt(i), y); else g.lineTo(xAt(i), y);
  }); g.stroke();
  g.strokeStyle = '#8cffbf'; g.lineWidth = 2.4; g.beginPath();
  sim.history.forEach((h, i) => {
    const y = lerp(bottom, top, h.accuracy);
    if (!i) g.moveTo(xAt(i), y); else g.lineTo(xAt(i), y);
  }); g.stroke();
  g.restore();
  g.fillStyle = '#8cffbf'; g.font = '800 10px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('accuracy', left + 6, top + 11);
  g.fillStyle = '#ffd166'; g.fillText('loss', left + 67, top + 11);
  g.fillStyle = 'rgba(235,242,247,.5)'; g.textAlign = 'right'; g.fillText(`epoch ${sim.epoch}`, right, bottom + 19);
}

function renderAll() {
  drawDecisionField();
  drawNetwork();
  drawHistory();
}
