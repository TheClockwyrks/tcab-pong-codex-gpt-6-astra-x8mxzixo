import type { InitApi } from "@clockwyrks/simple-2d";
import type { CaromState, CaromDebugApi } from "./game";
import * as C from "./constants";
import { initial } from "./world";
import { createDebug } from "./debug";
export function initialize(
  api: InitApi<CaromState>,
): [CaromState, CaromDebugApi] {
  for (const name of C.ACTIONS)
    api.input.register(name, { keys: [...C.BINDINGS[name]] });
  api.audio.define(C.CUES.paddleHit, {
    wave: "triangle",
    freq: 640,
    freqTo: 310,
    durationMs: 75,
    gain: 0.22,
  });
  api.audio.define(C.CUES.wallBounce, {
    freq: 230,
    freqTo: 170,
    durationMs: 45,
    gain: 0.12,
  });
  api.audio.define(C.CUES.obstacleBounce, {
    wave: "triangle",
    freq: 940,
    freqTo: 490,
    durationMs: 100,
    gain: 0.17,
  });
  api.audio.define(C.CUES.score, {
    freq: 330,
    freqTo: 880,
    durationMs: 260,
    gain: 0.2,
  });
  api.diagnostics.register("screen", (s) => s.screen);
  api.diagnostics.register("mode", (s) => s.mode);
  api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
  for (const key of ["x", "y", "vx", "vy", "spin"] as const)
    api.diagnostics.register(`ball.${key}`, (s) => s.ball?.[key] ?? "absent");
  api.diagnostics.register("ball.speed", (s) =>
    s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "absent",
  );
  for (const side of ["left", "right"] as const)
    for (const key of ["cy", "vy"] as const)
      api.diagnostics.register(`${side}.${key}`, (s) => s.paddles[side][key]);
  return [initial(), createDebug()];
}
