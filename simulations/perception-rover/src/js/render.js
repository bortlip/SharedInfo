// Top-down world, simulated camera, and camera-to-model input rendering.
'use strict';

function drawWorld() {
  wg.clearRect(0, 0, W, H);
  const grad = wg.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#10251e');
  grad.addColorStop(1, '#0d1c18');
  wg.fillStyle = grad;
  wg.fillRect(0, 0, W, H);

  wg.strokeStyle = 'rgba(255,255,255,.03)';
  for (let y = 35; y < H; y += 48) {
    wg.beginPath();
    wg.moveTo(0, y);
    wg.lineTo(W, y);
    wg.stroke();
  }

  wg.beginPath();
  for (let x = 0; x <= W; x += 5) {
    const y = roadCenter(x) - ROAD_HALF;
    if (x === 0) wg.moveTo(x, y); else wg.lineTo(x, y);
  }
  for (let x = W; x >= 0; x -= 5) wg.lineTo(x, roadCenter(x) + ROAD_HALF);
  wg.closePath();
  const roadGradient = wg.createLinearGradient(0, 0, 0, H);
  roadGradient.addColorStop(0, '#3b4750');
  roadGradient.addColorStop(1, '#252f38');
  wg.fillStyle = roadGradient;
  wg.fill();

  for (const sign of [-1, 1]) {
    wg.beginPath();
    for (let x = 0; x <= W; x += 5) {
      const y = roadCenter(x) + sign * ROAD_HALF;
      if (x === 0) wg.moveTo(x, y); else wg.lineTo(x, y);
    }
    wg.strokeStyle = 'rgba(242,247,250,.65)';
    wg.lineWidth = 2;
    wg.stroke();
  }

  wg.setLineDash([18, 18]);
  wg.strokeStyle = 'rgba(255,220,120,.48)';
  wg.lineWidth = 2;
  wg.beginPath();
  for (let x = 0; x <= W; x += 5) {
    const y = roadCenter(x);
    if (x === 0) wg.moveTo(x, y); else wg.lineTo(x, y);
  }
  wg.stroke();
  wg.setLineDash([]);

  const centerY = roadCenter(sim.x);
  wg.strokeStyle = 'rgba(255,255,255,.28)';
  wg.setLineDash([4, 4]);
  wg.beginPath();
  wg.moveTo(sim.x, centerY);
  wg.lineTo(sim.x, sim.y);
  wg.stroke();
  wg.setLineDash([]);

  const targetX = wrap(sim.x + 80);
  wg.fillStyle = 'rgba(255,209,102,.25)';
  wg.beginPath();
  wg.arc(targetX, roadCenter(targetX), 7, 0, TAU);
  wg.fill();

  wg.save();
  wg.translate(sim.x, sim.y);
  wg.rotate(sim.heading);
  wg.shadowColor = sim.autopilot ? 'rgba(132,242,183,.5)' : 'rgba(73,215,230,.5)';
  wg.shadowBlur = 18;
  wg.fillStyle = sim.autopilot ? '#84f2b7' : '#49d7e6';
  wg.strokeStyle = 'rgba(255,255,255,.9)';
  wg.lineWidth = 2;
  wg.beginPath();
  wg.roundRect(-18, -11, 36, 22, 7);
  wg.fill();
  wg.stroke();
  wg.fillStyle = '#071018';
  wg.fillRect(6, -6, 8, 12);
  wg.restore();
}

function cameraRows() {
  const rows = [];
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const look = 30 + (1 - t) * 285;
    const worldX = wrap(sim.x + Math.cos(sim.heading) * look);
    const expectedY = sim.y + Math.tan(sim.heading) * look;
    const centerOffset = roadCenter(worldX) - expectedY;
    const perspective = .38 + t * 1.30;
    rows.push({ y: 34 + t * 206, cx: 160 + centerOffset * perspective * .72, half: 20 + t * 128 });
  }
  return rows;
}

function drawCamera() {
  cg.clearRect(0, 0, 320, 240);
  const sky = cg.createLinearGradient(0, 0, 0, 112);
  sky.addColorStop(0, '#598aa4');
  sky.addColorStop(1, '#aec9d1');
  cg.fillStyle = sky;
  cg.fillRect(0, 0, 320, 116);

  const ground = cg.createLinearGradient(0, 95, 0, 240);
  ground.addColorStop(0, '#7a8958');
  ground.addColorStop(1, '#454d2d');
  cg.fillStyle = ground;
  cg.fillRect(0, 96, 320, 144);

  const rows = cameraRows();
  cg.beginPath();
  rows.forEach((r, i) => {
    const x = r.cx - r.half;
    if (i === 0) cg.moveTo(x, r.y); else cg.lineTo(x, r.y);
  });
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    cg.lineTo(r.cx + r.half, r.y);
  }
  cg.closePath();
  const roadGradient = cg.createLinearGradient(0, 35, 0, 240);
  roadGradient.addColorStop(0, '#606a70');
  roadGradient.addColorStop(1, '#2d3439');
  cg.fillStyle = roadGradient;
  cg.fill();

  for (const side of [-1, 1]) {
    cg.beginPath();
    rows.forEach((r, i) => {
      const x = r.cx + side * r.half;
      if (i === 0) cg.moveTo(x, r.y); else cg.lineTo(x, r.y);
    });
    cg.strokeStyle = 'rgba(255,255,255,.82)';
    cg.lineWidth = 2;
    cg.stroke();
  }

  cg.beginPath();
  rows.forEach((r, i) => {
    if (i === 0) cg.moveTo(r.cx, r.y); else cg.lineTo(r.cx, r.y);
  });
  cg.strokeStyle = 'rgba(255,221,120,.78)';
  cg.lineWidth = 2;
  cg.setLineDash([7, 8]);
  cg.stroke();
  cg.setLineDash([]);

  cg.fillStyle = '#101920';
  cg.beginPath();
  cg.moveTo(105, 240);
  cg.lineTo(126, 211);
  cg.lineTo(194, 211);
  cg.lineTo(215, 240);
  cg.closePath();
  cg.fill();
  cg.strokeStyle = 'rgba(73,215,230,.6)';
  cg.stroke();

  if (sim.autopilot && sim.model) {
    const best = argmax(sim.probs);
    cg.fillStyle = 'rgba(5,12,18,.72)';
    cg.fillRect(8, 8, 126, 28);
    cg.fillStyle = '#fff';
    cg.font = '800 12px system-ui';
    cg.fillText(`AI: ${LABELS[best]}`, 17, 26);
  }
}

function captureInput() {
  tg.drawImage(camera, 0, 0, CAMERA_W, CAMERA_H);
  const data = tg.getImageData(0, 0, CAMERA_W, CAMERA_H).data;
  const input = new Float32Array(INPUTS);
  for (let i = 0; i < INPUTS; i++) {
    const j = i * 4;
    const gray = (data[j] * .299 + data[j + 1] * .587 + data[j + 2] * .114) / 255;
    input[i] = gray * 2 - 1;
  }
  return input;
}
