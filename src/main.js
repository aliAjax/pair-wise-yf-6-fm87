import "./styles.css";
import { EQUIPMENT_CHECK_ITEMS } from "./data.js";
import { ORDER_STATUS, STATUS_FILTERS, transition, addLog } from "./flow.js";
import {
  WIND_STOP_LEVEL,
  REQUIRED_CHECKS,
  teamById,
  memberById,
  safetyOfficers,
  activeOrderOfTeam,
  isWindStopped,
  workingOrders,
  validateDispatch,
  validateResume,
  incurredCost,
  openEstimate,
  totalIncurred
} from "./rules.js";
import { loadState, saveState, resetState } from "./storage.js";

let state = loadState();
let lastSaved = null;
const notices = {}; // 瞬态提示：拒绝原因只展示、不写入存档，工单保持原状

const app = document.querySelector("#app");
const CHECK_MARKS = ["①", "②"];
const WIND_LEVELS = [1, 2, 3, 4, 5, 6];

function commit() {
  lastSaved = saveState(state);
  render();
}

function render() {
  const orders = filteredOrders();
  const count = (status) => state.orders.filter((order) => order.status === status).length;
  const windStopped = isWindStopped(state);

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">高空外墙施工 · 派工台</p>
          <h1>外墙施工派工台</h1>
        </div>
        <section class="stats">
          <div class="stat"><span>待派工单</span><strong>${count("pending")}</strong></div>
          <div class="stat"><span>施工中</span><strong>${count("working")}</strong></div>
          <div class="stat"><span>风力停工</span><strong>${count("suspended")}</strong></div>
          <div class="stat"><span>预估费用(未完)</span><strong>¥${openEstimate(state)}</strong></div>
          <div class="stat"><span>已发生费用</span><strong>¥${totalIncurred(state)}</strong></div>
        </section>
      </header>

      ${windStopped ? `<div class="banner">风力 ${state.wind} 级，达到 ${WIND_STOP_LEVEL} 级停工标准：全线立即停工，进度已冻结。天气恢复后须重新检查方可复工。</div>` : ""}

      <section class="panel weather">
        <div>
          <h2>天气监控</h2>
          <p class="hint">风力达到 ${WIND_STOP_LEVEL} 级立即停工并冻结进度；恢复后须安全员现场确认并重新完成 ${REQUIRED_CHECKS} 份防坠装备检查。</p>
        </div>
        <div class="wind-picker">
          ${WIND_LEVELS.map((level) => `<button class="wind ${state.wind === level ? "active" : ""} ${level >= WIND_STOP_LEVEL ? "danger" : ""}" data-wind="${level}">${level}级</button>`).join("")}
        </div>
      </section>

      <section class="layout">
        <aside class="side">
          <div class="panel">
            <h2>施工队（${state.teams.length} 支）</h2>
            ${state.teams.map(renderTeam).join("")}
          </div>

          <div class="panel">
            <h2>新增维修工单</h2>
            <form class="form" id="order-form">
              <label>楼栋位置<input name="location" required placeholder="例如 4号楼西立面"></label>
              <label>维修内容<textarea name="title" required placeholder="例如 外墙涂料翻新"></textarea></label>
              <label>作业楼层<input name="floors" required placeholder="例如 6-10层"></label>
              <label>所需作业工<input name="requiredWorkers" type="number" min="1" step="1" value="2" required></label>
              <label>预估费用<input name="estimate" type="number" min="0" step="100" value="5000"></label>
              <button class="primary" type="submit">登记工单（进入待派）</button>
            </form>
          </div>

          <div class="panel">
            <h2>本地数据同步</h2>
            <p class="hint">${lastSaved ? `已同步到浏览器存档 · 最后保存 ${fmtTime(lastSaved)}` : "每次变更自动写入浏览器存档，刷新保留。"}</p>
            <button class="ghost" id="reset">重置为预置数据</button>
          </div>
        </aside>

        <section>
          <div class="toolbar">
            ${Object.entries(STATUS_FILTERS).map(([value, label]) => `<button class="seg ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`).join("")}
          </div>
          <div class="orders">
            ${orders.length ? orders.map(renderOrder).join("") : `<div class="empty">当前状态下没有工单</div>`}
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
}

function renderTeam(team) {
  const active = activeOrderOfTeam(state, team.id);
  const statusClass = !active ? "free" : active.status === "suspended" ? "suspended" : "busy";
  const statusText = !active ? "空闲可派" : active.status === "suspended" ? "停工待复" : "作业中";
  return `
    <div class="team">
      <div class="row">
        <strong>${team.name}</strong>
        <span class="team-status ${statusClass}">${statusText}${active ? `：${escapeHtml(active.location)}` : ""}</span>
      </div>
      <p class="meta">${team.members.map((member) => `${member.name}（${member.role === "safety" ? "安全员" : "作业工"}）`).join("、")}</p>
      <p class="meta">防坠装备：${team.equipment.join("、")}</p>
    </div>
  `;
}

function renderOrder(order) {
  const team = teamById(state, order.teamId);
  const officer = memberById(team, order.safetyOfficerId);
  const notice = notices[order.id];
  return `
    <article class="order ${order.status}">
      <div class="order-head">
        <div>
          <h3>${escapeHtml(order.location)} · ${escapeHtml(order.title)}</h3>
          <p class="meta">${escapeHtml(order.floors)} ｜ 需作业工 ${order.requiredWorkers} 人 ｜ 预估 ¥${order.estimate}</p>
        </div>
        <span class="status ${order.status}">${ORDER_STATUS[order.status]}</span>
      </div>
      <div class="progress"><i style="width:${order.progress}%"></i></div>
      <div class="row">
        <span class="chip">进度 ${order.progress}%</span>
        <span class="chip">已发生 ¥${incurredCost(order)}</span>
        <span class="chip">防坠检查 ${order.checks.length} 份</span>
        ${team ? `<span class="chip">${team.name} ｜ 安全员 ${officer ? officer.name : "-"}</span>` : `<span class="chip">未派工</span>`}
      </div>
      ${notice ? `<p class="notice ${notice.type}">${escapeHtml(notice.text)}</p>` : ""}
      ${renderOrderBody(order)}
      <ul class="log">
        ${order.log.slice(-4).reverse().map((entry) => `<li><time>${fmtTime(entry.time)}</time>${escapeHtml(entry.text)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderOrderBody(order) {
  if (order.status === "pending") return renderDispatchForm(order);
  if (order.status === "assigned") {
    const blocked = isWindStopped(state);
    return `
      <div class="actions">
        <button class="primary" data-start="${order.id}" ${blocked ? "disabled" : ""}>${blocked ? "风力过大，禁止开工" : "开工"}</button>
        <button class="ghost" data-withdraw="${order.id}">撤回派工</button>
      </div>`;
  }
  if (order.status === "working") {
    return `
      <div class="actions">
        <button class="primary" data-progress="${order.id}">推进进度 +10%</button>
      </div>`;
  }
  if (order.status === "suspended") {
    if (isWindStopped(state)) {
      return `<p class="hint">风力 ${state.wind} 级，停工中，进度冻结于 ${order.progress}%。等待天气恢复。</p>`;
    }
    return `
      <form class="dispatch" data-resume="${order.id}">
        <label class="check"><input type="checkbox" name="confirmed"> 安全员现场确认天气恢复、具备复工条件</label>
        ${EQUIPMENT_CHECK_ITEMS.map((item, index) => `<label class="check"><input type="checkbox" name="check${index}"> 复工复检${CHECK_MARKS[index]}：${item}</label>`).join("")}
        <button class="primary" type="submit">复检复工（进度从 ${order.progress}% 继续）</button>
      </form>`;
  }
  return `
    <div class="actions">
      <button class="ghost" data-delete="${order.id}">删除归档</button>
    </div>`;
}

function renderDispatchForm(order) {
  return `
    <form class="dispatch" data-dispatch="${order.id}">
      <div class="dispatch-grid">
        <select name="teamId" data-team-for="${order.id}">
          <option value="">选择施工队</option>
          ${state.teams.map((team) => `<option value="${team.id}">${team.name}${activeOrderOfTeam(state, team.id) ? "（在途）" : ""}</option>`).join("")}
        </select>
        <select name="safetyOfficerId" data-officer-for="${order.id}">
          <option value="">选择安全员（先选施工队）</option>
        </select>
      </div>
      ${EQUIPMENT_CHECK_ITEMS.map((item, index) => `<label class="check"><input type="checkbox" name="check${index}"> 防坠装备检查${CHECK_MARKS[index]}：${item}</label>`).join("")}
      <div class="actions">
        <button class="primary" type="submit">派工（须安全员 + ${REQUIRED_CHECKS} 份检查）</button>
        <button class="ghost" type="button" data-delete="${order.id}">删除工单</button>
      </div>
    </form>`;
}

function bindEvents() {
  document.querySelectorAll("[data-wind]").forEach((button) => {
    button.addEventListener("click", () => setWind(Number(button.dataset.wind)));
  });

  document.querySelector("#order-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.orders.unshift({
      id: crypto.randomUUID(),
      location: data.location.trim(),
      title: data.title.trim(),
      floors: data.floors.trim(),
      requiredWorkers: Number(data.requiredWorkers),
      estimate: Number(data.estimate || 0),
      progress: 0,
      status: "pending",
      teamId: null,
      safetyOfficerId: null,
      checks: [],
      log: [{ time: Date.now(), text: "工单登记，等待派工" }]
    });
    commit();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      commit();
    });
  });

  document.querySelectorAll("[data-team-for]").forEach((select) => {
    select.addEventListener("change", () => syncOfficers(select));
  });

  document.querySelectorAll("[data-dispatch]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      dispatchOrder(form);
    });
  });

  document.querySelectorAll("[data-resume]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      resumeOrder(form);
    });
  });

  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = findOrder(button.dataset.start);
      if (isWindStopped(state)) return;
      transition(order, "working", "现场开工");
      commit();
    });
  });

  document.querySelectorAll("[data-withdraw]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = findOrder(button.dataset.withdraw);
      if (transition(order, "pending", "撤回派工，恢复待派")) {
        order.teamId = null;
        order.safetyOfficerId = null;
        order.checks = [];
        commit();
      }
    });
  });

  document.querySelectorAll("[data-progress]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = findOrder(button.dataset.progress);
      if (order.status !== "working" || isWindStopped(state)) return;
      order.progress = Math.min(100, order.progress + 10);
      if (order.progress >= 100) {
        transition(order, "done", "进度 100%，完工验收，施工队释放");
      } else {
        addLog(order, `进度推进至 ${order.progress}%`);
      }
      commit();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.orders = state.orders.filter((order) => order.id !== button.dataset.delete);
      commit();
    });
  });

  document.querySelector("#reset").addEventListener("click", () => {
    state = resetState();
    commit();
  });
}

// 派工：先校验后落地；缺任一项整单拒绝，人员、装备与工单保持原状
function dispatchOrder(form) {
  const order = findOrder(form.dataset.dispatch);
  const data = new FormData(form);
  const payload = {
    teamId: data.get("teamId"),
    safetyOfficerId: data.get("safetyOfficerId"),
    checks: EQUIPMENT_CHECK_ITEMS.map((_, index) => data.get(`check${index}`) === "on")
  };
  const result = validateDispatch(state, order, payload);
  if (!result.ok) {
    notices[order.id] = { type: "error", text: `派工被拒绝：${result.reason}。人员、装备与工单保持原状。` };
    render();
    return;
  }
  order.teamId = result.team.id;
  order.safetyOfficerId = result.officer.id;
  order.checks = EQUIPMENT_CHECK_ITEMS.map((item) => ({ item, time: Date.now(), round: "派工" }));
  transition(order, "assigned", `派工至${result.team.name}，安全员${result.officer.name}，防坠装备检查 ${REQUIRED_CHECKS}/${REQUIRED_CHECKS}`);
  delete notices[order.id];
  commit();
}

// 风力变化：达到五级立即停工并冻结进度；恢复后不自动复工，须重新检查
function setWind(level) {
  state.wind = level;
  if (isWindStopped(state)) {
    workingOrders(state).forEach((order) => {
      transition(order, "suspended", `风力 ${level} 级达到停工标准，立即停工，进度冻结于 ${order.progress}%`);
    });
  }
  commit();
}

// 复工：天气恢复后重新检查，通过才放行
function resumeOrder(form) {
  const order = findOrder(form.dataset.resume);
  const data = new FormData(form);
  const payload = {
    confirmed: data.get("confirmed") === "on",
    checks: EQUIPMENT_CHECK_ITEMS.map((_, index) => data.get(`check${index}`) === "on")
  };
  const result = validateResume(state, order, payload);
  if (!result.ok) {
    notices[order.id] = { type: "error", text: `复工被拒绝：${result.reason}。` };
    render();
    return;
  }
  order.checks.push(...EQUIPMENT_CHECK_ITEMS.map((item) => ({ item, time: Date.now(), round: "复工复检" })));
  transition(order, "working", `天气恢复，复检通过（防坠装备检查 ${REQUIRED_CHECKS}/${REQUIRED_CHECKS}），进度从 ${order.progress}% 继续`);
  delete notices[order.id];
  commit();
}

function syncOfficers(teamSelect) {
  const officerSelect = document.querySelector(`[data-officer-for="${teamSelect.dataset.teamFor}"]`);
  const team = teamById(state, teamSelect.value);
  const options = safetyOfficers(team)
    .map((member) => `<option value="${member.id}">${member.name}（安全员）</option>`)
    .join("");
  officerSelect.innerHTML = `<option value="">选择安全员</option>${options}`;
}

function findOrder(id) {
  return state.orders.find((order) => order.id === id);
}

function filteredOrders() {
  if (state.filter === "all") return state.orders;
  return state.orders.filter((order) => order.status === state.filter);
}

function fmtTime(time) {
  return new Date(time).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

render();
