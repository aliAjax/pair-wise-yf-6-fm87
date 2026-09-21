// 浏览器存档：localStorage 读写与重置
import { seedState } from "./data.js";

const STORAGE_KEY = "zfl-14-dispatch-v1";

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("存档读取失败，使用预置数据", error);
  }
  return seedState();
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return seedState();
}
