import type { Game, TableOrder } from "../../../shared/types";
import { recipes } from "../../../shared/catalog";
import {
  MIN_TABLE_QUALITY,
  allPlated,
  breachPenalty,
  platedCount,
  slotViews,
  tableDishes,
} from "../../../shared/tables";
import { tableQuality } from "../../../shared/quality";

function clearHold(table: TableOrder) {
  table.reserved = { beef: 0, noodle: 0, greens: 0 };
}

/** Food already made for a table that will never be served is scrapped. */
function dropTableWork(g: Game, table: TableOrder) {
  g.dishes = g.dishes.filter((d) => d.tableId !== table.id);
  g.portions = g.portions.filter((p) => p.tableId !== table.id);
  g.stoves.forEach((s) => {
    if (s.portion?.tableId === table.id) s.portion = null;
  });
  if (
    g.selectedDish !== null &&
    !g.dishes.some((d) => d.id === g.selectedDish)
  )
    g.selectedDish = null;
}

export function seatDueTables(g: Game) {
  for (const table of g.tables) {
    if (table.status !== "scheduled") continue;
    if (g.time + 1e-9 < table.arrival - table.early) continue;
    table.status = "seated";
    table.seatedAt = g.time;
    table.deadline = g.time + table.patience;
    table.note =
      g.time < table.arrival
        ? `提前 ${Math.round(table.arrival - g.time)}s 到店，已入席`
        : "已按约到店入席";
    g.notice = `${table.name} 已到店，耐心 ${table.patience}s；齐菜前不可拆单，也不能改约`;
  }
  refreshTableReview(g);
}

export function expireTables(g: Game) {
  for (const table of g.tables) {
    if (
      (table.status !== "seated" && table.status !== "review") ||
      table.deadline === null
    )
      continue;
    if (g.time + 1e-9 < table.deadline) continue;
    table.status = "left";
    table.note = "超时未齐菜，整桌离席";
    clearHold(table);
    dropTableWork(g, table);
    g.missed++;
    g.combo = 0;
    bookPenalty(g, table, "宴席超时违约");
    g.notice = `${table.name} 等待超时离席，按违约条款扣除 ¥${breachPenalty(table)}`;
  }
}

function bookPenalty(g: Game, table: TableOrder, label: string) {
  if (table.penaltyBooked) return;
  table.penaltyBooked = true;
  const amount = breachPenalty(table);
  g.entries.push({
    id: g.nextId++,
    time: g.time,
    label: `${label} · ${table.name}`,
    amount: -amount,
    kind: "miss",
  });
}

/** At closing, any banquet not delivered counts as a breach. */
export function closeBanquet(g: Game) {
  for (const table of g.tables) {
    if (
      table.status === "served" ||
      table.status === "rejected" ||
      table.status === "left"
    ) {
      clearHold(table);
      continue;
    }
    table.status = "left";
    table.note = "打烊时仍未交付，按违约条款结算";
    clearHold(table);
    dropTableWork(g, table);
    g.missed++;
    bookPenalty(g, table, "打烊未交付违约");
  }
}

export interface TableReview {
  count: number;
  total: number;
  quality: ReturnType<typeof tableQuality>;
  payout: number;
  penalty: number;
  canServe: boolean;
  reason: string;
}

export function tableReview(g: Game, table: TableOrder): TableReview {
  const dishes = tableDishes(g, table).filter((d) => d.stage === "plated");
  const quality = tableQuality(g, dishes);
  // The agreed quote is always honoured; good quality earns a tip on top.
  const tip = Math.round(
    (table.quote * 0.2 * Math.max(0, quality.score - MIN_TABLE_QUALITY)) /
      (100 - MIN_TABLE_QUALITY),
  );
  const payout = table.quote + Math.max(0, tip);
  const ready = platedCount(g, table);
  const allReady = ready === table.slots.length;
  const reason = !allReady
    ? `还差 ${table.slots.length - ready} 道菜`
    : quality.score < MIN_TABLE_QUALITY
      ? `总品质 ${quality.score} 低于 ${MIN_TABLE_QUALITY}，需重做或拒绝整桌`
      : "";
  return {
    count: dishes.length,
    total: table.slots.length,
    quality,
    payout: allReady ? payout : 0,
    penalty: breachPenalty(table),
    canServe: allReady && quality.score >= MIN_TABLE_QUALITY,
    reason,
  };
}

export function deliverTable(g: Game, id: number) {
  const table = g.tables.find((t) => t.id === id);
  if (!table) return;
  if (table.status !== "review") {
    g.notice = "整桌菜没有全部装盘，不能拆开交付";
    return;
  }
  const review = tableReview(g, table);
  if (!review.canServe) {
    g.notice = review.reason;
    return;
  }
  table.status = "served";
  table.servedAt = g.time;
  table.score = review.quality.score;
  table.paid = review.payout;
  table.note = `整桌交付，总品质 ${review.quality.score}`;
  clearHold(table);
  g.combo++;
  g.served++;
  g.entries.push({
    id: g.nextId++,
    time: g.time,
    label: `${table.name} · ${table.slots.length} 道整桌`,
    amount: review.payout,
    kind: "sale",
  });
  g.dishes = g.dishes.filter((d) => d.tableId !== table.id);
  g.notice = `${table.name} 齐菜交付 +¥${review.payout} · 总品质 ${review.quality.score} · 最冷 ${review.quality.coldestQuality}`;
}

/** The diners refuse the whole table: contract penalty, no sale. */
export function rejectTable(g: Game, id: number) {
  const table = g.tables.find((t) => t.id === id);
  if (!table) return;
  if (table.status !== "review") {
    g.notice = "只有齐菜进入确认时，才能拒绝整桌";
    return;
  }
  table.status = "rejected";
  table.note = "整桌被拒绝，按违约条款结算";
  clearHold(table);
  dropTableWork(g, table);
  g.combo = 0;
  bookPenalty(g, table, "整桌拒绝违约");
  g.notice = `${table.name} 整桌拒绝，损失 ¥${breachPenalty(table)}；本桌不会退回散客订单`;
}

/** Send one plated dish back and rebuild it; the table keeps its identity. */
export function redoDish(g: Game, id: number, slot: number) {
  const table = g.tables.find((t) => t.id === id);
  if (!table) return;
  if (table.status !== "seated" && table.status !== "review") {
    g.notice = "只有已入席的桌单可以重做";
    return;
  }
  const dish = g.dishes.find(
    (d) => d.tableId === table.id && d.slot === slot,
  );
  if (!dish) {
    g.notice = "这一道还没有成品，直接重新备料即可";
    return;
  }
  g.dishes = g.dishes.filter((d) => d.id !== dish.id);
  if (g.selectedDish === dish.id) g.selectedDish = null;
  const target = table.slots.find((s) => s.id === slot);
  if (target) target.spoiled = true;
  table.status = "seated";
  table.note = `${target ? recipes[target.recipe].name : "菜品"} 被退回，桌单保留等待重做`;
  g.entries.push({
    id: g.nextId++,
    time: g.time,
    label: `${table.name} 重做报废`,
    amount: -3,
    kind: "waste",
  });
  g.notice = `${table.name} 退回一道菜并记报废 ¥3，桌单状态保留`;
}

/** Called after prep/cook/plate changes so tables can move into review. */
export function refreshTableReview(g: Game) {
  for (const table of g.tables) {
    if (table.status !== "seated" && table.status !== "review") continue;
    const ready = allPlated(g, table);
    if (table.status === "seated" && ready) {
      table.status = "review";
      table.note = "菜品已齐，等待整桌确认";
      g.notice = `${table.name} 已齐菜：可看总品质后整桌交付，或退回重做某一道`;
    } else if (table.status === "review" && !ready) {
      table.status = "seated";
      table.note = "有菜品被退回，等待重做";
    }
  }
}
