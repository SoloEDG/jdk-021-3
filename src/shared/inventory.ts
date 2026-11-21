import type { Ingredient } from "./types";

export function zeroIngredients(): Record<Ingredient, number> {
  return { beef: 0, noodle: 0, greens: 0 };
}
