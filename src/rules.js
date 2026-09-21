// 业务规则：纯函数，先校验后落地，不直接修改状态
import { EQUIPMENT_CHECK_ITEMS } from "./data.js";
import { ACTIVE_STATUS } from "./flow.js";

export const WIND_STOP_LEVEL = 5;
export const REQUIRED_CHECKS = EQUIPMENT_CHECK_ITEMS.length;

const fail = (reason) => ({ ok: false, reason });

export function teamById(state, teamId) {
  return state.teams.find((team) => team.id === teamId) || null;
}

export function memberById(team, memberId) {
  if (!team) return null;
  return team.members.find((member) => member.id === memberId) || null;
}

export function safetyOfficers(team) {
  if (!team) return [];
  return team.members.filter((member) => member.role === "safety");
}

export function workersOf(team) {
  if (!team) return [];
  return team.members.filter((member) => member.role === "worker");
}

export function activeOrderOfTeam(state, teamId) {
  return state.orders.find((order) => order.teamId === teamId && ACTIVE_STATUS.includes(order.status)) || null;
}

export function isWindStopped(state) {
  return state.wind >= WIND_STOP_LEVEL;
}

export function workingOrders(state) {
  return state.orders.filter((order) => order.status === "working");
}

// 派工校验：安全员 + 两份防坠装备检查缺一不可，缺任一项整单拒绝，
// 人员、装备与工单保持原状（调用方在校验通过前不得改动任何数据）
export function validateDispatch(state, order, { teamId, safetyOfficerId, checks }) {
  if (!order || order.status !== "pending") return fail("工单不在待派状态");
  const team = teamById(state, teamId);
  if (!team) return fail("未选择施工队");
  const officer = memberById(team, safetyOfficerId);
  if (!officer || officer.role !== "safety") return fail("缺少安全员");
  const passed = (checks || []).filter(Boolean).length;
  if (passed < REQUIRED_CHECKS) return fail(`防坠装备检查不足 ${REQUIRED_CHECKS} 份（当前 ${passed} 份）`);
  if (activeOrderOfTeam(state, teamId)) return fail(`${team.name} 已有在途工单，同队不得同时承接两单`);
  const workers = workersOf(team).length;
  if (workers < order.requiredWorkers) return fail(`${team.name} 作业工 ${workers} 人，不足所需 ${order.requiredWorkers} 人`);
  return { ok: true, team, officer };
}

// 复工校验：天气恢复后须安全员现场确认并重新完成两份防坠装备检查
export function validateResume(state, order, { confirmed, checks }) {
  if (!order || order.status !== "suspended") return fail("工单不在停工状态");
  if (isWindStopped(state)) return fail(`风力仍有 ${state.wind} 级，未恢复到安全条件`);
  if (!confirmed) return fail("需安全员现场确认天气恢复");
  const passed = (checks || []).filter(Boolean).length;
  if (passed < REQUIRED_CHECKS) return fail(`复工前须重新完成 ${REQUIRED_CHECKS} 份防坠装备检查`);
  return { ok: true };
}

// 费用预估：按进度折算已发生费用
export function incurredCost(order) {
  return Math.round((Number(order.estimate) || 0) * (order.progress / 100));
}

export function openEstimate(state) {
  return state.orders.filter((order) => order.status !== "done").reduce((sum, order) => sum + (Number(order.estimate) || 0), 0);
}

export function totalIncurred(state) {
  return state.orders.reduce((sum, order) => sum + incurredCost(order), 0);
}
