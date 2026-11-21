import type { Game, RecipeId, Ingredient } from "../../../shared/types";
import { recipes, ingredients } from "../../../shared/catalog";
import { preparationIssue, prepare as preparePortion } from "../lib/availability";

export const SUPPLY_LEAD = 8;
export const SUPPLY_BATCH = 3;
export const STOCK_CAP = 12;

export function pendingSupply(g: Game, i: Ingredient) {
  return g.supply
    .filter((s) => s.ingredient === i)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function prepare(
  g: Game,
  r: RecipeId,
  table: number | null = null,
  slot: number | null = null,
) {
  preparePortion(g, r, { tableId: table, slotId: slot });
}

/** Purchases take time to arrive, so a hold cannot be replaced instantly. */
export function restock(g: Game, i: Ingredient) {
  const onHand = g.stock[i] + pendingSupply(g, i);
  if (onHand >= STOCK_CAP) {
    g.notice = "库存充足，上限12份";
    return;
  }
  const amount = Math.min(SUPPLY_BATCH, STOCK_CAP - onHand);
  const cost = ingredients[i].cost * amount;
  g.supply.push({
    id: g.nextId++,
    ingredient: i,
    amount,
    cost,
    orderedAt: g.time,
    arriveAt: g.time + SUPPLY_LEAD,
  });
  g.entries.push({
    id: g.nextId++,
    time: g.time,
    label: `采购${ingredients[i].name} ×${amount}`,
    amount: -cost,
    kind: "supply",
  });
  g.notice = `${ingredients[i].name} ×${amount} 已下单，${SUPPLY_LEAD} 秒后到货（费用 ¥${cost} 已入账）`;
}

export function receiveSupply(g: Game) {
  const due = g.supply.filter((s) => g.time + 1e-9 >= s.arriveAt);
  if (!due.length) return;
  for (const order of due) {
    g.stock[order.ingredient] = Math.min(
      STOCK_CAP,
      g.stock[order.ingredient] + order.amount,
    );
  }
  g.supply = g.supply.filter((s) => g.time + 1e-9 < s.arriveAt);
  if (due.length) {
    g.notice = `收货：${due
      .map((s) => `${ingredients[s.ingredient].name}×${s.amount}`)
      .join("、")}，已进入可用库存`;
  }
}

export { preparationIssue };
