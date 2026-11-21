import type { Game } from "../../../shared/types";
import { recipes } from "../../../shared/catalog";
import { refreshTableReview } from "../../banquet/model/service";

export function plate(g: Game, id: number) {
  const d = g.dishes.find((d) => d.id === id);
  if (!d || d.stage !== "counter") return;
  d.stage = "plated";
  const table =
    d.tableId === null ? null : g.tables.find((t) => t.id === d.tableId);
  if (d.tableId === null) g.selectedDish = id;
  g.notice = table
    ? `${table.name} 的 ${recipes[d.recipe].name} 已装盘，齐菜后才能整桌交付`
    : "装盘完成，请选中订单后上菜";
  refreshTableReview(g);
}

export function discard(g: Game, id: number) {
  const dish = g.dishes.find((d) => d.id === id);
  if (!dish) return;
  const table =
    dish.tableId === null
      ? null
      : g.tables.find((t) => t.id === dish.tableId);
  if (dish.tableId !== null) {
    const slot = table?.slots.find((s) => s.id === dish.slot);
    if (slot) slot.spoiled = true;
  }
  g.dishes = g.dishes.filter((d) => d.id !== id);
  if (g.selectedDish === id) g.selectedDish = null;
  g.entries.push({
    id: g.nextId++,
    time: g.time,
    label: table ? `${table.name} 烹饪报废` : "丢弃菜品",
    amount: -3,
    kind: "waste",
  });
  refreshTableReview(g);
  g.notice = table
    ? `${table.name} 的一道菜报废，桌单仍保留，需要重做`
    : "已丢弃，浪费成本 ¥3";
}
