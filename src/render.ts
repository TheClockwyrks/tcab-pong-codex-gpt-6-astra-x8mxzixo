import type { RenderApi } from "@clockwyrks/simple-2d";
import type { State } from "./game";
import { BACKGROUND } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./menus";
const INK = "#e8f2ec",
  MUTED = "#829b9e",
  MINT = "#a6f5d0",
  CORAL = "#ff8877",
  AMBER = "#eec16b";
function text(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = INK,
  align: CanvasTextAlign = "left",
  weight = 400,
) {
  ctx.font = `${weight} ${size}px ${weight >= 700 ? "Arial, sans-serif" : "monospace"}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color = "#294045",
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 7,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function field(ctx: CanvasRenderingContext2D, s: State) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  for (let x = 24; x < C.FIELD_W; x += 32)
    for (let y = 24; y < C.FIELD_H; y += 32) dot(ctx, x, y, 0.65, "#1b2b30");
  line(ctx, 24, 1, C.FIELD_W - 24, 1, "#466265");
  line(ctx, 24, C.FIELD_H - 1, C.FIELD_W - 24, C.FIELD_H - 1, "#466265");
  ctx.setLineDash([5, 13]);
  line(ctx, C.NET_X, 25, C.NET_X, C.FIELD_H - 25, "#2b4145");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#263c40";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 83, 0, Math.PI * 2);
  ctx.stroke();
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 16;
    bar(ctx, -C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, AMBER);
    ctx.shadowBlur = 0;
    line(ctx, 0, -44, 0, 44, "#94713d");
    dot(ctx, 0, 0, 3, "#fff0c9");
    ctx.restore();
  }
  for (const side of ["left", "right"] as const) {
    const color = side === "left" ? MINT : CORAL;
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    bar(
      ctx,
      side === "left" ? C.P1_X0 : C.P2_X0,
      s.paddles[side].cy - C.PADDLE_HALF,
      C.PADDLE_W,
      C.PADDLE_H,
      color,
    );
    ctx.shadowBlur = 0;
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      ctx.globalAlpha = (0.45 * i) / b.trail.length;
      ctx.strokeStyle = INK;
      ctx.lineWidth = (2 * C.BALL_R * i) / b.trail.length;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 20;
    ctx.shadowColor = INK;
    dot(ctx, b.x, b.y, C.BALL_R, INK);
    ctx.shadowBlur = 0;
  }
}
function menu(ctx: CanvasRenderingContext2D, s: State) {
  items(s).forEach((label, i) => {
    const r = menuItemRect(s, i)!;
    const selected = i === s.menuIndex;
    bar(ctx, r.x, r.y, r.w, r.h, selected ? MINT : "#15252a", 5);
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + 36,
      13,
      selected ? "#375e50" : MUTED,
    );
    text(
      ctx,
      label,
      r.x + 62,
      r.y + 37,
      18,
      selected ? BACKGROUND : INK,
      "left",
      700,
    );
    if (selected)
      text(ctx, "↗", r.x + r.w - 29, r.y + 38, 23, BACKGROUND, "center");
  });
}
function titleScreen(ctx: CanvasRenderingContext2D, s: State) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  for (let x = 640; x < C.FIELD_W; x += 32)
    for (let y = 72; y < 650; y += 32) dot(ctx, x, y, 0.8, "#26393d");
  text(ctx, "C /", 64, 58, 24, MINT, "left", 700);
  text(ctx, "THE ANGLE IS EVERYTHING", 112, 54, 12, MUTED);
  text(ctx, "LOCAL ARCADE   /   001", 1216, 54, 12, MUTED, "right");
  line(ctx, 64, 79, 1216, 79);
  text(ctx, "A PADDLE DUEL WITH A TWIST", 104, 171, 13, MINT);
  text(ctx, C.TITLE_TEXT, 96, 280, 116, INK, "left", 900);
  text(ctx, "Find your angle. Bend the rally.", 104, 319, 17, MUTED);
  menu(ctx, s);
  text(ctx, "W / S  or  ↑ / ↓   SELECT", 104, 614, 12, MUTED);
  text(ctx, "ENTER   PLAY", 104, 636, 12, MUTED);
  // A diagrammatic court makes the signature bank-shot mechanic visible at a glance.
  ctx.save();
  ctx.translate(704, 156);
  bar(ctx, 0, 0, 470, 420, "#101f24", 12);
  ctx.strokeStyle = "#30494c";
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, 434, 384);
  ctx.setLineDash([4, 10]);
  line(ctx, 235, 26, 235, 394, "#30494c");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#284347";
  ctx.beginPath();
  ctx.arc(235, 210, 61, 0, Math.PI * 2);
  ctx.stroke();
  bar(ctx, 35, 235, 10, 72, MINT, 5);
  bar(ctx, 425, 112, 10, 72, CORAL, 5);
  ctx.save();
  ctx.translate(180, 128);
  ctx.rotate(-0.48);
  bar(ctx, -6, -46, 12, 92, AMBER, 5);
  ctx.restore();
  ctx.save();
  ctx.translate(290, 294);
  ctx.rotate(-0.48);
  bar(ctx, -6, -46, 12, 92, AMBER, 5);
  ctx.restore();
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(49, 266);
  ctx.bezierCurveTo(115, 270, 131, 223, 170, 165);
  ctx.lineTo(305, 42);
  ctx.quadraticCurveTo(356, 69, 390, 132);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = MINT;
  ctx.shadowBlur = 25;
  dot(ctx, 390, 132, 10, INK);
  ctx.shadowBlur = 0;
  text(ctx, "01", 65, 291, 11, MINT);
  text(ctx, "02", 392, 175, 11, CORAL);
  ctx.restore();
  text(ctx, "SPIN. BANK. OUTPLAY.", 939, 616, 18, INK, "center", 700);
  text(
    ctx,
    "Moving paddles. Moving possibilities.",
    939,
    642,
    12,
    MUTED,
    "center",
  );
  line(ctx, 64, 672, 1216, 672);
  text(ctx, "SOLO VS AI  /  LOCAL TWO-PLAYER", 64, 701, 11, MUTED);
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
    1216,
    701,
    11,
    MUTED,
    "right",
  );
}
export function render(s: State, { ctx }: RenderApi): void {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  if (s.screen === "title") titleScreen(ctx, s);
  else if (s.screen === "howto") {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    text(ctx, "THE FIELD GUIDE", C.FIELD_CX, 99, 13, MINT, "center");
    text(
      ctx,
      "Make every angle count.",
      C.FIELD_CX,
      159,
      46,
      INK,
      "center",
      700,
    );
    const cards = [
      {
        x: 90,
        n: "01 / MOVE",
        title: "Own your side",
        a: "SOLO    W / S or ↑ / ↓",
        b: "VERSUS  P1 W / S · P2 ↑ / ↓",
        color: MINT,
      },
      {
        x: 470,
        n: "02 / SPIN",
        title: "Put a curve on it",
        a: "Move your paddle at contact.",
        b: "Up or down motion adds spin.",
        color: CORAL,
      },
      {
        x: 850,
        n: "03 / BANK",
        title: "Play the ricochet",
        a: "Amber obstacles sway and turn.",
        b: "Use their tilted faces to bank.",
        color: AMBER,
      },
    ];
    for (const c of cards) {
      bar(ctx, c.x, 223, 340, 265, "#132328");
      text(ctx, c.n, c.x + 24, 260, 13, c.color);
      text(ctx, c.title, c.x + 24, 306, 25, INK, "left", 700);
      text(ctx, c.a, c.x + 24, 360, 13, MUTED);
      text(ctx, c.b, c.x + 24, 388, 13, MUTED);
      line(ctx, c.x + 24, 420, c.x + 316, 420);
      text(
        ctx,
        c.n.startsWith("01")
          ? "Touch: use the side sliders."
          : c.n.startsWith("02")
            ? "Spin fades as the ball travels."
            : "A paddle hit picks up speed.",
        c.x + 24,
        455,
        12,
        c.color,
      );
    }
    text(
      ctx,
      `FIRST TO ${C.WIN_SCORE} · LEAD BY ${C.WIN_LEAD}     /     P / ESC PAUSE     /     M MUTE`,
      C.FIELD_CX,
      546,
      14,
      MUTED,
      "center",
    );
    menu(ctx, s);
  } else {
    field(ctx, s);
    text(ctx, "PLAYER 01", C.FIELD_CX - 130, 42, 11, MINT, "center");
    text(
      ctx,
      s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
      C.FIELD_CX + 130,
      42,
      11,
      CORAL,
      "center",
    );
    text(
      ctx,
      String(s.score.p1).padStart(2, "0"),
      C.FIELD_CX - 130,
      107,
      64,
      MINT,
      "center",
      700,
    );
    text(
      ctx,
      String(s.score.p2).padStart(2, "0"),
      C.FIELD_CX + 130,
      107,
      64,
      CORAL,
      "center",
      700,
    );
    text(
      ctx,
      "CAROM / " + (s.mode === "solo" ? "SOLO" : "VERSUS"),
      100,
      37,
      12,
      MUTED,
    );
    text(ctx, "P / ESC  PAUSE", 1180, 37, 11, MUTED, "right");
    text(
      ctx,
      `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
      C.FIELD_CX,
      691,
      11,
      MUTED,
      "center",
    );
    text(
      ctx,
      s.muted ? "M  SOUND OFF" : "M  SOUND ON",
      1180,
      691,
      11,
      MUTED,
      "right",
    );
    text(
      ctx,
      s.mode === "solo" ? "W / S  OR  ↑ / ↓" : "W / S     ·     ↑ / ↓",
      100,
      691,
      11,
      MUTED,
    );
    if (s.screen === "countdown") {
      text(ctx, "GET READY", C.FIELD_CX, 268, 14, MINT, "center");
      text(
        ctx,
        String(Math.max(1, Math.ceil(s.ball?.holdTimer ?? 1))),
        C.FIELD_CX,
        326,
        44,
        INK,
        "center",
        700,
      );
      text(
        ctx,
        s.receiver === "left" ? "← YOUR SERVE" : "SERVING RIGHT →",
        C.FIELD_CX,
        419,
        11,
        MUTED,
        "center",
      );
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#081115c9";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      bar(ctx, 390, 155, 500, 455, "#102126", 14);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        202,
        12,
        MINT,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Paused."
          : s.winner === "left"
            ? "Player 01 wins."
            : s.mode === "solo"
              ? "Computer wins."
              : "Player 02 wins.",
        C.FIELD_CX,
        271,
        42,
        INK,
        "center",
        700,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Your next angle can wait."
          : `${s.score.p1}  —  ${s.score.p2}`,
        C.FIELD_CX,
        310,
        18,
        MUTED,
        "center",
      );
      menu(ctx, s);
    }
  }
  ctx.restore();
}
