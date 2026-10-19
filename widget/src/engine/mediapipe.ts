import type { NormalizedLandmark } from './helpers';

/**
 * MediaPipe Tasks Vision is loaded at runtime from its CDN, as upstream did
 * (whether to self-host it is still TBD, see docs/04-desarrollo.md). Only the
 * small part of its API the engine uses is typed here.
 */
const VERSION = '0.10.7';
const BUNDLE_URL = `https://unpkg.com/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://unpkg.com/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-assets/face_landmarker.task';

export interface FaceLandmarker {
    detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceLandmarks?: NormalizedLandmark[][] };
}

let landmarker: Promise<FaceLandmarker> | null = null;

/** The face landmarker, created once per page and shared by every open of the modal. */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
    if (!landmarker) {
        landmarker = (async () => {
            const vision = await import(/* @vite-ignore */ BUNDLE_URL);
            const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
            return vision.FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: false
            }) as Promise<FaceLandmarker>;
        })();
        landmarker.catch(() => { landmarker = null; });   // allow a retry after a network error
    }
    return landmarker;
}
