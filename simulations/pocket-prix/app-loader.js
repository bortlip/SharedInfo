(() => {
  'use strict';

  const sourceParts = [
    'src/app-source-01.txt',
    'src/app-source-02.txt',
    'src/app-source-03.txt',
    'src/app-source-04.txt',
    'src/app-source-05.txt',
    'src/app-source-06.txt',
    'src/app-source-07.txt',
    'src/app-source-08.txt',
    'src/app-source-09.txt'
  ];

  Promise.all(sourceParts.map(async (path) => {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
    return response.text();
  }))
    .then((parts) => {
      const blob = new Blob([parts.join('')], { type: 'text/javascript' });
      const script = document.createElement('script');
      script.src = URL.createObjectURL(blob);
      script.onload = () => URL.revokeObjectURL(script.src);
      document.body.appendChild(script);
    })
    .catch((error) => {
      console.error('Pocket Prix failed to load.', error);
      const notice = document.createElement('div');
      notice.style.cssText = 'position:fixed;inset:16px;z-index:9999;display:grid;place-items:center;background:#07100d;color:#f4f7f5;font:16px/1.5 system-ui;text-align:center;padding:24px';
      notice.innerHTML = '<div><h1>Pocket Prix could not start</h1><p>The simulator source files failed to load. Refresh the page or open it through GitHub Pages rather than directly from the filesystem.</p></div>';
      document.body.appendChild(notice);
    });
})();
