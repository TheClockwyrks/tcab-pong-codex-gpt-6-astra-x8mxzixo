import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type State } from "./game";
import * as C from "./constants";
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((f) => f()));
async function harness(ms = 8) {
  const events = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  cleanup.push(() => engine.destroy());
  const key = (code: string, down = true) =>
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const point = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event("pointer" + type), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const d = engine.debug;
  function flight(x = 640, y = 360, vx = 520, vy = 0) {
    engine.apply((s) => ({
      ...d.clearWorld(s),
      screen: "playing",
      mode: "versus",
      ball: { ...d.spawnBall(s).ball!, x, y, vx, vy, held: false },
    }));
  }
  return { engine, d, key, tap, point, flight };
}
describe("engine contract and menus", () => {
  it("initializes all state, bindings, diagnostics and immutable snapshots", async () => {
    const { engine, d } = await harness();
    expect(engine.state.screen).toBe("title");
    expect(d.version).toBe(C.CAROM_DEBUG_VERSION);
    expect(engine.state.obstacles).toHaveLength(2);
    const before = structuredClone(engine.state);
    await engine.advance(2);
    expect(engine.state.simTime).toBe(0.016);
    expect(before.simTime).toBe(0);
    expect(engine.diagnostics().every((d) => d.error === undefined)).toBe(true);
    expect(d.snapshot(engine.state).ball?.speed).toBe(0);
  });
  it("wraps, remembers title selection, shows instructions and starts versus", async () => {
    const { engine, tap } = await harness();
    await tap("ArrowUp");
    expect(engine.state.menuIndex).toBe(2);
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.menuIndex).toBe(2);
    await tap("ArrowUp");
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.titleIndex).toBe(1);
  });
  it("prioritizes up over down and movement over confirmation", async () => {
    const { engine, key } = await harness();
    key("KeyW");
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(2);
    expect(engine.state.screen).toBe("title");
  });
  it("pauses exactly once on Escape and freezes the entire world", async () => {
    const { engine, tap } = await harness();
    await tap("Enter");
    await tap("Escape");
    const before = structuredClone(engine.state);
    await engine.advance(5);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.ball).toEqual(before.ball);
    expect(engine.state.paddles).toEqual(before.paddles);
    expect(engine.state.obstacleClock).toBe(before.obstacleClock);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
  });
  it("restarts and quits through pause menu", async () => {
    const { engine, tap, d } = await harness();
    await tap("Enter");
    engine.apply((s) => d.setScore(s, 5, 6));
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
  });
  it.each(["mouse", "touch"])(
    "confirms %s only with matching press/release regions",
    async (device) => {
      const { engine, d, point } = await harness();
      const a = d.menuItemRect(engine.state, 0)!,
        b = d.menuItemRect(engine.state, 1)!;
      point("down", a.x + 20, a.y + 20, 1, device);
      await engine.advance(1);
      point("up", b.x + 20, b.y + 20, 1, device);
      await engine.advance(1);
      expect(engine.state.screen).toBe("title");
      point("down", b.x + 20, b.y + 20, 1, device);
      await engine.advance(1);
      point("up", b.x + 20, b.y + 20, 1, device);
      await engine.advance(1);
      expect(engine.state.mode).toBe("versus");
      expect(engine.state.screen).toBe("countdown");
    },
  );
  it("accepts same-frame clicks and gives keyboard confirm priority", async () => {
    const { engine, d, point, key } = await harness();
    const b = d.menuItemRect(engine.state, 1)!;
    key("Enter");
    point("down", b.x + 10, b.y + 10);
    point("up", b.x + 10, b.y + 10);
    await engine.advance(1);
    expect(engine.state.mode).toBe("solo");
  });
  it("mutes from any screen and debug mute reaches cue bus", async () => {
    const { engine, d, tap, flight } = await harness();
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    engine.apply((s) => d.setMuted(s, false));
    await engine.advance(1);
    expect(engine.state.muted).toBe(false);
    flight(-30, 300, -100, 0);
    engine.apply((s) => d.setMuted(s, true));
    const gains: number[] = [];
    engine.events.on("cue:played", (e) => gains.push(e.gain));
    await engine.advance(1);
    expect(gains).toEqual([0]);
  });
});
describe("simulation", () => {
  it("serves on expiry without advancing and preserves posed sign", async () => {
    const { engine, d } = await harness(10);
    engine.apply((s) =>
      d.setBallServeSign(
        d.setBallHoldTimer(d.setScreen(s, "countdown"), 0.01),
        -1,
      ),
    );
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vy).toBeCloseTo(
      -C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
    );
    expect(engine.state.ball?.held).toBe(false);
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("moves both human controls in solo and separates versus controls", async () => {
    const { engine, tap, key, d } = await harness(10);
    await tap("Enter");
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(C.FIELD_CY + 7.2);
    engine.apply((s) => d.setMode(s, "versus"));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.right.vy).toBe(C.PADDLE_SPEED);
  });
  it("integrates driven paddles and reports actual clamped velocity", async () => {
    const { engine, d, flight } = await harness(10);
    flight();
    engine.apply((s) =>
      d.setPaddleDriven(
        d.setPaddleVy(
          d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2),
          "left",
          C.PADDLE_SPEED,
        ),
        "left",
        true,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBeCloseTo(200);
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
  });
  it.each([
    ["left", 76, -520, 1],
    ["right", 1204, 520, -1],
  ] as const)(
    "bounces off %s with speed gain and spin",
    async (side, x, vx, sign) => {
      const { engine, d, flight } = await harness(8);
      flight(x, 360, vx, 0);
      engine.apply((s) =>
        d.setPaddleDriven(d.setPaddleVy(s, side, 100), side, true),
      );
      const cues: string[] = [];
      engine.events.on("cue:played", (e) => cues.push(e.cue));
      await engine.advance(1);
      expect(Math.sign(engine.state.ball!.vx)).toBe(sign);
      expect(
        Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
      ).toBeCloseTo(C.SERVE_SPEED * C.SPEED_MULT);
      expect(engine.state.ball!.spin).toBeGreaterThan(80);
      expect(cues).toEqual([C.CUES.paddleHit]);
    },
  );
  it("resolves end caps without speed gain", async () => {
    const { engine, flight } = await harness();
    flight(56, 293, 0, 520);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-520);
    expect(engine.state.ball!.spin).toBe(0);
  });
  it.each([
    [-500, 12],
    [500, 708],
  ])("reflects wall velocity %s", async (vy, y) => {
    const { engine, flight } = await harness();
    flight(600, y, 0, vy);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-vy);
  });
  it.each([0, 0.5, 1.5])(
    "reflects oriented obstacles at clock %s",
    async (t) => {
      const { engine, d, flight } = await harness();
      flight();
      engine.apply((s) =>
        d.setObstacleClockRunning(
          d.spawnObstacle(d.setObstacleClock(s, t), 0),
          false,
        ),
      );
      const o = engine.state.obstacles[0],
        nx = Math.cos(o.theta),
        ny = Math.sin(o.theta);
      engine.apply((s) =>
        d.setBallVelocity(
          d.setBallPosition(s, o.cx - 22 * nx, o.cy - 22 * ny),
          520 * nx,
          520 * ny,
        ),
      );
      await engine.advance(1);
      expect(
        engine.state.ball!.vx * nx + engine.state.ball!.vy * ny,
      ).toBeLessThan(0);
      expect(d.snapshot(engine.state).ball!.speed).toBeCloseTo(520);
    },
  );
  it("advances obstacle poses only during play and can freeze its clock", async () => {
    const { engine, d, tap } = await harness();
    await tap("Enter");
    await engine.advance(4);
    const t = engine.state.obstacleClock;
    expect(engine.state.obstacles[0].cy).toBeCloseTo(
      C.OBSTACLE_CENTERS[0].y +
        C.OBSTACLE_SWAY_AMP *
          Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    );
    engine.apply((s) => d.setObstacleClockRunning(s, false));
    await engine.advance(2);
    expect(engine.state.obstacleClock).toBe(t);
  });
  it("decays spin, preserves speed and retains only recent trail", async () => {
    const { engine, d, flight } = await harness(16);
    flight(600, 360, 100, 0);
    engine.apply((s) => d.setBallSpin(s, 100));
    await engine.advance(50);
    expect(engine.state.ball!.spin).toBeCloseTo(50);
    expect(d.snapshot(engine.state).ball!.speed).toBeCloseTo(100);
    expect(
      engine.state.ball!.trail.every(
        (p) => engine.state.simTime - p.t <= C.TRAIL_TIME,
      ),
    ).toBe(true);
  });
  it.each([2, 8, 16])("agrees over one second at %s ms", async (ms) => {
    const { engine, d, flight } = await harness(ms);
    flight(500, 360, 150, 0);
    engine.apply((s) => d.setBallSpin(s, 50));
    await engine.advance((1000 / ms) | 0);
    expect(d.snapshot(engine.state).ball!.speed).toBeCloseTo(150);
    expect(engine.state.ball!.vx).toBeGreaterThan(145);
    expect(engine.state.ball!.vy).toBeGreaterThan(30);
  });
  it("gates AI tracking and movement independently", async () => {
    const { engine, d, flight } = await harness(10);
    flight(900, 150, 520, 0);
    engine.apply((s) => d.setMode(s, "solo"));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    engine.apply((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    engine.apply((s) =>
      d.setAiTracking(
        d.setAiMovement(d.setPaddleCy(s, "right", 200), true),
        false,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
  });
  it("scores, serves toward the conceding side, and requires a two-point lead", async () => {
    const { engine, d, flight, tap } = await harness();
    flight(C.FIELD_W + 20, 300, 520, 0);
    engine.apply((s) => d.setScore(s, 10, 10));
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 11, p2: 10 });
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    engine.apply((s) =>
      d.setBallHeld(
        d.setBallVelocity(
          d.setBallPosition(d.setScreen(s, "playing"), C.FIELD_W + 20, 300),
          520,
          0,
        ),
        false,
      ),
    );
    await engine.advance(1);
    expect(engine.state.winner).toBe("left");
    expect(engine.state.screen).toBe("matchover");
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
  });
  it("awards the right side and leaves the winning ball in place", async () => {
    const { engine, d, flight, tap } = await harness();
    flight(-20, 300, -520, 0);
    engine.apply((s) => d.setScore(s, 0, 10));
    await engine.advance(1);
    expect(engine.state.winner).toBe("right");
    expect(engine.state.ball!.x).toBeLessThan(-20);
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
  });
});
describe("debug surface", () => {
  it("poses independent fields and resets without retaining hidden simulation state", async () => {
    const { engine, d } = await harness();
    let s: State = engine.state;
    s = d.setTitleIndex(s, 2);
    s = d.setMenuIndex(s, 1);
    s = d.setResumeScreen(s, "countdown");
    s = d.setReceiver(s, "right");
    s = d.setWinner(s, "right");
    s = d.setBallHeld(s, false);
    s = d.setBallSpin(s, 42);
    s = d.setBallVelocity(s, 3, 4);
    s = d.setPaddleVy(s, "left", 19);
    s = d.setMuted(s, true);
    s = d.setAiTracking(s, false);
    s = d.setAiMovement(s, false);
    s = d.setObstacleClock(s, 0.9);
    expect(d.snapshot(s).ball!.speed).toBe(5);
    expect(s.paddles.left.vy).toBe(0);
    expect(d.reconcile(d.reconcile(s))).toEqual(d.reconcile(s));
    const reset = d.reset(s);
    expect(reset.muted).toBe(true);
    expect(reset.ai).toEqual({ tracking: true, movement: true });
    expect(reset.simTime).toBe(0);
    expect(reset.obstacleClock).toBe(0);
    expect(reset.titleIndex).toBe(0);
  });
  it("handles an empty world and rejects absent entities", async () => {
    const { engine, d } = await harness();
    engine.apply((s) => d.setScreen(d.clearWorld(s), "playing"));
    await engine.advance(1);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    expect(() => d.setBallPosition(engine.state, 1, 2)).toThrow();
    expect(() => d.spawnObstacle(engine.state, 2)).toThrow();
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
    expect(d.menuItemRect(d.setScreen(engine.state, "title"), 9)).toBeNull();
  });
  it("draws both serve signs over repeated parkings and resets trail", async () => {
    const { engine, d } = await harness();
    const signs = new Set<number>();
    for (let i = 0; i < 100; i++)
      signs.add(d.drawBallServeSign(engine.state).ball!.serveSign);
    expect(signs.size).toBe(2);
    expect(d.spawnBall(engine.state).ball!.trail).toEqual([]);
  });
});
