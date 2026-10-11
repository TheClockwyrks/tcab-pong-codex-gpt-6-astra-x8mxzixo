import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, State, Side, PaddleState } from "./game";
import * as C from "./constants";
import { clamp, obstacle, park } from "./world";
import { readInput } from "./menus";
import { fly } from "./physics";
function move(s: State, side: Side, api: UpdateApi, dt: number): PaddleState {
  const p = s.paddles[side];
  let vy = 0;
  if (p.driven) vy = p.drivenVy;
  else if (side === "right" && s.mode === "solo") {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - p.cy;
    if (s.ai.movement && Math.abs(diff) > deadzone && dt > 0)
      vy = Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  } else {
    const prefix = side === "left" ? "p1" : "p2";
    const up =
      api.input.value(`${prefix}-up`) > 0 ||
      (s.mode === "solo" && api.input.value("p2-up") > 0);
    const down =
      api.input.value(`${prefix}-down`) > 0 ||
      (s.mode === "solo" && api.input.value("p2-down") > 0);
    vy = (Number(down) - Number(up)) * C.PADDLE_SPEED;
  }
  const intended = p.cy + vy * dt,
    cy = clamp(intended, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (cy !== intended && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}
export function update(state: State, api: UpdateApi, dt: number): CaromState {
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt };
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  const cues = new Set<C.CueName>();
  s = {
    ...s,
    paddles: {
      left: move(s, "left", api, dt),
      right: move(s, "right", api, dt),
    },
  };
  if (s.screen === "countdown" && s.ball) {
    const holdTimer = Math.max(0, s.ball.holdTimer - dt);
    s = { ...s, ball: { ...s.ball, holdTimer } };
    if (holdTimer <= 0)
      s = {
        ...s,
        screen: "playing",
        ball: {
          ...s.ball!,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: s.ball!.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        },
      };
  } else if (s.screen === "playing") {
    s = { ...s, ball: fly(s, dt, cues) };
    if (
      s.ball &&
      (s.ball.x - C.BALL_R > C.FIELD_W || s.ball.x + C.BALL_R < 0)
    ) {
      const left = s.ball.x > C.FIELD_W,
        score = {
          p1: s.score.p1 + Number(left),
          p2: s.score.p2 + Number(!left),
        };
      cues.add(C.CUES.score);
      s = { ...s, score };
      if (
        Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
        Math.abs(score.p1 - score.p2) >= C.WIN_LEAD
      )
        s = {
          ...s,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
        };
      else
        s = {
          ...s,
          ball: park(),
          receiver: left ? "right" : "left",
          screen: "countdown",
        };
    }
  }
  const obstacleClock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
  };
  if (s.ball)
    s = {
      ...s,
      ball: {
        ...s.ball,
        trail: [
          ...s.ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
          { x: s.ball.x, y: s.ball.y, t: s.simTime },
        ],
      },
    };
  for (const cue of cues) api.audio.play(cue);
  return s;
}
