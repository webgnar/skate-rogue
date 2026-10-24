import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// The animation editor (?editor) saves its clips here through the dev server (npm run dev). A save doesn't
// hot-reload the editor itself; open game tabs reload to pick the clips up.
const CLIP_EDITS = fileURLToPath(new URL('./src/render/clip-edits.json', import.meta.url));

function clipEditor(): Plugin {
  return {
    name: 'clip-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__clip-edits', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const ok =
              data && typeof data === 'object' && !Array.isArray(data) &&
              Object.values(data).every((c) => Array.isArray((c as { keys?: unknown }).keys));
            if (!ok) throw new Error('not a set of clips');
            writeFileSync(CLIP_EDITS, body.endsWith('\n') ? body : `${body}\n`);
            res.end('saved');
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
    },
    handleHotUpdate(ctx) {
      if (ctx.file !== CLIP_EDITS) return;
      ctx.server.ws.send({ type: 'custom', event: 'clip-edits' });
      return [];
    },
  };
}

// The level editor (?levels) saves its edits here the same way; game tabs reload to skate them.
const LEVEL_EDITS = fileURLToPath(new URL('./src/gen/level-edits.json', import.meta.url));

function levelEditor(): Plugin {
  return {
    name: 'level-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__level-edits', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const ok = data && typeof data === 'object' && data.floors && typeof data.floors === 'object' && !Array.isArray(data.floors);
            if (!ok) throw new Error('not a set of level edits');
            writeFileSync(LEVEL_EDITS, body.endsWith('\n') ? body : `${body}\n`);
            res.end('saved');
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
    },
    handleHotUpdate(ctx) {
      if (ctx.file !== LEVEL_EDITS) return;
      ctx.server.ws.send({ type: 'custom', event: 'level-edits' });
      return [];
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [clipEditor(), levelEditor()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'] },
});
