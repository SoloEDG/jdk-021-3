<script setup lang="ts">
import type { Game, Command } from "../../../shared/types";
import { recipes } from "../../../shared/catalog";
import { servingQuality, servicePair } from "../lib/freshness";
defineProps<{ game: Game }>();
defineEmits<{ command: [cmd: Command] }>();

function tableTag(game: Game, tableId: number | null) {
  if (tableId === null) return "";
  return game.tables.find((t) => t.id === tableId)?.name ?? "";
}
</script>

<template>
  <section class="panel service-panel">
    <span class="eyebrow">04 / PASS & SERVE</span>
    <h2>装盘与上菜 <span class="small">SERVE</span></h2>
    <div class="dish-list">
      <article
        v-for="d in game.dishes"
        :key="d.id"
        class="dish-row"
        :class="{ selected: game.selectedDish === d.id, banquet: d.tableId !== null }"
      >
        <span class="dish-icon">{{ recipes[d.recipe].icon }}</span>
        <div>
          <b>{{ recipes[d.recipe].name }}</b
          ><span v-if="d.tableId !== null" class="table-chip">{{
            tableTag(game, d.tableId)
          }}</span
          ><small
            >品质 {{ servingQuality(game, d) }} ·
            {{ d.stage === "plated" ? "已装盘" : "待装盘" }}</small
          >
        </div>
        <button
          v-if="d.stage === 'counter'"
          class="tiny soft"
          @click="$emit('command', { type: 'plate', id: d.id })"
        >
          装盘</button
        ><button
          v-else-if="d.tableId === null"
          class="tiny soft"
          @click="$emit('command', { type: 'select-dish', id: d.id })"
        >
          选择</button
        ><span v-else class="tiny muted banquet-lock">桌单内</span
        ><button
          class="trash"
          aria-label="丢弃菜品"
          @click="$emit('command', { type: 'discard', id: d.id })"
        >
          ×
        </button>
      </article>
      <div v-if="!game.dishes.length" class="empty plate-empty">
        <div>◌</div>
        这里等待你的第一道美味<small>起锅 → 装盘 → 选择订单 → 上菜</small>
      </div>
    </div>
    <div class="delivery-target">
      散客上菜目标：<b>{{ servicePair(game).order?.guest || "尚未选择订单" }}</b>
    </div>
    <button class="serve-button" @click="$emit('command', { type: 'serve' })">
      上菜 <span>↗</span>
    </button>
    <p class="muted">
      错配扣10秒耐心 · 起锅15秒后开始失温 · 宴席菜在桌单里整桌交付
    </p>
  </section>
</template>
