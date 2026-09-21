// 业务规则：派工门槛、风力停工、安全复查（纯函数，不碰界面与存档）
import { activeStatuses } from "./flow.js";

export const WIND_LIMIT = 5;
export const REQUIRED_EQUIPMENT_CHECKS = 2;
export const SAFETY_ROLE = "安全员";

export function safetyOfficers(team) {
  return team.members.filter((member) => member.role === SAFETY_ROLE);
}

export function workerCount(team) {
  return team.members.filter((member) => member.role !== SAFETY_ROLE).length;
}

export function validEquipmentChecks(team) {
  return team.equipment.filter((item) => item.checks.length > 0);
}

export function teamBusy(team, orders) {
  return orders.some((order) => order.teamId === team.id && activeStatuses.includes(order.status));
}

// 安全底线：缺安全员或防坠装备检查不足两份 → 整单拒绝
function safetyFailures(team) {
  const failures = [];
  if (safetyOfficers(team).length === 0) failures.push("缺少安全员");
  const checks = validEquipmentChecks(team).length;
  if (checks < REQUIRED_EQUIPMENT_CHECKS) {
    failures.push(`防坠装备检查不足（${checks}/${REQUIRED_EQUIPMENT_CHECKS} 份）`);
  }
  return failures;
}

// 派工评估：reject 整单拒绝；hold 保持待派；ok 允许派工
export function evaluateDispatch(team, order, orders) {
  const fatal = safetyFailures(team);
  if (fatal.length) return { verdict: "reject", reasons: fatal };

  const shortage = [];
  if (teamBusy(team, orders)) shortage.push("该队已有在途工单，不得同时承接两单");
  if (workerCount(team) < order.requiredWorkers) {
    shortage.push(`作业人员不足（${workerCount(team)}/${order.requiredWorkers} 人）`);
  }
  if (shortage.length) return { verdict: "hold", reasons: shortage };

  return { verdict: "ok", reasons: [] };
}

// 天气恢复后的重新检查：同样卡安全底线
export function evaluateRecheck(team) {
  const failures = safetyFailures(team);
  return failures.length ? { verdict: "hold", reasons: failures } : { verdict: "ok", reasons: [] };
}

export function windHalted(windLevel) {
  return Number(windLevel) >= WIND_LIMIT;
}
