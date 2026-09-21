// 流转状态：工单状态机定义与迁移守卫
export const statuses = {
  all: "全部",
  pending: "待派",
  assigned: "已派工",
  working: "施工中",
  halted: "停工待检",
  done: "已完工",
  rejected: "已拒绝"
};

// 在途状态：占用施工队，且会被风力停工影响
export const activeStatuses = ["assigned", "working", "halted"];

export const transitions = {
  pending: ["assigned", "rejected"],
  assigned: ["working", "pending", "halted"],
  working: ["halted", "done"],
  halted: ["working"],
  done: [],
  rejected: []
};

export function canTransition(from, to) {
  return (transitions[from] || []).includes(to);
}
