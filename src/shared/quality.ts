import type { Dish, Game, RecipeId } from "./types";
import { recipes } from "./catalog";

/** Quality at the moment a portion is lifted off the stove. */
export function cookQuality(recipe: RecipeId, elapsed: number) {
  const target = recipes[recipe].target;
  return Math.max(0, Math.round(100 - Math.abs(elapsed - target) * 12));
}

/** Freshness loss only starts 15 seconds after cooking. */
export function servingQuality(g: Game, d: Dish) {
  return Math.max(
    0,
    d.quality - Math.floor(Math.max(0, g.time - d.cookedAt - 15) * 2),
  );
}

export interface TableQuality {
  average: number;
  coldestId: number | null;
  coldestQuality: number;
  coldPenalty: number;
  score: number;
}

/**
 * A banquet is judged as one table: the average of every plated dish, minus
 * the drag from the least fresh plate. Shown before the player commits.
 */
export function tableQuality(g: Game, dishes: Dish[]): TableQuality {
  if (!dishes.length)
    return {
      average: 0,
      coldestId: null,
      coldestQuality: 0,
      coldPenalty: 0,
      score: 0,
    };
  const rated = dishes.map((d) => ({
    dish: d,
    quality: servingQuality(g, d),
  }));
  const average = Math.round(
    rated.reduce((sum, r) => sum + r.quality, 0) / rated.length,
  );
  const coldest = rated.reduce((coldest, r) =>
    r.quality < coldest.quality ? r : coldest,
  );
  const coldPenalty =
    coldest.quality < 60 ? Math.round((60 - coldest.quality) * 0.4) : 0;
  return {
    average,
    coldestId: coldest.dish.id,
    coldestQuality: coldest.quality,
    coldPenalty,
    score: Math.max(0, Math.min(100, average - coldPenalty)),
  };
}
