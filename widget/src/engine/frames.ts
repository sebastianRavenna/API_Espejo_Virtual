import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLB glasses models used by the spike.
 *
 * Every model must end up in the ADR-015 convention: millimetres, origin at
 * the bridge (lateral centre, back face), X towards the temple, Y up, Z forward.
 * Downloaded GLBs do not come that way, so each spec carries the fix-ups the
 * Blender post-process script will later apply offline:
 *   unitToMm  — multiplier from source units to millimetres
 *   bridge    — bridge point in source coordinates (after the GLB's own root nodes)
 *   rotationY — rotation that turns the source "forward" into +Z
 */
export interface FrameSpec {
    id: string;
    name: string;
    kind: 'sun' | 'reading';
    file: string;                       // relative to the models base URL
    unitToMm: number;
    bridge: [number, number, number];
    rotationY: number;
}

export const FRAMES: FrameSpec[] = [
    {
        id: 'sun',
        name: 'Sol',
        kind: 'sun',
        file: 'sun_glasses.glb',
        unitToMm: 10,                   // authored in centimetres
        bridge: [6.91, 0.87, 0.52],     // back face of the bridge bar, centred
        rotationY: -Math.PI / 2         // source faces +X with its width along Z
    },
    {
        id: 'acetate',
        name: 'Acetato',
        kind: 'reading',
        file: 'acetate.glb',
        unitToMm: 100,                  // authored in decimetres (front 140.6 mm, temples 133 mm)
        bridge: [0, 0.121, 0.070],      // back face of the acetate bridge, centred
        rotationY: 0                    // already faces +Z
    },
    {
        id: 'metal',
        name: 'Metal',
        kind: 'sun',
        file: 'metal.glb',
        // Units are inconsistent (front 18.5 units, temples 14.6): scaled so the
        // front is 140 mm, which leaves the temples short (~110 mm).
        unitToMm: 140 / 18.508,
        bridge: [0, 184.45, 16.18],     // bridge wire; the model sits at head height
        rotationY: 0                    // already faces +Z
    },
    // Generated with Hunyuan3D-2mv from 4 product photos and post-processed by
    // blender/prototype_postprocess.py, which already outputs ADR-015 (mm, origin at the bridge)
    { id: 'hy-acetate', name: 'IA · Acetato', kind: 'reading', file: 'hy-acetate.glb', unitToMm: 1, bridge: [0, 0, 0], rotationY: 0 },
    { id: 'hy-metal', name: 'IA · Metal', kind: 'reading', file: 'hy-metal.glb', unitToMm: 1, bridge: [0, 0, 0], rotationY: 0 },
    { id: 'hy-sun', name: 'IA · Sol', kind: 'sun', file: 'hy-sun.glb', unitToMm: 1, bridge: [0, 0, 0], rotationY: 0 }
];

/**
 * Load a GLB and wrap it so the returned group follows ADR-015.
 * Resolves with a THREE.Group whose meshes render after the occluder.
 */
export function loadGlasses(spec: FrameSpec, modelsBaseUrl: string): Promise<THREE.Group> {
    const url = new URL(spec.file, modelsBaseUrl).href;
    return new Promise((resolve, reject) => {
        new GLTFLoader().load(url, (gltf) => {
            const model = gltf.scene;
            model.scale.setScalar(spec.unitToMm);
            model.rotation.y = spec.rotationY;
            model.position.fromArray(spec.bridge)
                .multiplyScalar(spec.unitToMm)
                .applyEuler(model.rotation)
                .negate();

            const g = new THREE.Group();
            g.add(model);
            g.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) child.renderOrder = 3;
            });

            const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
            console.info(`[glasses] ${url} size mm (w x h x d):`, size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
            resolve(g);
        }, undefined, reject);
    });
}
