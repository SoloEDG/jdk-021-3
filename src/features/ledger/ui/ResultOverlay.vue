<script setup lang="ts">
import type { Game } from "../../../shared/types";
import { totals, grade } from "../lib/totals";
defineProps<{ game: Game }>();
defineEmits<{ restart: [] }>();
</script>
<template>
  <div v-if="game.ended" class="overlay">
    <section class="result">
      <span class="eyebrow">SHIFT COMPLETE</span>
      <div class="grade">{{ grade(game) }}</div>
      <h2>午市打烊，主厨辛苦了</h2>
      <p>
        本场净收益 <b>¥{{ totals(game).net }}</b>
      </p>
      <p>
        完成 {{ game.served }} 单 · 离店 {{ game.missed }} 位 ·
        宴席交付 {{ game.tables.filter((t) => t.status === "served").length }}/{{
          game.tables.length
        }} 桌
      </p>
      <p v-if="game.tables.some((t) => t.status !== 'served')">
        未交付：{{
          game.tables
            .filter((t) => t.status !== "served")
            .map((t) => `${t.name}（${t.status === "rejected" ? "拒绝" : "离席"}）`)
            .join("、")
        }}
      </p>
      <button @click="$emit('restart')">再开一家好餐厅 ↗</button>
    </section>
  </div>
</template>
