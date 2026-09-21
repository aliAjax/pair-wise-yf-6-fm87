// 流转状态：工单生命周期与允许的跳转，独立维护
export const ORDER_STATUS = {
  pending: "待派",
  assigned: "待开工",
  working: "施工中",
  suspended: "风力停工",
  done: "已完工"
};

export const STATUS_FILTERS = { all: "全部", ...ORDER_STATUS };

// 占用施工队的在途状态（同队不得同时承接两单的判定依据）
export const ACTIVE_STATUS = ["assigned", "working", "suspended"];

const TRANSITIONS = {
  pending: ["assigned"],
  assigned: ["working", "pending"],
  working: ["suspended", "done"],
  suspended: ["working"],
  done: []
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function addLog(order, text) {
  order.log.push({ time: Date.now(), text });
}

export function transition(order, to, text) {
  if (!canTransition(order.status, to)) return false;
  const from = ORDER_STATUS[order.status];
  order.status = to;
  addLog(order, text || `${from} → ${ORDER_STATUS[to]}`);
  return true;
}
