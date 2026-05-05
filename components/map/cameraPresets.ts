export type MapMode = "monitor-home" | "global" | "socmint";

export interface CameraPreset {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const BASE_HOME_CAMERA: CameraPreset = {
  center: [39.0, 27.4],
  zoom: 2.16,
  bearing: 0,
  pitch: 0,
};

export const MONITOR_HOME_CAMERA: CameraPreset = { ...BASE_HOME_CAMERA };
export const GLOBAL_VIEW_CAMERA: CameraPreset = {
  ...BASE_HOME_CAMERA,
  zoom: 2.06,
};
export const SOCMINT_WATCH_CAMERA: CameraPreset = {
  ...BASE_HOME_CAMERA,
  zoom: 2.08,
};

export const ZERO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };
const GLOBAL_VIEW_PADDING: MapPadding = { top: 0, right: 390, bottom: 0, left: 238 };
const SOCMINT_WATCH_PADDING: MapPadding = { top: 0, right: 372, bottom: 0, left: 246 };

export const CAMERA_TOLERANCE = {
  lng: 0.015,
  lat: 0.015,
  zoom: 0.01,
  bearing: 0.1,
  pitch: 0.1,
};

export function cameraForMode(mode: MapMode): CameraPreset {
  switch (mode) {
    case "global":
      return GLOBAL_VIEW_CAMERA;
    case "socmint":
      return SOCMINT_WATCH_CAMERA;
    default:
      return MONITOR_HOME_CAMERA;
  }
}

export function paddingForMode(mode: MapMode): MapPadding {
  switch (mode) {
    case "global":
      return GLOBAL_VIEW_PADDING;
    case "socmint":
      return SOCMINT_WATCH_PADDING;
    default:
      return ZERO_PADDING;
  }
}

function angleDelta(a: number, b: number) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

export function cameraEquals(
  current: { lng: number; lat: number; zoom: number; bearing: number; pitch: number },
  preset: CameraPreset,
): boolean {
  return (
    Math.abs(current.lng - preset.center[0]) <= CAMERA_TOLERANCE.lng &&
    Math.abs(current.lat - preset.center[1]) <= CAMERA_TOLERANCE.lat &&
    Math.abs(current.zoom - preset.zoom) <= CAMERA_TOLERANCE.zoom &&
    angleDelta(current.bearing, preset.bearing) <= CAMERA_TOLERANCE.bearing &&
    Math.abs(current.pitch - preset.pitch) <= CAMERA_TOLERANCE.pitch
  );
}

export function paddingEquals(
  current: { top?: number; right?: number; bottom?: number; left?: number },
  padding: MapPadding,
): boolean {
  return (
    (current.top ?? 0) === padding.top &&
    (current.right ?? 0) === padding.right &&
    (current.bottom ?? 0) === padding.bottom &&
    (current.left ?? 0) === padding.left
  );
}
