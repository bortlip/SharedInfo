'use strict';
window.RL_RACING_LAB_VERSION = '0.2.0';
document.querySelectorAll('[data-app-version]').forEach(node => {
  node.textContent = `v${window.RL_RACING_LAB_VERSION}`;
});
