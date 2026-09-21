export const STORAGE_KEY = "zfl-14-wall-dispatch";

// 每单必须完成的两份防坠装备检查
export const EQUIPMENT_CHECK_ITEMS = ["全身式安全带检查", "安全绳与速差防坠器检查"];

export function seedState() {
  return {
    wind: 3,
    filter: "all",
    teams: [
      {
        id: "team-a",
        name: "凌云一队",
        members: [
          { id: "m-a1", name: "赵安", role: "safety" },
          { id: "m-a2", name: "王强", role: "worker" },
          { id: "m-a3", name: "李军", role: "worker" },
          { id: "m-a4", name: "周杰", role: "worker" }
        ],
        equipment: ["全身式安全带 ×4", "独立安全绳 ×2", "速差防坠器 ×2"]
      },
      {
        id: "team-b",
        name: "磐石二队",
        members: [
          { id: "m-b1", name: "钱守", role: "safety" },
          { id: "m-b2", name: "吴磊", role: "worker" },
          { id: "m-b3", name: "郑浩", role: "worker" }
        ],
        equipment: ["全身式安全带 ×3", "独立安全绳 ×2", "速差防坠器 ×1"]
      },
      {
        id: "team-c",
        name: "飞虹三队",
        members: [
          { id: "m-c1", name: "孙谨", role: "safety" },
          { id: "m-c2", name: "冯涛", role: "worker" },
          { id: "m-c3", name: "陈林", role: "worker" },
          { id: "m-c4", name: "何峰", role: "worker" },
          { id: "m-c5", name: "高山", role: "worker" }
        ],
        equipment: ["全身式安全带 ×5", "独立安全绳 ×3", "速差防坠器 ×2"]
      }
    ],
    orders: [
      makeOrder("wo-1", "3号楼东立面", "外墙瓷砖空鼓修补", "12-18层", 2, 6800),
      makeOrder("wo-2", "5号楼南立面", "幕墙玻璃更换", "8-11层", 3, 15800),
      makeOrder("wo-3", "2号楼西侧", "外墙渗漏水维修", "5-9层", 2, 5200),
      makeOrder("wo-4", "1号楼北面", "保温层脱落修复", "15-22层", 4, 19400)
    ]
  };
}

function makeOrder(id, location, title, floors, requiredWorkers, estimate) {
  return {
    id,
    location,
    title,
    floors,
    requiredWorkers,
    estimate,
    progress: 0,
    status: "pending",
    teamId: null,
    safetyOfficerId: null,
    checks: [],
    log: [{ time: Date.now(), text: "工单登记，等待派工" }]
  };
}
