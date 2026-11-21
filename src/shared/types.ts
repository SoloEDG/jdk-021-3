export type RecipeId = "steak" | "pasta" | "salad";
export type Ingredient = "beef" | "noodle" | "greens";
export interface Recipe {
  id: RecipeId;
  name: string;
  icon: string;
  ingredient: Ingredient;
  station: "pan" | "pot";
  target: number;
  price: number;
}
export interface Order {
  id: number;
  recipe: RecipeId;
  guest: string;
  arrived: number;
  deadline: number;
  status: "waiting" | "accepted" | "served" | "left";
}
export interface Portion {
  id: number;
  recipe: RecipeId;
  preparedAt: number;
  tableId: number | null;
  slot: number | null;
}
export interface Stove {
  id: number;
  kind: "pan" | "pot";
  portion: Portion | null;
  started: number;
}
export interface Dish {
  id: number;
  recipe: RecipeId;
  quality: number;
  cookedAt: number;
  stage: "counter" | "plated";
  tableId: number | null;
  slot: number | null;
}
export interface SupplyOrder {
  id: number;
  ingredient: Ingredient;
  amount: number;
  cost: number;
  orderedAt: number;
  arriveAt: number;
}

export interface Entry {
  id: number;
  time: number;
  label: string;
  amount: number;
  kind: "sale" | "waste" | "miss" | "supply";
}
export interface TableSlot {
  id: number;
  recipe: RecipeId;
  spoiled: boolean;
}
export type TableStatus =
  | "scheduled"
  | "seated"
  | "review"
  | "served"
  | "rejected"
  | "left";
export interface TableOrder {
  id: number;
  name: string;
  /** Agreed arrival time shown to the player, in shift seconds. */
  arrival: number;
  /** Guests may show up this many seconds early; fixed per table. */
  early: number;
  /** The booking agent only sells arrival times inside this window. */
  windowStart: number;
  windowEnd: number;
  slots: TableSlot[];
  quote: number;
  /** Fixed by the reservation contract; the player can never extend it. */
  patience: number;
  reserveEnabled: boolean;
  reserved: Record<Ingredient, number>;
  status: TableStatus;
  seatedAt: number | null;
  deadline: number | null;
  penaltyBooked: boolean;
  servedAt: number | null;
  score: number | null;
  paid: number | null;
  note: string;
}
export interface Game {
  time: number;
  duration: number;
  running: boolean;
  started: boolean;
  ended: boolean;
  nextId: number;
  nextSlot: number;
  selectedOrder: number | null;
  selectedDish: number | null;
  orders: Order[];
  tables: TableOrder[];
  stock: Record<Ingredient, number>;
  /** Purchases paid for but still on the van; they cannot be cooked yet. */
  supply: SupplyOrder[];
  portions: Portion[];
  stoves: Stove[];
  dishes: Dish[];
  entries: Entry[];
  combo: number;
  served: number;
  missed: number;
  notice: string;
  best: number;
}
export type Command =
  | { type: "accept"; id: number }
  | { type: "select-order"; id: number }
  | { type: "prepare"; recipe: RecipeId; table?: number | null; slot?: number | null }
  | { type: "cook"; portion: number; stove: number }
  | { type: "lift"; id: number }
  | { type: "plate"; id: number }
  | { type: "select-dish"; id: number }
  | { type: "serve" }
  | { type: "discard"; id: number }
  | { type: "restock"; ingredient: Ingredient }
  | { type: "set-table-arrival"; id: number; value: number }
  | { type: "add-table-dish"; id: number; recipe: RecipeId }
  | { type: "remove-table-dish"; id: number; slot: number }
  | { type: "set-table-quote"; id: number; value: number }
  | { type: "suggest-table-quote"; id: number }
  | { type: "reserve-table"; id: number }
  | { type: "release-table-reserve"; id: number }
  | { type: "deliver-table"; id: number }
  | { type: "reject-table"; id: number }
  | { type: "redo-dish"; id: number; slot: number };
