// 全局常量：地牢地图尺寸、2.5D 投影、阵营与节奏参数

export const TILE = 80;
export const GRID_W = 72;
export const GRID_H = 40;
export const WORLD = { w: TILE * GRID_W, h: TILE * GRID_H };
// 地面平面 y 轴投影到屏幕时的压缩比例，营造斜俯视的 2.5D 观感
export const YS = 0.62;
// 地牢墙体在屏幕上的高度（投影单位）
export const WALL_H = 74;

export const BLUE = 0;
export const RED = 1;
export const NEUTRAL = 2;
export const TEAM_COLORS = ['#4fb0ff', '#ff4d5e', '#c9b07a'];
export const TEAM_NAMES = ['蓝方', '红方', '中立'];

// 以地图中心点对称，保证双方地形公平
export const mirror = (x, y) => ({ x: WORLD.w - x, y: WORLD.h - y });

export const SPAWN = [{ x: 200, y: 1280 }, mirror(200, 1280)];
export const FOUNTAIN_R = 230;
export const RESPAWN_BASE = 8;

export const FIRST_WAVE = 6;
export const WAVE_INTERVAL = 30;
export const RECALL_TIME = 4;

export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",system-ui,sans-serif';
