import { reactive, onUnmounted } from "vue";
import { createGame } from "../shared/initial";
import { expire, arrive } from "../features/orders";
import { closeShift, saveBest, readBest } from "../features/ledger";
import {
  expireTables,
  seatDueTables,
} from "../features/banquet/model/service";
import { planningIssues } from "../shared/tables";
import { receiveSupply } from "../features/pantry/model/inventory";

export function useSession() {
  const game = reactive(createGame(readBest()));
  let last = performance.now(),
    carry = 0;
  const timer = setInterval(() => {
    const now = performance.now(),
      dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    if (!game.running) return;
    carry += dt;
    while (carry >= 0.1 && game.running) {
      carry -= 0.1;
      game.time = Math.min(
        game.duration,
        Math.round((game.time + 0.1) * 10) / 10,
      );
      expire(game);
      receiveSupply(game);
      seatDueTables(game);
      expireTables(game);
      if (Math.round(game.time * 10) % 180 === 0) arrive(game);
      if (game.time >= game.duration) {
        closeShift(game);
        saveBest(game);
      }
    }
  }, 50);
  onUnmounted(() => clearInterval(timer));
  function toggle() {
    if (game.ended) return;
    carry = 0;
    last = performance.now();
    if (!game.started) {
      const issues = planningIssues(game);
      if (issues.length) {
        game.notice = issues[0];
        return;
      }
      game.started = true;
      game.running = true;
      game.notice =
        "开餐！三桌宴席的到店时间已锁定，客人随时可能提前出现。";
      return;
    }
    game.running = !game.running;
    game.notice = game.running
      ? "营业中，客人已经入座。"
      : "已暂停，所有厨房与宴席计时冻结。";
  }
  function restart() {
    Object.assign(game, createGame(game.best));
    carry = 0;
    last = performance.now();
  }
  return { game, toggle, restart };
}
