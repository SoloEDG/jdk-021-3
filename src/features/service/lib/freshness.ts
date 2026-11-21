import type { Game } from "../../../shared/types";

export { servingQuality } from "../../../shared/quality";

/** The walk-in pair: a plated walk-in dish plus an accepted walk-in order. */
export function servicePair(g: Game) {
  return {
    dish: g.dishes.find(
      (d) => d.id === g.selectedDish && d.tableId === null,
    ),
    order: g.orders.find(
      (o) => o.id === g.selectedOrder && o.status === "accepted",
    ),
  };
}
