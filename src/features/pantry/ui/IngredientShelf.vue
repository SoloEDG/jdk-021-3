<script setup lang="ts">
import type { Game, Ingredient } from "../../../shared/types";
import { ingredients } from "../../../shared/catalog";
import { availableStock, totalReserved } from "../../../shared/tables";
import { pendingSupply } from "../model/inventory";
defineProps<{ game: Game }>();
defineEmits<{ restock: [i: Ingredient] }>();
const ids: Ingredient[] = ["beef", "noodle", "greens"];
</script>

<template>
  <div class="shelf">
    <div v-for="i in ids" :key="i" class="stock-row">
      <span>{{ ingredients[i].icon }} {{ ingredients[i].name }}</span
      ><b :class="{ red: availableStock(game, i) === 0 }">
        {{ availableStock(game, i) }} 可用<em v-if="totalReserved(game, i)"
          >/ 预 {{ totalReserved(game, i) }}</em
        ><small class="stock-total"
          >共 {{ game.stock[i] }}<template v-if="pendingSupply(game, i)"
            > · 在途 {{ pendingSupply(game, i) }}</template
          ></small
        ></b
      ><button
        class="tiny soft"
        @click="$emit('restock', i)"
        :aria-label="'采购' + ingredients[i].name"
      >
        +{{ Math.min(3, 12 - game.stock[i] - pendingSupply(game, i)) }} / ¥{{
          ingredients[i].cost *
          Math.min(3, 12 - game.stock[i] - pendingSupply(game, i))
        }}
      </button>
    </div>
  </div>
</template>
