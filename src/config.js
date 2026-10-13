// 全局常量：地图尺寸、2.5D 投影、阵营与节奏参数

export const WORLD = { w: 2600, h: 1040 };
// 可行走区域（世界坐标，地面平面）
export const BOUNDS = { x0: 70, x1: 2530, y0: 180, y1: 860 };
// 地面平面 y 轴投影到屏幕时的压缩比例，营造斜俯视的 2.5D 观感
export const YS = 0.62;
export const LANE_Y = 520;

export const BLUE = 0;
export const RED = 1;
export const TEAM_COLORS = ['#4fb0ff', '#ff4d5e'];
export const TEAM_NAMES = ['蓝方', '红方'];

export const SPAWN = [
  { x: 150, y: LANE_Y - 100 },
  { x: WORLD.w - 150, y: LANE_Y + 100 },
];
export const FOUNTAIN_R = 230;
export const RESPAWN_BASE = 6;

export const FIRST_WAVE = 4;
export const WAVE_INTERVAL = 25;
export const WAVE_SIZE = 4;

// 以地图中心点对称，保证双方地形公平
export const mirror = (x, y) => ({ x: WORLD.w - x, y: WORLD.h - y });

export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",system-ui,sans-serif';
