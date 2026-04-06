/**
 * 详情抽屉内「OI+名义价值」与「多空比三轨」共用布局，
 * 避免左右 Y 轴占位不同导致时间轴/绘图区无法上下对齐。
 */
export const DRAWER_CHART_MARGIN_OI = {
  top: 8,
  right: 4,
  left: 4,
  bottom: 8,
} as const

/** 左轴：持仓量 / 多空比（与 OI 图左轴同宽） */
export const DRAWER_Y_LEFT_W = 52
/** 右轴：名义价值 USD（OI 图专用；多空比用 margin 模拟同宽） */
export const DRAWER_Y_RIGHT_W = 58

/** 多空比单左轴 + 右侧用 margin 顶替「右 Y 轴」占位 */
export const DRAWER_CHART_MARGIN_RATIO = {
  ...DRAWER_CHART_MARGIN_OI,
  right: DRAWER_CHART_MARGIN_OI.right + DRAWER_Y_RIGHT_W,
} as const

export const DRAWER_X_MIN_TICK_GAP = 40
