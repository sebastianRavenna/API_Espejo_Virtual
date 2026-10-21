/**
 * Landmark indices for key facial features.
 * Used to extract specific points from MediaPipe's 468-landmark face mesh.
 */
export const LM = {
    leftEyeOuter: 33,
    rightEyeOuter: 263,
    leftEyeInner: 133,
    rightEyeInner: 362,
    leftTemple: 127,
    rightTemple: 356,
    leftCheek: 234,
    rightCheek: 454,
    forehead: 10,
    chin: 175,
    noseBridge: 168,
    noseTip: 1,
    subnasale: 2            // below the nose; with forehead gives a jaw-independent face height
} as const;

/**
 * Face oval contour — 36 landmarks tracing the face outline.
 * Used to build the dynamic face mesh occluder each frame.
 */
export const FACE_OVAL: readonly number[] = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

/**
 * Iris ring landmarks (FaceLandmarker returns 478 points; 468–477 are the irises).
 * Each ring is centre + 4 points; opposite points give the iris diameter.
 */
export const IRIS = {
    leftCenter: 468, leftRight: 469, leftTop: 470, leftLeft: 471, leftBottom: 472,
    rightCenter: 473, rightRight: 474, rightTop: 475, rightLeft: 476, rightBottom: 477
} as const;

export interface HeadOccluderConfig {
    radiusX: number;
    radiusY: number;
    radiusZ: number;
    centerY: number;
    centerZ: number;
}

/**
 * Calibration parameters. Distances are in real millimetres (ADR-015):
 * the GLB is authored in mm and the iris converts mm to pixels.
 */
export const CFG = {
    irisDiameterMm: 11.7,   // average human iris diameter, used as the ruler
    faceWidthMm: 140,       // fallback ruler (cheek to cheek) if there are no iris points
    faceHeightMm: 75,       // fallback ruler (forehead to below the nose)
    frontalMaxEyeZ: 0.25,   // calibrate only when the eye line is this close to the image plane
    rulerWindow: 30,        // frames in the face-size-in-mm medians
    bridgeGapMm: 2,         // bridge back face in front of the nose-bridge landmark
    bridgeDropMm: -1,       // bridge below the nose-bridge landmark (+ = down); 2 sat low on a real face
    bridgeSideMm: 0,        // horizontal fine-tuning
    glassesScale: 1.0,      // 1 = true size; only for experiments
    pitchCorrectionDeg: 7,  // lowers the temples; the face's forehead–chin line leans back (override: ?pitch=). 0 rose, 15 dropped, 7 confirmed on camera
    // Invisible head ellipsoid (mm, bridge frame). radiusX stays under the
    // temples' half spacing (~62–78 mm) so the near temple is never hidden.
    headOccluder: { radiusX: 64, radiusY: 110, radiusZ: 92, centerY: 20, centerZ: -100 } as HeadOccluderConfig,
    // Temples fade out between these distances behind the bridge (mm), before the
    // ear and the hair, which tracking cannot see (override: ?fade=45,75)
    templeFade: { startMm: 45, endMm: 75 },
    // Lens reflection strength by frame kind (override: ?reflect=<sun>,<reading>).
    // Reading lenses must never hide the eyes, so theirs is subtle
    lensReflect: { sun: 1.0, reading: 0.35 },
    // Reflected surroundings: a CC0 360° panorama (ADR-033, P-18), turned so its
    // window faces the person. Path relative to the models base URL
    environment: { file: 'env/lebombo_1k.hdr', yawTurns: 0.5 },
    // How much the surroundings reflect on the frames (override: ?light=)
    envIntensity: 1,
    // Fallback while the panorama loads or if it fails: synthetic room with the
    // screen in front. 2.5 was barely visible, 6 turned the rose-gold metal white
    screenLight: 4,
    // PD estimate (ADR-027): median of valid frames, looking at the camera, close enough
    pd: {
        frames: 45,         // valid frames to collect (~1.5 s at 30 fps)
        timeoutMs: 10000,   // give up if not enough valid frames in this time
        minIrisPx: 20,      // iris diameter in px; at 12 px one px of noise moved the PD 4–5 mm
        maxEyeTilt: 0.12,   // stricter than the scale calibration: PD needs a frontal face
        maxSpreadMm: 2,     // max spread (25th–75th percentile) of the frames to accept a result
        // Convergence correction (near → far PD)
        pupilToRotationMm: 10,  // pupil to the eye's centre of rotation
        cameraFovDeg: 65        // assumed field of view across the image's long side (webcams ~60–78°)
    }
};
