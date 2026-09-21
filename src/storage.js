// 浏览器存档：localStorage 读写，与业务规则、流转状态分离
import { STORAGE_KEY, seedState } from "./data.js";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("本地存档读取失败，回退到预置数据", error);
  }
  return seedState();
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return Date.now();
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return seedState();
}
