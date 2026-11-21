import type { Game } from "../../../shared/types";
import { totals } from "../lib/totals";
import { closeBanquet } from "../../banquet";
export function closeShift(g: Game) {
  g.running = false;
  g.ended = true;
  g.portions = [];
  g.dishes = [];
  g.stoves.forEach((s) => (s.portion = null));
  closeBanquet(g);
  g.tables.forEach((t) => {
    t.reserved = { beef: 0, noodle: 0, greens: 0 };
  });
  g.best = Math.max(g.best, totals(g).net);
  g.notice = "午市结束，辛苦了，主厨！";
}
export function saveBest(g: Game) {
  try {
    localStorage.setItem("lunch-rush-best", String(g.best));
  } catch {
    g.notice = "浏览器存储不可用，本局结算仍然有效";
  }
}
export function readBest() {
  try {
    const v = Number(localStorage.getItem("lunch-rush-best"));
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  } catch {
    return 0;
  }
}
