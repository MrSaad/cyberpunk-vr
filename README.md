# Cyberpunk VR

A neon-drenched, mostly procedurally generated cyberpunk city you can explore in VR (Meta Quest 3) or on desktop. You start in a penthouse high above the city, step out onto your private skytrain platform, and ride a looping maglev line between six explorable stops.

Built with [Three.js](https://threejs.org/) and WebXR. It's a static site, so it can be hosted on GitHub Pages.

## The loop line

| # | Stop | What's there |
|---|------|--------------|
| 1 | **HOME** | Your penthouse with floor-to-ceiling windows facing downtown. Its door opens onto a private platform. |
| 2 | **SKYDECK** | Open-air observation deck with a neon garden, a holo sculpture, telescopes and a bar. It's the highest point on the line. |
| 3 | **SKYPORT** | Landing deck where flying cars arrive, set down, and take off again. |
| 4 | **KUROGANE TOWER** | Megacorp lobby with a giant rotating hologram, red light grid and security guards. |
| 5 | **NIGHT MARKET** | Stairs down from the platform into a street canyon with food stalls, lanterns, blade signs and crowds. |
| 6 | **KAFE 22** | Cosy neon coffee bar halfway up a tower, glass on three sides. |

Four trains run the loop on a fixed timetable. Each one dwells about 22 s per stop, so the next train is never far away. Platform boards show the countdown, and the screens inside the train show the next stop.

## Controls

**Quest 3 (VRChat style)**
- Left stick: smooth movement in the direction you're looking
- Right stick: smooth turn
- Left stick click: toggle sprint
- **B**: toggle snap turn (30°)

**Desktop**
- Click to capture the mouse, then move the mouse to look
- `W A S D` to move, `Shift` to sprint, `Q`/`E` to turn
- `1`–`6` to jump to a station

URL options for testing: `?station=market` (start at a stop), `?t=120` (start the clock later), `?norain`.

## Run locally

```bash
npm install
npm run dev        # serves on your LAN (vite --host)
```

WebXR needs HTTPS (or localhost). To try a dev build on the Quest, either:
- deploy to GitHub Pages (below), or
- connect the headset over USB, run `adb reverse tcp:5173 tcp:5173`, and open `http://localhost:5173` in the Quest Browser.

## Deploy to GitHub Pages

A workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site will then be at `https://<user>.github.io/cyberpunk-vr/`.

## How it's built

- **City** (`src/city.js`): a seeded generator, so the city is the same on every visit. Street grid, lots, tiered towers and cylinders, skybridges, rooftop clutter, neon trims, aviation lights, and thousands of signs and ad screens. All buildings share **one instanced draw call**. Windows, neon bands, LED stripes and shopfronts are painted procedurally in the shader and fade to an average colour at distance to avoid shimmer in VR.
- **Glow without post-processing**: bloom is too expensive on Quest, so every light gets a camera-facing additive halo instead (`src/halos.js`).
- **Baked lighting**: station interiors and trains are merged into one vertex-coloured mesh per station. Coloured light spill is baked into the vertex colours at load time (`src/builder.js`), so there are no runtime lights at all.
- **GPU animation**: flying cars (`src/traffic.js`), crowds (`src/people.js`, limbs swung in the vertex shader), rain (`src/rain.js`, hidden inside "shelter" volumes such as rooms and train cars) and holograms all move without per-frame CPU work.
- **Riding the train**: walkable areas are rectangles in the local space of a station or a train car (`src/nav.js`). When you step into a car, your player rig is re-parented to it, so you can walk around while it moves.
- **Route and timetable** (`src/route.js`): a closed spline through six level, straight station sections, with trapezoidal speed profiles between stops.
- **Sky** (`src/sky.js`): light-polluted gradient, drifting cloud deck, moon, a low smog layer, and a distant skyline band so the city never visibly ends. Extras (`src/extras.js`): giant holographic koi, searchlights, ad blimps, and holo crowns on the tallest towers.

Text on signs uses fonts already on the device (CJK glyphs render on the Quest Browser). No external assets are required apart from the controller models, which three.js loads from its CDN.
