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
export interface TempleFade {
    startMm: number;   // fully visible up to this distance behind the bridge
    endMm: number;     // fully gone from here back
}

export function loadGlasses(spec: FrameSpec, modelsBaseUrl: string, fade: TempleFade): Promise<THREE.Group> {
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
            g.updateMatrixWorld(true);   // g sits at the origin, so matrixWorld = mesh → ADR-015 frame
            g.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.renderOrder = 3;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                const faded = materials.map((m) => withTempleFade(m, mesh.matrixWorld.clone(), fade));
                mesh.material = Array.isArray(mesh.material) ? faded : faded[0];
            });

            const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
            console.info(`[glasses] ${url} size mm (w x h x d):`, size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
            resolve(g);
        }, undefined, reject);
    });
}

/**
 * Fade the temples out towards the back. Tracking only sees the face, not the
 * ears or the hair, so a temple drawn all the way back shows on top of them.
 * The fade is dithered (fragments discarded with a per-pixel threshold) instead
 * of transparent, so it needs no depth sorting against the lenses.
 * toFrame maps the mesh's own coordinates to the ADR-015 frame (mm, Z forward).
 */
function withTempleFade(source: THREE.Material, toFrame: THREE.Matrix4, fade: TempleFade): THREE.Material {
    const material = source.clone();
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uToFrame = { value: toFrame };
        shader.uniforms.uFadeStart = { value: -fade.startMm };
        shader.uniforms.uFadeEnd = { value: -fade.endMm };
        shader.vertexShader = 'uniform mat4 uToFrame;\nvarying float vFrameZ;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvFrameZ = (uToFrame * vec4(transformed, 1.0)).z;'
        );
        shader.fragmentShader = 'uniform float uFadeStart;\nuniform float uFadeEnd;\nvarying float vFrameZ;\n' + shader.fragmentShader.replace(
            'void main() {',
            `void main() {
    float evFade = smoothstep(uFadeEnd, uFadeStart, vFrameZ);
    if (evFade < 1.0 && evFade < fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453)) discard;`
        );
    };
    return material;
}
