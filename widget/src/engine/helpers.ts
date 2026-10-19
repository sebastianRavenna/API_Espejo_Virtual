import * as THREE from 'three';

/** Landmarks in video pixels: [x, y, z], z scaled like x. */
export type Points = number[][];

export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
}

/** Clamp value between lo and hi. */
export function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

/** Convert landmark pixel coords to negated Three.js Vector3. */
export function toV(pts: Points, i: number): THREE.Vector3 {
    return new THREE.Vector3(-pts[i][0], -pts[i][1], -pts[i][2]);
}

/** Midpoint of two Vector3s. */
export function mid(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
    return a.clone().add(b).multiplyScalar(0.5);
}

/** Midpoint between inner and outer eye landmarks. */
export function eyeMid(pts: Points, inner: number, outer: number): THREE.Vector3 {
    return mid(toV(pts, inner), toV(pts, outer));
}

/** Angular delta between two quaternions (radians). */
export function qDelta(a: THREE.Quaternion, b: THREE.Quaternion): number {
    return 2 * Math.acos(clamp(Math.abs(a.dot(b)), 0, 1));
}

/** Convert normalized MediaPipe landmarks to pixel coordinates. */
export function toPixels(landmarks: NormalizedLandmark[], video: HTMLVideoElement): Points {
    const w = video.videoWidth, h = video.videoHeight;
    return landmarks.map((l) => [l.x * w, l.y * h, l.z * w]);
}

/** Median of the samples, or the fallback when there are none. */
export function median(samples: number[], fallback: number): number {
    if (!samples.length) return fallback;
    const sorted = samples.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/** Value at fraction q (0–1) of the sorted samples. */
export function quantile(samples: number[], q: number): number {
    const sorted = samples.slice().sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * q)];
}
