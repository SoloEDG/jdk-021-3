import type {
  Dish,
  Game,
  Ingredient,
  Portion,
  TableOrder,
  TableSlot,
} from "./types";
import { recipes } from "./catalog";
import { zeroIngredients } from "./inventory";

export const MIN_TABLE_QUALITY = 45;
export const MAX_TABLE_SLOTS = 3;

export type SlotPhase =
  | "missing"
  | "prepared"
  | "cooking"
  | "counter"
  | "plated"
  | "spoiled";

export interface SlotView {
  slot: TableSlot;
  phase: SlotPhase;
  dish?: Dish;
  portion?: Portion;
  stoveId?: number;
}

/** One active item per slot: a cooking portion, a counter dish or a plated dish. */
function activeItem(g: Game, table: TableOrder, slot: TableSlot) {
  const dish = g.dishes.find(
    (d) => d.tableId === table.id && d.slot === slot.id,
  );
  if (dish) return { dish };
  const stove = g.stoves.find(
    (s) => s.portion?.tableId === table.id && s.portion.slot === slot.id,
  );
  if (stove?.portion) return { portion: stove.portion, stoveId: stove.id };
  const portion = g.portions.find(
    (p) => p.tableId === table.id && p.slot === slot.id,
  );
  if (portion) return { portion };
  return {};
}

export function slotView(
  g: Game,
  table: TableOrder,
  slot: TableSlot,
): SlotView {
  const active = activeItem(g, table, slot);
  if (active.dish) {
    return {
      slot,
      dish: active.dish,
      phase: active.dish.stage === "plated" ? "plated" : "counter",
    };
  }
  if (active.portion) {
    return {
      slot,
      portion: active.portion,
      stoveId: active.stoveId,
      phase: active.stoveId ? "cooking" : "prepared",
    };
  }
  return { slot, phase: slot.spoiled ? "spoiled" : "missing" };
}

export function slotViews(g: Game, table: TableOrder): SlotView[] {
  return table.slots.map((slot) => slotView(g, table, slot));
}

/** Slots with no active item still need one ingredient each. */
export function outstandingIngredients(
  g: Game,
  table: TableOrder,
): Record<Ingredient, number> {
  const need = zeroIngredients();
  for (const view of slotViews(g, table)) {
    if (view.phase === "missing" || view.phase === "spoiled") {
      need[recipes[view.slot.recipe].ingredient]++;
    }
  }
  return need;
}

export function requiredIngredients(
  table: TableOrder,
): Record<Ingredient, number> {
  const need = zeroIngredients();
  for (const slot of table.slots) {
    need[recipes[slot.recipe].ingredient]++;
  }
  return need;
}

export function reservationTotal(table: TableOrder) {
  return (Object.keys(table.reserved) as Ingredient[]).reduce(
    (sum, i) => sum + table.reserved[i],
    0,
  );
}

export function totalReserved(g: Game, ingredient: Ingredient) {
  return g.tables.reduce((sum, t) => sum + t.reserved[ingredient], 0);
}

/** Stock a walk-in or an unreserved table may still take right now. */
export function availableStock(g: Game, ingredient: Ingredient) {
  return Math.max(0, g.stock[ingredient] - totalReserved(g, ingredient));
}

/** Banquets currently competing for the pass and the stoves. */
export function liveTables(g: Game) {
  return g.tables.filter((t) => t.status === "seated" || t.status === "review");
}

export function seatedTables(g: Game) {
  return g.tables.filter(
    (t) => t.status === "seated" || t.status === "review",
  );
}

export function allPlated(g: Game, table: TableOrder) {
  const views = slotViews(g, table);
  return views.length > 0 && views.every((v) => v.phase === "plated");
}

export function platedCount(g: Game, table: TableOrder) {
  return slotViews(g, table).filter((v) => v.phase === "plated").length;
}

/** Move a seated table between "still cooking" and "ready for review". */
export function refreshTableStatuses(g: Game) {
  for (const table of g.tables) {
    if (table.status !== "seated" && table.status !== "review") continue;
    table.status = allPlated(g, table) ? "review" : "seated";
  }
}

export function tableDishes(g: Game, table: TableOrder) {
  return g.dishes.filter((d) => d.tableId === table.id && d.slot !== null);
}

export function menuTotal(table: TableOrder) {
  return table.slots.reduce((sum, s) => sum + recipes[s.recipe].price, 0);
}

export function roundEven(n: number) {
  return Math.max(0, Math.round(n / 2) * 2);
}

export function quoteBounds(table: TableOrder) {
  const menu = menuTotal(table);
  return {
    menu,
    min: Math.max(20, roundEven(menu * 0.75)),
    max: Math.max(40, roundEven(menu * 1.35)),
  };
}

export function breachPenalty(table: TableOrder) {
  return Math.max(20, roundEven(table.quote * 0.3));
}

export function latestArrival(table: TableOrder, duration: number) {
  return Math.max(
    table.windowStart,
    Math.min(table.windowEnd, duration - table.patience - 2),
  );
}

/** Why the reservation cannot be put on the board yet, if anything. */
export function planningIssues(g: Game): string[] {
  const issues: string[] = [];
  for (const table of g.tables) {
    const bounds = quoteBounds(table);
    if (!table.slots.length) issues.push(`${table.name} 还没有菜品`);
    if (table.quote < bounds.min || table.quote > bounds.max)
      issues.push(`${table.name} 的报价需在 ¥${bounds.min}–¥${bounds.max}`);
    if (table.arrival < table.windowStart || table.arrival > table.windowEnd)
      issues.push(`${table.name} 的到店时间超出可约时段`);
    if (table.arrival > latestArrival(table, g.duration))
      issues.push(`${table.name} 到店太晚，耐心无法在打烊前结束`);
  }
  return issues;
}
