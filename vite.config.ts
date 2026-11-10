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

// The CrazyGames build (npm run build:crazygames, docs/CRAZYGAMES.md): the same game into dist-crazygames/, without the
// home screen app tags (the portal frames the game and runs its own full screen). .env.crazygames sets VITE_PORTAL.
// The iOS app build (npm run build:ios, docs/APP_STORE.md) drops the same tags into dist-ios/: it is an app already.
function portalPage(): Plugin {
  return {
    name: 'portal-page',
    apply: 'build',
    transformIndexHtml: (html) =>
      html
        .replace(/\s*<!--[^>]*Home Screen[^>]*-->/, '')
        .replace(/\s*<meta name="(apple-mobile-web-app-[a-z-]+|mobile-web-app-capable)"[^>]*>/g, '')
        .replace(/\s*<link rel="(manifest|apple-touch-icon)"[^>]*>/g, ''),
  };
}

// The set editor (?sets) saves its hand-made sets here the same way; game tabs reload to skate them.
const HAND_SETS = fileURLToPath(new URL('./src/gen/hand-sets.json', import.meta.url));

function setEditor(): Plugin {
  return {
    name: 'set-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__hand-sets', (req, res) => {
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
            const ok = data && typeof data === 'object' && Array.isArray(data.sets) && data.sets.every((s: { name?: unknown; parts?: unknown }) => typeof s?.name === 'string' && Array.isArray(s.parts));
            if (!ok) throw new Error('not a set of hand-made sets');
            writeFileSync(HAND_SETS, body.endsWith('\n') ? body : `${body}\n`);
            res.end('saved');
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
    },
    handleHotUpdate(ctx) {
      if (ctx.file !== HAND_SETS) return;
      ctx.server.ws.send({ type: 'custom', event: 'hand-sets' });
      return [];
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [clipEditor(), levelEditor(), setEditor(), ...(mode === 'crazygames' || mode === 'ios' ? [portalPage()] : [])],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    ...(mode === 'crazygames' ? { outDir: 'dist-crazygames' } : mode === 'ios' ? { outDir: 'dist-ios' } : {}),
  },
  test: { include: ['tests/**/*.test.ts'] },
}));
