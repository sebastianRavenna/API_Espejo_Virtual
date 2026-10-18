import * as THREE from 'three';

/** Clamp value between lo and hi. */
export function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

/** Convert landmark pixel coords to negated Three.js Vector3. */
export function toV(pts, i) {
    return new THREE.Vector3(-pts[i][0], -pts[i][1], -pts[i][2]);
}

/** Midpoint of two Vector3s. */
export function mid(a, b) {
    return a.clone().add(b).multiplyScalar(0.5);
}

/** Midpoint between inner and outer eye landmarks. */
export function eyeMid(pts, inner, outer) {
    return mid(toV(pts, inner), toV(pts, outer));
}

/** Angular delta between two quaternions (radians). */
export function qDelta(a, b) {
    return 2 * Math.acos(clamp(Math.abs(a.dot(b)), 0, 1));
}

/** Convert normalized MediaPipe landmarks to pixel coordinates. */
export function toPixels(landmarks, video) {
    var w = video.videoWidth, h = video.videoHeight;
    return landmarks.map(function(l) {
        return [l.x * w, l.y * h, l.z * w];
    });
}
