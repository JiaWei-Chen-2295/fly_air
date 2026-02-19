import * as THREE from "three";

export function smooth(from, to, value) {
  return THREE.MathUtils.smoothstep(value, from, to);
}

export function pulseWindow(value, start, end) {
  const rise = smooth(start, (start + end) * 0.5, value);
  const fall = 1 - smooth((start + end) * 0.5, end, value);
  return Math.max(0, rise * fall * 4);
}

export function gaussianPulse(phase, center, width) {
  const d = (phase - center) / Math.max(width, 0.0001);
  return Math.exp(-d * d);
}
