import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, State } from "./game";
import { start, title } from "./world";
export function items(s: State): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: State, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= items(s).length)
    return null;
  return s.screen === "title"
    ? { x: 104, y: 365 + index * 70, w: 400, h: 58 }
    : s.screen === "howto"
      ? { x: 440, y: 594, w: 400, h: 58 }
      : { x: 440, y: 355 + index * 70, w: 400, h: 58 };
}
function confirm(s: State): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : start(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return title(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? start(s, s.mode)
          : title(s);
    case "matchover":
      return s.menuIndex === 0 ? start(s, s.mode) : title(s);
    default:
      return s;
  }
}
export function readInput(s: State, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  // Audio authority is carried in state, allowing debug poses before the next frame.
  api.audio.setMuted(edges.mute ? !s.muted : s.muted);
  let next: CaromState = { ...s, muted: api.audio.muted() };
  if (s.screen === "playing" || s.screen === "countdown")
    return edges.pause
      ? { ...next, resumeScreen: s.screen, screen: "paused", menuIndex: 0 }
      : next;
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...next, screen: s.resumeScreen };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return title(next);
  const count = items(s).length;
  let keyboardConfirmed = false;
  if (edges["p1-up"] || edges["p2-up"])
    next = { ...next, menuIndex: (s.menuIndex + count - 1) % count };
  else if (edges["p1-down"] || edges["p2-down"])
    next = { ...next, menuIndex: (s.menuIndex + 1) % count };
  else if (edges.confirm) {
    next = confirm(next);
    keyboardConfirmed = true;
  }
  const presses = { ...s.menuPresses };
  for (const sample of samples) {
    const index = items(s).findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return (
        sample.x >= r.x &&
        sample.x <= r.x + r.w &&
        sample.y >= r.y &&
        sample.y <= r.y + r.h
      );
    });
    if (index >= 0 && !keyboardConfirmed) next = { ...next, menuIndex: index };
    if (sample.type === "down" && sample.button === "primary")
      presses[sample.id] = index;
    if (sample.type === "up") {
      if (index >= 0 && presses[sample.id] === index && !keyboardConfirmed) {
        next = confirm(next);
        keyboardConfirmed = true;
      }
      delete presses[sample.id];
    }
  }
  return { ...next, menuPresses: next.screen === s.screen ? presses : {} };
}
