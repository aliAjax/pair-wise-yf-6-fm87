import "./styles.css";
import { statuses, canTransition } from "./flow.js";
import {
  WIND_LIMIT,
  REQUIRED_EQUIPMENT_CHECKS,
  SAFETY_ROLE,
  evaluateDispatch,
  evaluateRecheck,
  windHalted,
  safetyOfficers,
  workerCount,
  validEquipmentChecks,
  teamBusy
} from "./rules.js";
import { loadState, saveState, resetState } from "./storage.js";

let state = loadState();
let notice = null;
const app = document.querySelector("#app");

function commit() {
  saveState(state);
  render();
}

function flash(type, text) {
  notice = { type, text };
}

function render() {
  const halted = windHalted(state.windLevel);
  const pending = state.orders.filter((order) => order.status === "pending").length;
  const working = state.orders.filter((order) => order.status === "working").length;
  const haltedCount = state.orders.filter((order) => order.status === "halted").length;
  const totalCost = state.orders
    .filter((order) => !["done", "rejected"].includes(order.status))
    .reduce((total, order) => total + Number(order.cost || 0), 0);

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">高空作业调度中心</p>
          <h1>外墙施工派工台</h1>
        </div>
        <section class="stats">
          <div class="stat"><span>待派工单</span><strong>${pending}</strong></div>
          <div class="stat"><span>施工中</span><strong>${working}</strong></div>
          <div class="stat"><span>停工待检</span><strong>${haltedCount}</strong></div>
          <div class="stat"><span>未完工预估费用</span><strong>¥${totalCost}</strong></div>
        </section>
      </header>

      ${notice ? `<div class="notice ${notice.type}">${escapeHtml(notice.text)}</div>` : ""}

      <section class="layout">
        <aside class="side">
          <section class="panel weather ${halted ? "danger" : ""}">
            <h2>气象监控</h2>
            <div class="wind-meter">
              <strong>${state.windLevel}</strong>
              <span>级风 · 上限 ${WIND_LIMIT} 级</span>
            </div>
            <input id="wind" type="range" min="0" max="12" step="1" value="${state.windLevel}">
            <p class="hint">${halted ? "风力已达五级：全线立即停工，施工进度已冻结。风停后须逐单安全复查。" : "风力低于五级，可正常派工与施工。"}</p>
          </section>

          <section class="panel">
            <h2>施工队与防坠装备</h2>
            <div class="teams">${state.teams.map(renderTeam).join("")}</div>
          </section>

          <button class="ghost danger-ghost" id="reset">重置为预置数据</button>
        </aside>

        <section>
          <div class="toolbar">
            ${Object.entries(statuses)
              .map(([value, label]) => `<button class="seg ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`)
              .join("")}
          </div>
          <div class="orders">
            ${filteredOrders().length ? filteredOrders().map(renderOrder).join("") : `<div class="empty">当前状态下没有工单</div>`}
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
}

function renderTeam(team) {
  const busy = teamBusy(team, state.orders);
  const checks = validEquipmentChecks(team).length;
  return `
    <article class="team ${busy ? "busy" : ""}">
      <div class="row">
        <h3>${escapeHtml(team.name)}</h3>
        <span class="chip">${busy ? "在途作业" : "空闲"}</span>
        <span class="chip ${safetyOfficers(team).length ? "" : "warn"}">${SAFETY_ROLE} ${safetyOfficers(team).length} 名</span>
        <span class="chip ${checks >= REQUIRED_EQUIPMENT_CHECKS ? "" : "warn"}">装备检查 ${checks}/${REQUIRED_EQUIPMENT_CHECKS}</span>
      </div>
      <div class="members">
        ${team.members.map((member) => `<span class="member ${member.role === SAFETY_ROLE ? "safety" : ""}">${escapeHtml(member.name)} · ${member.role}</span>`).join("")}
      </div>
      <ul class="equipment">
        ${team.equipment
          .map((item) => {
            const last = item.checks[item.checks.length - 1];
            return `
              <li>
                <span class="eq-name">${escapeHtml(item.name)}</span>
                <span class="eq-check">${last ? `已检 ${item.checks.length} 次 · ${escapeHtml(last.inspector)} · ${formatTime(last.at)}` : "未检查"}</span>
                <button class="ghost" data-check-team="${team.id}" data-check-item="${item.id}">登记检查</button>
              </li>
            `;
          })
          .join("")}
      </ul>
    </article>
  `;
}

function renderOrder(order) {
  const team = state.teams.find((item) => item.id === order.teamId);
  const halted = windHalted(state.windLevel);
  return `
    <article class="order ${order.status}">
      <div class="content">
        <div class="row">
          <h3>${escapeHtml(order.location)}</h3>
          <span class="status ${order.status}">${statuses[order.status]}</span>
        </div>
        <p>${escapeHtml(order.title)}</p>
        <div class="row">
          <span class="chip">需 ${order.requiredWorkers} 名作业工</span>
          <span class="chip">预估 ¥${Number(order.cost || 0)}</span>
          <span class="chip">${team ? `施工队：${escapeHtml(team.name)}` : "未派队"}</span>
        </div>
        <div class="progress">
          <div class="track"><div class="bar" style="width:${order.progress}%"></div></div>
          <span>${order.progress}%</span>
        </div>
        ${order.status === "rejected" && order.rejectReason ? `<p class="reject-reason">拒绝原因：${escapeHtml(order.rejectReason)}</p>` : ""}
        <div class="actions">${renderActions(order, halted)}</div>
      </div>
    </article>
  `;
}

function renderActions(order, halted) {
  if (order.status === "pending") {
    return `
      <select data-team-select="${order.id}">
        ${state.teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("")}
      </select>
      <button class="primary" data-dispatch="${order.id}">派工</button>
    `;
  }
  if (order.status === "assigned") {
    return `
      <button class="primary" data-start="${order.id}" ${halted ? "disabled" : ""}>开工</button>
      <button class="ghost" data-unassign="${order.id}">撤回待派</button>
    `;
  }
  if (order.status === "working") {
    return `
      <button class="primary" data-progress="${order.id}">进度 +25%</button>
      ${order.progress >= 100 ? `<button class="primary" data-complete="${order.id}">完工验收</button>` : ""}
    `;
  }
  if (order.status === "halted") {
    return `<button class="primary" data-recheck="${order.id}" ${halted ? "disabled" : ""}>安全复查并复工</button>`;
  }
  return "";
}

function bindEvents() {
  document.querySelector("#wind").addEventListener("input", (event) => {
    state.windLevel = Number(event.target.value);
    if (windHalted(state.windLevel)) {
      let frozen = 0;
      state.orders.forEach((order) => {
        if (order.status === "working" && canTransition("working", "halted")) {
          order.status = "halted";
          frozen += 1;
        }
      });
      flash("warn", frozen ? `风力达到 ${WIND_LIMIT} 级：${frozen} 单立即停工，进度已冻结。` : `风力达到 ${WIND_LIMIT} 级，禁止新的开工。`);
    } else {
      flash("ok", "风力恢复正常，停工工单需逐单安全复查后方可复工。");
    }
    commit();
  });

  document.querySelector("#reset").addEventListener("click", () => {
    if (confirm("确定清空本地存档并恢复预置数据？")) {
      state = resetState();
      flash("ok", "已恢复预置数据。");
      commit();
    }
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      notice = null;
      commit();
    });
  });

  document.querySelectorAll("[data-check-team]").forEach((button) => {
    button.addEventListener("click", () => {
      const team = state.teams.find((item) => item.id === button.dataset.checkTeam);
      const item = team.equipment.find((eq) => eq.id === button.dataset.checkItem);
      const officer = safetyOfficers(team)[0];
      item.checks.push({ at: Date.now(), inspector: officer ? officer.name : "外聘检查员" });
      flash("ok", `${team.name} 已登记「${item.name}」防坠检查（第 ${item.checks.length} 次）。`);
      commit();
    });
  });

  document.querySelectorAll("[data-dispatch]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.dispatch);
      const select = document.querySelector(`[data-team-select="${order.id}"]`);
      const team = state.teams.find((item) => item.id === select.value);
      const result = evaluateDispatch(team, order, state.orders);

      if (result.verdict === "reject") {
        // 整单拒绝：人员、装备、工单数据均不改动，仅落拒绝状态
        if (canTransition(order.status, "rejected")) {
          order.status = "rejected";
          order.rejectReason = result.reasons.join("；");
        }
        flash("error", `${order.location} 整单拒绝：${result.reasons.join("；")}。`);
      } else if (result.verdict === "hold") {
        flash("warn", `${order.location} 保持待派：${result.reasons.join("；")}。`);
      } else if (canTransition(order.status, "assigned")) {
        order.status = "assigned";
        order.teamId = team.id;
        flash("ok", `${order.location} 已派给 ${team.name}。`);
      }
      commit();
    });
  });

  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.start);
      if (windHalted(state.windLevel)) {
        flash("error", `风力已达 ${WIND_LIMIT} 级，禁止开工。`);
      } else if (canTransition(order.status, "working")) {
        order.status = "working";
        flash("ok", `${order.location} 开工。`);
      }
      commit();
    });
  });

  document.querySelectorAll("[data-unassign]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.unassign);
      if (canTransition(order.status, "pending")) {
        order.status = "pending";
        order.teamId = null;
        flash("ok", `${order.location} 已撤回待派。`);
      }
      commit();
    });
  });

  document.querySelectorAll("[data-progress]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.progress);
      if (order.status !== "working" || windHalted(state.windLevel)) {
        flash("error", "停工状态下进度已冻结。");
      } else {
        order.progress = Math.min(100, order.progress + 25);
        flash("ok", `${order.location} 进度更新为 ${order.progress}%。`);
      }
      commit();
    });
  });

  document.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.complete);
      if (canTransition(order.status, "done")) {
        order.status = "done";
        flash("ok", `${order.location} 完工验收通过，施工队已释放。`);
      }
      commit();
    });
  });

  document.querySelectorAll("[data-recheck]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.recheck);
      if (windHalted(state.windLevel)) {
        flash("error", `风力仍达 ${WIND_LIMIT} 级，暂不能复工。`);
      } else {
        const team = state.teams.find((item) => item.id === order.teamId);
        const result = evaluateRecheck(team);
        if (result.verdict === "ok" && canTransition(order.status, "working")) {
          order.status = "working";
          flash("ok", `${order.location} 安全复查通过，恢复施工。`);
        } else {
          flash("error", `${order.location} 复查未通过：${result.reasons.join("；")}，继续停工待检。`);
        }
      }
      commit();
    });
  });
}

function filteredOrders() {
  if (state.filter === "all") return state.orders;
  return state.orders.filter((order) => order.status === state.filter);
}

function formatTime(at) {
  return new Date(at).toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

render();
