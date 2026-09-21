// 预置数据：三支施工队、四项外墙维修工单
export function seedState() {
  return {
    filter: "all",
    windLevel: 3,
    teams: [
      {
        id: "team-a",
        name: "磐石一队",
        members: [
          { id: "m-a1", name: "周岩", role: "安全员" },
          { id: "m-a2", name: "马东", role: "作业工" },
          { id: "m-a3", name: "吴强", role: "作业工" },
          { id: "m-a4", name: "郑凯", role: "作业工" }
        ],
        equipment: [
          { id: "eq-a1", name: "全身式安全带", checks: [{ at: Date.now() - 86400000, inspector: "周岩" }] },
          { id: "eq-a2", name: "防坠自锁器", checks: [{ at: Date.now() - 86400000, inspector: "周岩" }] },
          { id: "eq-a3", name: "高强度安全绳", checks: [] }
        ]
      },
      {
        id: "team-b",
        name: "凌云二队",
        members: [
          { id: "m-b1", name: "林岚", role: "安全员" },
          { id: "m-b2", name: "赵鹏", role: "作业工" },
          { id: "m-b3", name: "孙浩", role: "作业工" }
        ],
        equipment: [
          { id: "eq-b1", name: "全身式安全带", checks: [{ at: Date.now() - 43200000, inspector: "林岚" }] },
          { id: "eq-b2", name: "防坠自锁器", checks: [] }
        ]
      },
      {
        id: "team-c",
        name: "飞索三队",
        members: [
          { id: "m-c1", name: "何斌", role: "作业工" },
          { id: "m-c2", name: "罗成", role: "作业工" },
          { id: "m-c3", name: "高翔", role: "作业工" }
        ],
        equipment: [
          { id: "eq-c1", name: "全身式安全带", checks: [{ at: Date.now() - 21600000, inspector: "外聘检查员" }] },
          { id: "eq-c2", name: "防坠自锁器", checks: [{ at: Date.now() - 21600000, inspector: "外聘检查员" }] }
        ]
      }
    ],
    orders: [
      {
        id: "ord-1",
        location: "锦绣家园 3 栋",
        title: "外墙瓷砖脱落修补",
        requiredWorkers: 3,
        cost: 8600,
        progress: 0,
        status: "pending",
        teamId: null,
        rejectReason: ""
      },
      {
        id: "ord-2",
        location: "中央广场 B 座",
        title: "幕墙玻璃更换",
        requiredWorkers: 2,
        cost: 15200,
        progress: 0,
        status: "pending",
        teamId: null,
        rejectReason: ""
      },
      {
        id: "ord-3",
        location: "滨江写字楼",
        title: "外立面防水补漏",
        requiredWorkers: 4,
        cost: 12800,
        progress: 0,
        status: "pending",
        teamId: null,
        rejectReason: ""
      },
      {
        id: "ord-4",
        location: "老城商业街 12 号",
        title: "高空广告牌拆除",
        requiredWorkers: 2,
        cost: 6800,
        progress: 0,
        status: "pending",
        teamId: null,
        rejectReason: ""
      }
    ]
  };
}
