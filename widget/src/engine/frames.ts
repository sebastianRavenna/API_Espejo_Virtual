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
    // Materials that are the lens glass. Models from blender/prototype_postprocess.py
    // name theirs "lens"; downloaded ones may use another name, or have the lens
    // fused with the frame (then there is no glass to reflect on).
    lensMaterials?: string[];
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
        rotationY: 0,                   // already faces +Z
        lensMaterials: ['Frame.1']      // the transparent lens material of this file
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

export interface TempleFade {
    startMm: number;   // fully visible up to this distance behind the bridge
    endMm: number;     // fully gone from here back
}

/** Strength of the lens reflection, by frame kind. */
export interface LensReflect {
    sun: number;
    reading: number;
}

/**
 * Load a GLB and wrap it so the returned group follows ADR-015.
 * Resolves with a THREE.Group whose meshes render after the occluder.
 */
/** How the frame is drawn: temple fade, lens reflection and surroundings on the frame. */
export interface FrameLook {
    fade: TempleFade;
    reflect: LensReflect;
    envIntensity: number;
}

export function loadGlasses(spec: FrameSpec, modelsBaseUrl: string, look: FrameLook): Promise<THREE.Group> {
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
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                const lens = isLens(materials[0], spec);
                mesh.renderOrder = lens ? 4 : 3;   // glass after the opaque frame
                const replaced = materials.map((m) => isLens(m, spec)
                    ? createLensMaterial(m, spec.kind, look.reflect[spec.kind])
                    : withTempleFade(m, mesh.matrixWorld.clone(), look.fade, look.envIntensity));
                mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0];
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
function withTempleFade(source: THREE.Material, toFrame: THREE.Matrix4, fade: TempleFade, envIntensity: number): THREE.Material {
    const material = source.clone();
    if ('envMapIntensity' in material) {
        (material as THREE.MeshStandardMaterial).envMapIntensity = envIntensity;
    }
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

function isLens(material: THREE.Material, spec: FrameSpec): boolean {
    return material.name === 'lens' || (spec.lensMaterials ?? []).includes(material.name);
}

/**
 * Glass for the lenses (ADR-015: flat lens surfaces), with Fresnel reflections.
 *
 * three 0.113's MeshPhysicalMaterial already behaves like glass through its
 * `transparency`: the body is see-through, but the alpha rises with the
 * reflected light, and that reflection follows Schlick's Fresnel (about 4 %
 * looking straight at it, close to 100 % at grazing angles and towards the
 * edges as the head turns). On top of that, `strength` scales the reflection by
 * frame kind: clear on sunglasses, subtle on reading glasses so the eyes show.
 */
function createLensMaterial(source: THREE.Material, kind: FrameSpec['kind'], strength: number): THREE.Material {
    const tint = (source as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(1, 1, 1);
    const glass = new THREE.MeshPhysicalMaterial({
        name: 'lens',
        color: tint,
        metalness: 0,
        roughness: 0.02,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    // How see-through the body is: clear reading lenses vs dark sun lenses
    // (`transparency` exists in 0.113 but is missing from its type definitions)
    (glass as THREE.MeshPhysicalMaterial & { transparency: number }).transparency = kind === 'sun' ? 0.15 : 0.94;
    glass.onBeforeCompile = (shader) => {
        shader.uniforms.uLensReflect = { value: strength };
        shader.fragmentShader = 'uniform float uLensReflect;\n' + shader.fragmentShader.replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
    reflectedLight.indirectSpecular *= uLensReflect;
    reflectedLight.directSpecular *= uLensReflect;`
        );
    };
    return glass;
}
