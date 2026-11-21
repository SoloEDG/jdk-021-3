<script setup lang="ts">
import type { Game, Command } from "../../../shared/types";
import { activeOrders } from "../lib/patience";
import { seatedTables } from "../../../shared/tables";
import OrderCard from "./OrderCard.vue";
defineProps<{ game: Game; available: number }>();
defineEmits<{ command: [cmd: Command] }>();
</script>
<template>
  <section class="orders-section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">01 / FRONT OF HOUSE</span>
        <h2>
          散客订单 <span class="count">{{ activeOrders(game).length }}</span>
        </h2>
      </div>
      <span class="muted" v-if="available"
        >宴席占着 {{ available }} 桌 · 宴席菜不能拆成散客单结账</span
      >
      <span class="muted" v-else>接单后开始备餐 · 每 18 秒迎来新客</span>
    </div>
    <div class="tickets">
      <OrderCard
        v-for="o in activeOrders(game)"
        :key="o.id"
        :order="o"
        :game="game"
        @accept="(id) => $emit('command', { type: 'accept', id })"
        @select="(id) => $emit('command', { type: 'select-order', id })"
      />
      <div v-if="!activeOrders(game).length && !seatedTables(game).length" class="empty">
        餐厅暂时安静，整理一下厨房吧。
      </div>
      <div v-else-if="!activeOrders(game).length" class="empty">
        散客暂时没有新单，先把宴席的菜备齐。
      </div>
    </div>
  </section>
</template>
