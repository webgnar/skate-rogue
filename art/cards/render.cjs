// Saves the card art: start `npm run dev`, then `node art/cards/render.cjs [http://localhost:5173]`.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const url = (process.argv[2] || 'http://localhost:5173') + '/art/cards/index.html';
  const out = path.join(__dirname, '..', '..', 'public', 'sprites', 'cards');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log(m.text()));
  await p.goto(url);
  const shots = await p.evaluate(() => window.cardArt);
  for (const [name, data] of Object.entries(shots)) {
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(name);
  }
  await b.close();
})();
