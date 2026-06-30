const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'build', 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Find the CSS stylesheet link (e.g. <link href="/Taskboard/static/css/main.bd38dbeb.css" rel="stylesheet">)
  const cssRegex = /<link href="([^"]+\.css)" rel="stylesheet">/g;

  if (cssRegex.test(html)) {
    // Reset regex index
    cssRegex.lastIndex = 0;
    html = html.replace(cssRegex, (match, href) => {
      console.log(`Optimizing CSS link for: ${href}`);
      return `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
    });

    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('CSS optimization complete! CSS is now deferred/non-blocking.');
  } else {
    console.log('No CSS stylesheet link found to optimize.');
  }
} else {
  console.error('build/index.html not found!');
}
