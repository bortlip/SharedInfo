// Single source of truth for the visible Pocket Prix release version.
'use strict';

const APP_VERSION = "1.0.0";
for (const element of document.querySelectorAll("[data-app-version]")) {
  element.textContent = `v${APP_VERSION}`;
}
