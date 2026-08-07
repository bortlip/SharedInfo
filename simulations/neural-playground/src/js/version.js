// Single source of truth for the visible Neural Playground release version.
'use strict';

const APP_VERSION = '0.1.0';
for (const element of document.querySelectorAll('[data-app-version]')) {
  element.textContent = `v${APP_VERSION}`;
}
