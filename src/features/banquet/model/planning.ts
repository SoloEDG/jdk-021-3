import type {
  Game,
  Ingredient,
  RecipeId,
  TableOrder,
} from "../../../shared/types";
import { ingredients, recipes } from "../../../shared/catalog";
import {
  MAX_TABLE_SLOTS,
  availableStock,
  latestArrival,
  menuTotal,
  outstandingIngredients,
  quoteBounds,
  reservationTotal,
  roundEven,
} from "../../../shared/tables";

function scheduledTable(g: Game, id: number) {
  const table = g.tables.find((t) => t.id === id);
  if (!table || table.status !== "scheduled") return null;
  return table;
}

/** Arrival, menu and quote are locked once the shift opens. */
function planningLocked(g: Game, table: TableOrder) {
  if (g.started) {
    g.notice = "已经开餐，桌单不能改到店时间、菜单或报价";
    return true;
  }
  if (table.status !== "scheduled") {
    g.notice = "这张桌单已经入席，不能再调整";
    return true;
  }
  return false;
}

export function setTableArrival(g: Game, id: number, value: number) {
  const table = scheduledTable(g, id);
  if (!table || planningLocked(g, table)) return;
  const latest = latestArrival(table, g.duration);
  const v = Math.round(value / 2) * 2;
  const clamped = Math.max(table.windowStart, Math.min(latest, v));
  table.arrival = clamped;
  g.notice =
    clamped !== v
      ? `${table.name} 最晚只能约到 ${clamped}s：再晚，固定耐心撑不到打烊`
      : `${table.name} 约定 ${table.arrival}s 到店；最早可能 ${Math.max(0, table.arrival - table.early)}s 就出现`;
}

export function addTableDish(g: Game, id: number, recipe: RecipeId) {
  const table = scheduledTable(g, id);
  if (!table || planningLocked(g, table)) return;
  if (table.slots.length >= MAX_TABLE_SLOTS) {
    g.notice = `一桌最多 ${MAX_TABLE_SLOTS} 道菜，保证三桌能交错出齐`;
    return;
  }
  table.slots.push({ id: g.nextSlot++, recipe, spoiled: false });
  syncReservation(g, table);
  g.notice = `${table.name} 加入 ${recipes[recipe].name}，别忘了同步整桌报价`;
}

export function removeTableDish(g: Game, id: number, slot: number) {
  const table = scheduledTable(g, id);
  if (!table || planningLocked(g, table)) return;
  if (table.slots.length <= 1) {
    g.notice = "每桌至少要留一道菜";
    return;
  }
  const target = table.slots.find((s) => s.id === slot);
  table.slots = table.slots.filter((s) => s.id !== slot);
  syncReservation(g, table);
  g.notice = `${target ? recipes[target.recipe].name : "菜品"} 已从 ${table.name} 撤下`;
}

export function setTableQuote(g: Game, id: number, value: number) {
  const table = scheduledTable(g, id);
  if (!table || planningLocked(g, table)) return;
  const bounds = quoteBounds(table);
  table.quote = Math.max(bounds.min, Math.min(bounds.max, roundEven(value)));
  g.notice = `${table.name} 整桌报价 ¥${table.quote}（菜单价 ¥${bounds.menu}）`;
}

export function suggestTableQuote(g: Game, id: number) {
  const table = scheduledTable(g, id);
  if (!table || planningLocked(g, table)) return;
  const bounds = quoteBounds(table);
  table.quote = Math.max(
    bounds.min,
    Math.min(bounds.max, roundEven(menuTotal(table) * 1.1)),
  );
  g.notice = `${table.name} 报价按菜单加一成：¥${table.quote}`;
}

function openTable(g: Game, id: number) {
  const table = g.tables.find((t) => t.id === id);
  if (!table) return null;
  if (
    table.status === "served" ||
    table.status === "rejected" ||
    table.status === "left"
  )
    return null;
  return table;
}

export function holdTableStock(g: Game, id: number) {
  const table = openTable(g, id);
  if (table) reserveTable(g, table);
}

export function releaseTableStock(g: Game, id: number) {
  const table = openTable(g, id);
  if (table) releaseReservation(g, table);
}

/**
 * Give back every unit still sitting in the hold. Ingredients already
 * prepared or cooked for this table are spent and never come back.
 */
export function releaseReservation(g: Game, table: TableOrder) {
  const held = reservationTotal(table);
  table.reserveEnabled = false;
  table.reserved = { beef: 0, noodle: 0, greens: 0 };
  g.notice =
    held > 0
      ? `已解除 ${table.name} 的预留：${held} 份未用原料回到可用库存；已备料/下锅的部分不会退回`
      : `${table.name} 没有占用预留`;
}

/** Reserve every outstanding ingredient the shelf can still promise. */
export function reserveTable(g: Game, table: TableOrder) {
  const need = outstandingIngredients(g, table);
  const short: string[] = [];
  let added = 0;
  for (const ingredient of Object.keys(need) as Ingredient[]) {
    const target = need[ingredient];
    const missing = Math.max(0, target - table.reserved[ingredient]);
    if (!missing) continue;
    const take = Math.min(missing, availableStock(g, ingredient));
    table.reserved[ingredient] += take;
    added += take;
    if (take < missing)
      short.push(`${ingredients[ingredient].name}差${missing - take}份`);
  }
  table.reserveEnabled = true;
  if (short.length) {
    g.notice = `${table.name} 只预留到 ${added} 份，${short.join("、")}，开餐后要抢现货或采购`;
  } else if (added) {
    g.notice = `${table.name} 已预留 ${added} 份原料，散客只能用剩下的现货`;
  } else {
    g.notice = `${table.name} 的原料已全部预留，散客只能使用剩余现货`;
  }
}

/** Keep reservations in step with menu edits; only unused units are released. */
export function syncReservation(g: Game, table: TableOrder) {
  if (!table.reserveEnabled || table.status !== "scheduled") return;
  const need = outstandingIngredients(g, table);
  for (const ingredient of Object.keys(need) as Ingredient[]) {
    table.reserved[ingredient] = Math.min(
      need[ingredient],
      table.reserved[ingredient] + availableStock(g, ingredient),
    );
  }
}
