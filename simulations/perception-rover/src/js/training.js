// Training loop and validation reporting.
'use strict';

async function trainModel() {
  if (sim.training || sim.dataset.length < 60) return;

  const counts = [0, 0, 0];
  sim.dataset.forEach(sample => counts[sample.y]++);
  if (Math.min(...counts) < 8) {
    $('status').innerHTML = '<span class="warn">Dataset needs at least 8 examples of LEFT, STRAIGHT, and RIGHT. Collect more balanced driving data.</span>';
    return;
  }

  sim.training = true;
  sim.autopilot = false;
  $('autoBtn').classList.remove('autopilot');
  $('autoBtn').textContent = 'Enable autopilot';
  $('trainBtn').disabled = true;
  $('recordBtn').disabled = true;
  $('expertBtn').disabled = true;
  $('clearBtn').disabled = true;

  sim.model = initModel();
  const { train, validation } = stratifiedSplit([...sim.dataset]);
  const epochs = 28;
  $('status').textContent = `Training on ${train.length} frames; holding out ${validation.length} unseen frames for validation…`;

  for (let epoch = 0; epoch < epochs; epoch++) {
    shuffle(train);
    const learningRate = .009 * (1 - epoch / epochs * .60);
    for (const sample of train) trainStep(sim.model, sample, learningRate);

    sim.trainAcc = accuracy(sim.model, train);
    sim.valAcc = accuracy(sim.model, validation);
    $('trainProgress').style.width = `${(epoch + 1) / epochs * 100}%`;
    $('stageTrain').textContent = `epoch ${epoch + 1}/${epochs}`;
    $('trainAcc').textContent = `${Math.round(sim.trainAcc * 100)}%`;
    $('valAcc').textContent = `${Math.round(sim.valAcc * 100)}%`;
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  sim.training = false;
  $('trainBtn').disabled = false;
  $('recordBtn').disabled = false;
  $('expertBtn').disabled = false;
  $('clearBtn').disabled = false;
  $('autoBtn').disabled = false;
  $('sTrain').classList.add('done');
  $('stageTrain').textContent = `${Math.round(sim.valAcc * 100)}% validation`;
  $('status').innerHTML = `Training complete. <b>${Math.round(sim.trainAcc * 100)}%</b> training accuracy, <b>${Math.round(sim.valAcc * 100)}%</b> validation accuracy. Reset the rover, then deploy.`;
  updateUI();
}
