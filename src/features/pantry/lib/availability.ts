import type { Game, RecipeId, TableSlot } from "../../../shared/types";
import { recipes } from "../../../shared/catalog";
import { availableStock, slotView } from "../../../shared/tables";
import { refreshTableReview } from "../../banquet/model/service";

export interface PrepTarget {
  tableId: number | null;
  slotId: number | null;
}

export function resolveSlot(
  g: Game,
  recipe: RecipeId,
  target: PrepTarget,
): TableSlot | null {
  if (target.tableId === null || target.slotId === null) return null;
  const table = g.tables.find((t) => t.id === target.tableId);
  if (!table || (table.status !== "scheduled" && table.status !== "seated"))
    return null;
  const slot = table.slots.find((s) => s.id === target.slotId);
  if (!slot || slot.recipe !== recipe) return null;
  return slot;
}

export function preparationIssue(
  g: Game,
  recipe: RecipeId,
  target: PrepTarget = { tableId: null, slotId: null },
): string {
  if (g.portions.length >= 6) return "备料台已满（6份）";
  const ingredient = recipes[recipe].ingredient;
  if (target.tableId !== null) {
    const table = g.tables.find((t) => t.id === target.tableId);
    const slot = resolveSlot(g, recipe, target);
    if (!table) return "桌单不存在";
    if (table.status !== "scheduled" && table.status !== "seated")
      return "这张桌单已经结束";
    if (!slot) return "桌单里没有这道菜";
    const view = slotView(g, table, slot);
    if (view.phase !== "missing" && view.phase !== "spoiled")
      return "这道菜已经在处理中";
    if (table.reserved[ingredient] > 0) return "";
  }
  if (availableStock(g, ingredient) <= 0) {
    return `${recipes[recipe].name} 的原料已被宴席预留，可用现货为 0`;
  }
  return "";
}

export function prepare(
  g: Game,
  recipe: RecipeId,
  target: PrepTarget = { tableId: null, slotId: null },
) {
  const issue = preparationIssue(g, recipe, target);
  if (issue) {
    g.notice = issue;
    return;
  }
  const ingredient = recipes[recipe].ingredient;
  const table =
    target.tableId === null
      ? null
      : (g.tables.find((t) => t.id === target.tableId) ?? null);
  const slot =
    table && target.slotId !== null
      ? table.slots.find((s) => s.id === target.slotId)
      : null;
  const fromReserve = !!table && table.reserved[ingredient] > 0;
  if (fromReserve && table) table.reserved[ingredient]--;
  if (slot) slot.spoiled = false;
  g.stock[ingredient]--;
  g.portions.push({
    id: g.nextId++,
    recipe,
    preparedAt: g.time,
    tableId: target.tableId,
    slot: target.slotId,
  });
  refreshTableReview(g);
  const tag = table ? `${table.name} · ` : "";
  g.notice = fromReserve
    ? `${tag}${recipes[recipe].name} 从预留中备料，现货可用库存不变`
    : `${tag}${recipes[recipe].name} 使用现货备料，可用库存减少`;
}
