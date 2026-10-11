# Carom

A browser paddle duel about angles, spin, and moving obstacles. Slide into a shot
to curve the ball, bank it off the rotating amber bars, and defend your goal.
Play Solo against the AI or Versus with a friend on the same keyboard. First to
11 wins, with a two-point lead.

## Run

Install with `npm ci`, then start development with `npm run dev`. Open the local
URL printed by Vite. The game runs entirely in the browser, with procedural
canvas graphics and synthesized sound; it needs no backend or external assets.

`npm run build` produces the complete static site in `dist/`. Serve that directory
at the root of any static host, or use `npm run preview` to inspect it locally.

## Controls

| Action | Keyboard |
| --- | --- |
| Solo paddle | W / S or Up / Down arrows |
| Versus player one | W / S |
| Versus player two | Up / Down arrows |
| Menu selection | W / S or Up / Down arrows |
| Confirm | Enter or Space |
| Pause / resume | P or Escape |
| Back | Escape |
| Mute | M |
| Diagnostics | Backtick |

Menus also accept mouse clicks and touch. On touch devices, the engine provides
vertical paddle sliders and menu controls. The in-game field guide explains spin
and bank shots.

## Development

The Simple 2D engine owns input, audio, rendering fit, and frame timing. Game
transitions live in `src/simulation.ts`, collisions in `src/physics.ts`, and
presentation in `src/render.ts`. `src/game.ts` exports the state contract and game;
the returned debug API supports isolated poses and snapshots through the engine.

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` for the
repository checks. Tests use real engine instances, native canvases, and counted
clock ticks, including collisions, menus, AI, scoring, and pause behavior.

The `showcase/` directory contains the player description, carousel, screenshots,
and a recording made with the engine's draw-command recorder.
