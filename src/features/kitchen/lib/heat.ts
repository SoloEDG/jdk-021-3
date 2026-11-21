import type { Game, Stove } from "../../../shared/types";
import { recipes } from "../../../shared/catalog";
import { cookQuality } from "../../../shared/quality";

export function quality(
  recipe: Game["portions"][number]["recipe"],
  elapsed: number,
) {
  return cookQuality(recipe, elapsed);
}

export function heatLabel(g: Game, s: Stove) {
  if (!s.portion) return "空闲";
  const t = g.time - s.started,
    ideal = recipes[s.portion.recipe].target;
  return t < ideal - 2 ? "烹饪中" : t <= ideal + 2 ? "最佳火候" : "即将焦糊";
}
