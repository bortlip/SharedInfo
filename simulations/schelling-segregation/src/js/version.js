// Single source of truth for the visible Schelling Segregation Lab release version.
'use strict';

const APP_VERSION = '1.1.1';
for (const element of document.querySelectorAll('[data-app-version]')) element.textContent = `v${APP_VERSION}`;
