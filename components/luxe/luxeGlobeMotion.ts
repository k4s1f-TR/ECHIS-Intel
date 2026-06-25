export type MotionPoint = {
  x: number;
  y: number;
};

export type MotionSample = MotionPoint & {
  time: number;
};

export type PanInertia = MotionPoint & {
  durationMs: number;
};

export type WheelInputType = "wheel" | "trackpad";

export type WheelEaseState = {
  startAt: number;
  durationMs: number;
  easing: (t: number) => number;
};

const INERTIA_WINDOW_MS = 160;
const PAN_LINEARITY = 0.3;
const PAN_DECELERATION = 2500;
const PAN_MAX_SPEED = 1400;
const WHEEL_ZOOM_DELTA = 4.000244140625;
const TRACKPAD_ZOOM_RATE = 1 / 100;
const WHEEL_ZOOM_RATE = 1 / 450;
const MAX_SCALE_PER_FRAME = 2;
export const WHEEL_CLASSIFICATION_IDLE_MS = 400;
export const WHEEL_CLASSIFICATION_DELAY_MS = 40;
export const WHEEL_ZOOM_EASE_MS = 200;
export const WHEEL_ZOOM_TIME_ADJUSTMENT_MS = 5;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (value: number) => {
    const x = clamp(value, 0, 1);
    let estimate = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(estimate) - x;
      if (Math.abs(error) < 1e-6) return sampleY(estimate);
      const derivative = sampleDerivativeX(estimate);
      if (Math.abs(derivative) < 1e-6) break;
      estimate -= error / derivative;
    }

    let low = 0;
    let high = 1;
    estimate = x;
    for (let i = 0; i < 20; i += 1) {
      const sampled = sampleX(estimate);
      if (Math.abs(sampled - x) < 1e-6) break;
      if (sampled < x) low = estimate;
      else high = estimate;
      estimate = (low + high) / 2;
    }
    return sampleY(estimate);
  };
}

export const mapEase = createCubicBezier(0.25, 0.1, 0.25, 1);
export const panInertiaEase = createCubicBezier(0, 0, 0.3, 1);

export function trimMotionSamples(
  samples: MotionSample[],
  now: number,
): MotionSample[] {
  const cutoff = now - INERTIA_WINDOW_MS;
  return samples.filter((sample) => sample.time >= cutoff);
}

export function calculatePanInertia(samples: MotionSample[]): PanInertia | null {
  if (samples.length < 2) return null;

  const durationMs = samples[samples.length - 1].time - samples[0].time;
  if (durationMs <= 0) return null;

  const total = samples.reduce(
    (sum, sample) => ({ x: sum.x + sample.x, y: sum.y + sample.y }),
    { x: 0, y: 0 },
  );
  const amount = Math.hypot(total.x, total.y);
  if (amount === 0) return null;

  const speed = clamp(
    (amount * PAN_LINEARITY) / (durationMs / 1000),
    -PAN_MAX_SPEED,
    PAN_MAX_SPEED,
  );
  const inertiaDurationS =
    Math.abs(speed) / (PAN_DECELERATION * PAN_LINEARITY);
  const inertiaAmount = speed * (inertiaDurationS / 2);
  const scale = inertiaAmount / amount;

  return {
    x: total.x * scale,
    y: total.y * scale,
    durationMs: inertiaDurationS * 1000,
  };
}

export function normalizeWheelDelta(event: {
  deltaY: number;
  deltaMode: number;
  shiftKey: boolean;
}): number {
  let value = event.deltaY;
  if (event.deltaMode === 1) value *= 40;
  else if (event.deltaMode === 2) value *= 800;
  if (event.shiftKey) value /= 4;
  return value;
}

export function classifyWheelInput(
  value: number,
  timeDeltaMs: number,
  currentType: WheelInputType | null,
): WheelInputType | null {
  if (value !== 0 && value % WHEEL_ZOOM_DELTA === 0) return "wheel";
  if (value !== 0 && Math.abs(value) < 4) return "trackpad";
  if (timeDeltaMs > WHEEL_CLASSIFICATION_IDLE_MS) return null;
  if (currentType) return currentType;
  return Math.abs(timeDeltaMs * value) < 200 ? "trackpad" : "wheel";
}

export function wheelDeltaToZoomDelta(
  value: number,
  type: WheelInputType,
): number {
  if (value === 0) return 0;
  const accumulatedDelta = -value;
  const rate =
    type === "wheel" && Math.abs(accumulatedDelta) > WHEEL_ZOOM_DELTA
      ? WHEEL_ZOOM_RATE
      : TRACKPAD_ZOOM_RATE;
  let scale =
    MAX_SCALE_PER_FRAME /
    (1 + Math.exp(-Math.abs(accumulatedDelta * rate)));
  if (accumulatedDelta < 0 && scale !== 0) scale = 1 / scale;
  return Math.log2(scale);
}

export function createContinuousWheelEasing(
  previous: WheelEaseState | null,
  now: number,
  durationMs = WHEEL_ZOOM_EASE_MS,
): WheelEaseState {
  let easing = mapEase;
  if (previous) {
    const t = (now - previous.startAt) / previous.durationMs;
    const speed =
      previous.easing(t + 0.01) - previous.easing(t);
    const x =
      (0.27 / Math.sqrt(speed * speed + 0.0001)) * 0.01;
    const y = Math.sqrt(Math.max(0, 0.27 * 0.27 - x * x));
    easing = createCubicBezier(x, y, 0.25, 1);
  }
  return { startAt: now, durationMs, easing };
}

export function cameraDistanceForZoom(
  zoom: number,
  defaultZoom: number,
  defaultDistance: number,
  minDistance: number,
  maxDistance: number,
): number {
  return clamp(
    defaultDistance / 2 ** (zoom - defaultZoom),
    minDistance,
    maxDistance,
  );
}

export function zoomForCameraDistance(
  distance: number,
  defaultZoom: number,
  defaultDistance: number,
): number {
  return defaultZoom + Math.log2(defaultDistance / distance);
}

export function radiansPerPixel(
  cameraDistance: number,
  verticalFovRadians: number,
  viewportHeight: number,
): number {
  const surfaceDepth = Math.max(0.1, cameraDistance - 1);
  return (
    (2 * Math.tan(verticalFovRadians / 2) * surfaceDepth) /
    Math.max(1, viewportHeight)
  );
}
