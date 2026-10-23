# Gnar Run

A mobile-first 3D roguelike skate game in JavaScript: the Lou Gnar runner remade with Quest For Stoken's skate
physics and Survivor mode at its core. See the [game design document](docs/GDD.md).

## Running it

```sh
npm install
npm run dev      # http://localhost:5173, also on your network for phone testing
npm test         # physics, generator and bot tests
npm run build    # static build in dist/
```

Add `?seed=1234` to the URL to replay a seed. Planning lives in `openspec/` (see `openspec/changes/`).

Art credits: the Chicago tileset, sky and skyline come from Quest For Stoken (webgnar/QFSHIVE); the skater sprites
come from Lou Gnar (webgnar/excaliburSkate).
