import type { Game, Command } from "../shared/types";
import { accept, expire } from "../features/orders/model/orders";
import { prepare, restock } from "../features/pantry/model/inventory";
import { cook, lift } from "../features/kitchen/model/cooking";
import { plate, discard } from "../features/service/model/plating";
import { deliver } from "../features/service/model/delivery";
import {
  addTableDish,
  removeTableDish,
  setTableArrival,
  setTableQuote,
  suggestTableQuote,
  holdTableStock,
  releaseTableStock,
} from "../features/banquet/model/planning";
import {
  deliverTable,
  redoDish,
  refreshTableReview,
  rejectTable,
} from "../features/banquet/model/service";

export function dispatch(g: Game, c: Command) {
  if (g.ended) {
    g.notice = "今日已经打烊，请重新开局";
    return;
  }
  const planning = c.type.startsWith("set-table-") ||
    c.type === "add-table-dish" ||
    c.type === "remove-table-dish" ||
    c.type === "suggest-table-quote" ||
    c.type === "reserve-table" ||
    c.type === "release-table-reserve";
  if (!g.running && !planning) {
    g.notice = g.started
      ? "暂停中，所有厨房与宴席计时已冻结"
      : "请先规划宴席，再开始营业";
    return;
  }
  switch (c.type) {
    case "accept":
      accept(g, c.id);
      break;
    case "select-order":
      if (g.orders.some((o) => o.id === c.id && o.status === "accepted"))
        g.selectedOrder = c.id;
      break;
    case "prepare":
      prepare(g, c.recipe, c.table ?? null, c.slot ?? null);
      break;
    case "restock":
      restock(g, c.ingredient);
      break;
    case "cook":
      cook(g, c.portion, c.stove);
      break;
    case "lift":
      lift(g, c.id);
      break;
    case "plate":
      plate(g, c.id);
      break;
    case "select-dish":
      if (
        g.dishes.some(
          (d) =>
            d.id === c.id && d.stage === "plated" && d.tableId === null,
        )
      )
        g.selectedDish = c.id;
      else if (g.dishes.some((d) => d.id === c.id && d.tableId !== null))
        g.notice = "宴席的菜只在桌单里整桌交付，不能拆给散客";
      break;
    case "serve":
      deliver(g);
      expire(g);
      break;
    case "discard":
      discard(g, c.id);
      break;
    case "set-table-arrival":
      setTableArrival(g, c.id, c.value);
      break;
    case "add-table-dish":
      addTableDish(g, c.id, c.recipe);
      break;
    case "remove-table-dish":
      removeTableDish(g, c.id, c.slot);
      break;
    case "set-table-quote":
      setTableQuote(g, c.id, c.value);
      break;
    case "suggest-table-quote":
      suggestTableQuote(g, c.id);
      break;
    case "reserve-table":
      holdTableStock(g, c.id);
      break;
    case "release-table-reserve":
      releaseTableStock(g, c.id);
      break;
    case "deliver-table":
      deliverTable(g, c.id);
      break;
    case "reject-table":
      rejectTable(g, c.id);
      break;
    case "redo-dish":
      redoDish(g, c.id, c.slot);
      break;
  }
  refreshTableReview(g);
}
