<script setup lang="ts">
import { computed } from "vue";
import type {
  Game,
  Command,
  Ingredient,
  TableOrder,
  RecipeId,
} from "../../../shared/types";
import { recipeList, recipes } from "../../../shared/catalog";
import {
  breachPenalty,
  latestArrival,
  menuTotal,
  quoteBounds,
  reservationTotal,
  requiredIngredients,
  slotViews,
  totalReserved,
} from "../../../shared/tables";
import { tableReview } from "../model/service";

const props = defineProps<{ game: Game }>();
const emit = defineEmits<{ command: [cmd: Command] }>();

const statusLabel: Record<TableOrder["status"], string> = {
  scheduled: "待入席",
  seated: "已入席",
  review: "待确认",
  served: "已交付",
  rejected: "已拒绝",
  left: "已离席",
};

const ingredientLabel = { beef: "牛肉", noodle: "面条", greens: "时蔬" };

const reserveTotals = computed(() => ({
  beef: totalReserved(props.game, "beef"),
  noodle: totalReserved(props.game, "noodle"),
  greens: totalReserved(props.game, "greens"),
}));

function remaining(t: TableOrder) {
  const when = Math.max(0, t.arrival - props.game.time);
  return t.status === "scheduled"
    ? `约 ${when}s 后到店`
    : t.status === "seated" || t.status === "review"
      ? `耐心剩 ${Math.ceil(Math.max(0, (t.deadline ?? props.game.time) - props.game.time))}s`
      : "";
}

function arrivalHint(t: TableOrder) {
  return `最早 ${Math.max(0, t.arrival - t.early)}s 到店 · 最晚可约 ${latestArrival(t, props.game.duration)}s`;
}

function canPlan(t: TableOrder) {
  return !props.game.started && t.status === "scheduled";
}

function phaseLabel(phase: string) {
  return {
    missing: "待备料",
    prepared: "已备料",
    cooking: "烹饪中",
    counter: "待装盘",
    plated: "已装盘",
    spoiled: "已报废",
  }[phase] ?? phase;
}

function ingredientNeed(t: TableOrder, i: keyof typeof ingredientLabel) {
  const req = requiredIngredients(t)[i];
  const held = t.reserved[i];
  return { req, held };
}

function outstanding(t: TableOrder) {
  const need = requiredIngredients(t);
  const ids: Ingredient[] = ["beef", "noodle", "greens"];
  return ids.some((i) => t.reserved[i] < need[i]);
}

function review(t: TableOrder) {
  return tableReview(props.game, t);
}

function coldestName(t: TableOrder) {
  const coldestId = review(t).quality.coldestId;
  const dish = props.game.dishes.find(
    (d) => d.id === coldestId && d.tableId === t.id,
  );
  const slot = dish
    ? t.slots.find((s) => s.id === dish.slot)
    : undefined;
  return slot ? recipes[slot.recipe].name : "—";
}
</script>

<template>
  <section class="banquet-section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">00 / RESERVATIONS</span>
        <h2>
          预约宴席 <span class="count">{{ game.tables.length }}</span>
        </h2>
      </div>
      <span class="muted"
        >开餐前定桌 · 到店时间与地盘固定 · 整桌一次交付</span
      >
    </div>
    <div class="banquet-grid">
      <article
        v-for="t in game.tables"
        :key="t.id"
        class="banquet-card"
        :class="[t.status, { ready: t.status === 'review' }]"
      >
        <div class="banquet-top">
          <b>{{ t.name }}</b
          ><span class="table-status">{{ statusLabel[t.status] }}</span>
        </div>
        <p class="banquet-timing">
          <span v-if="t.status === 'scheduled'"
            >约定 {{ t.arrival }}s 到店 · {{ remaining(t) }}</span
          ><span v-else-if="t.seatedAt !== null"
            >{{ t.seatedAt.toFixed(1) }}s 入席 · {{ remaining(t) }}</span
          ><span v-else>{{ remaining(t) }}</span>
        </p>
        <p class="muted small-note">
          {{ arrivalHint(t) }} · 耐心 {{ t.patience }}s 固定
          <b v-if="t.status === 'scheduled'" class="early-warning"
            >最早 {{ Math.max(0, t.arrival - t.early) }}s 就可能到店</b
          >
        </p>

        <div class="banquet-plan" v-if="canPlan(t)">
          <label class="plan-row">
            <span>到店时间</span>
            <input
              type="range"
              :min="t.windowStart"
              :max="latestArrival(t, game.duration)"
              step="2"
              :value="t.arrival"
              @input="
                $emit('command', {
                  type: 'set-table-arrival',
                  id: t.id,
                  value: Number(($event.target as HTMLInputElement).value),
                })
              "
            />
            <b>{{ t.arrival }}s</b>
          </label>
          <label class="plan-row">
            <span>整桌报价</span>
            <input
              type="range"
              :min="quoteBounds(t).min"
              :max="quoteBounds(t).max"
              step="2"
              :value="t.quote"
              @input="
                $emit('command', {
                  type: 'set-table-quote',
                  id: t.id,
                  value: Number(($event.target as HTMLInputElement).value),
                })
              "
            />
            <b>¥{{ t.quote }}</b>
          </label>
          <div class="plan-actions">
            <button
              class="tiny soft"
              @click="$emit('command', { type: 'suggest-table-quote', id: t.id })"
            >
              菜单价 +10%
            </button>
            <span class="muted"
              >菜单 ¥{{ menuTotal(t) }} · 可报 ¥{{ quoteBounds(t).min }}–¥{{
                quoteBounds(t).max
              }}</span
            >
          </div>
        </div>

        <ul class="slot-list">
          <li
            v-for="view in slotViews(game, t)"
            :key="view.slot.id"
            class="slot-row"
            :class="view.phase"
          >
            <span>{{ recipes[view.slot.recipe].icon }}</span>
            <div class="slot-main">
              <b>{{ recipes[view.slot.recipe].name }}</b>
              <small>{{ phaseLabel(view.phase) }}</small>
            </div>
            <button
              v-if="canPlan(t)"
              class="tiny trash"
              aria-label="撤下这道菜"
              @click="
                $emit('command', {
                  type: 'remove-table-dish',
                  id: t.id,
                  slot: view.slot.id,
                })
              "
            >
              ×
            </button>
            <button
              v-else-if="view.phase === 'missing' || view.phase === 'spoiled'"
              class="tiny"
              :disabled="game.portions.length >= 6 || !game.started"
              @click="
                $emit('command', {
                  type: 'prepare',
                  recipe: view.slot.recipe,
                  table: t.id,
                  slot: view.slot.id,
                })
              "
            >
              {{ view.phase === "spoiled" ? "重做" : "备料" }}
            </button>
          </li>
        </ul>

        <div v-if="canPlan(t)" class="add-dish">
          <button
            v-for="r in recipeList"
            :key="r.id"
            class="tiny soft"
            :disabled="t.slots.length >= 3"
            @click="
              $emit('command', {
                type: 'add-table-dish',
                id: t.id,
                recipe: r.id as RecipeId,
              })
            "
          >
            + {{ r.name }}
          </button>
        </div>

        <div class="banquet-reserve">
          <div class="reserve-head">
            <span>食材预留</span>
            <div class="reserve-buttons">
              <button
                class="tiny"
                :disabled="
                  t.status === 'served' ||
                  t.status === 'rejected' ||
                  t.status === 'left' ||
                  !outstanding(t)
                "
                @click="$emit('command', { type: 'reserve-table', id: t.id })"
              >
                {{ reservationTotal(t) > 0 ? "补足预留" : "预留食材" }}
              </button>
              <button
                class="tiny soft"
                :disabled="reservationTotal(t) === 0"
                @click="
                  $emit('command', { type: 'release-table-reserve', id: t.id })
                "
              >
                解除预留
              </button>
            </div>
          </div>
          <div class="reserve-tags">
            <span v-for="(name, i) in ingredientLabel" :key="i">
              {{ name }}
              <b v-if="ingredientNeed(t, i as keyof typeof ingredientLabel).held"
                >预 {{ ingredientNeed(t, i as keyof typeof ingredientLabel).held }}</b
              >
              <em>/ 需 {{ ingredientNeed(t, i as keyof typeof ingredientLabel).req }}</em>
            </span>
          </div>
        </div>

        <div v-if="t.status === 'review'" class="banquet-review">
          <div class="review-score">
            <span>总品质 <b>{{ review(t).quality.score }}</b></span>
            <span
              >平均 {{ review(t).quality.average }} · 最冷
              {{ review(t).quality.coldestQuality
              }}{{ review(t).quality.coldPenalty ? ` (−${review(t).quality.coldPenalty})` : "" }}</span
            >
            <span class="muted">{{ coldestName(t) }} 拖了后腿</span>
          </div>
          <div class="banquet-actions">
            <button
              class="tiny"
              :disabled="!review(t).canServe"
              @click="$emit('command', { type: 'deliver-table', id: t.id })"
            >
              整桌交付 +¥{{ review(t).payout }}
            </button>
            <button
              class="tiny soft"
              @click="$emit('command', { type: 'reject-table', id: t.id })"
            >
              拒绝整桌 −¥{{ breachPenalty(t) }}
            </button>
          </div>
          <div class="banquet-actions redo-row">
            <button
              v-for="view in slotViews(game, t).filter((v) => v.phase === 'plated')"
              :key="view.slot.id"
              class="tiny soft"
              @click="
                $emit('command', {
                  type: 'redo-dish',
                  id: t.id,
                  slot: view.slot.id,
                })
              "
            >
              重做{{ recipes[view.slot.recipe].icon }}
            </button>
          </div>
          <p class="muted small-note" v-if="!review(t).canServe">
            {{ review(t).reason }}
          </p>
        </div>
        <p v-else class="muted small-note">{{ t.note }}</p>
      </article>
    </div>
    <div class="reserve-summary">
      已被宴席预留：<b>牛肉 {{ reserveTotals.beef }}</b
      ><b>面条 {{ reserveTotals.noodle }}</b
      ><b>时蔬 {{ reserveTotals.greens }}</b> · 散客只能用「可用」那一栏
    </div>
  </section>
</template>
