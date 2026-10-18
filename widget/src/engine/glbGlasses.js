import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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
var MODELS_URL = process.env.PUBLIC_URL + '/models-dev/';

export const FRAMES = [
    {
        id: 'sun',
        name: 'Sol',
        kind: 'sun',
        url: MODELS_URL + 'sun_glasses.glb',
        unitToMm: 10,                 // authored in centimetres
        bridge: [6.91, 0.87, 0.52],   // back face of the bridge bar, centred
        rotationY: -Math.PI / 2       // source faces +X with its width along Z
    },
    {
        id: 'acetate',
        name: 'Acetato',
        kind: 'reading',
        url: MODELS_URL + 'acetate.glb',
        unitToMm: 100,                // authored in decimetres (front 140.6 mm, temples 133 mm)
        bridge: [0, 0.121, 0.070],    // back face of the acetate bridge, centred
        rotationY: 0                  // already faces +Z
    },
    {
        id: 'metal',
        name: 'Metal',
        kind: 'sun',
        url: MODELS_URL + 'metal.glb',
        // Units are inconsistent (front 18.5 units, temples 14.6): scaled so the
        // front is 140 mm, which leaves the temples short (~110 mm).
        unitToMm: 140 / 18.508,
        bridge: [0, 184.45, 16.18],   // bridge wire; the model sits at head height
        rotationY: 0                  // already faces +Z
    }
];

/**
 * Load a GLB and wrap it so the returned group follows ADR-015.
 * Resolves with a THREE.Group whose meshes render after the occluder.
 */
export function loadGlasses(spec) {
    return new Promise(function(resolve, reject) {
        new GLTFLoader().load(spec.url, function(gltf) {
            var model = gltf.scene;
            model.scale.setScalar(spec.unitToMm);
            model.rotation.y = spec.rotationY;
            model.position.fromArray(spec.bridge)
                .multiplyScalar(spec.unitToMm)
                .applyEuler(model.rotation)
                .negate();

            var g = new THREE.Group();
            g.add(model);
            g.traverse(function(child) {
                if (child.isMesh) child.renderOrder = 3;
            });

            var size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
            console.info('[glasses] ' + spec.url + ' size mm (w x h x d):',
                size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));

            resolve(g);
        }, undefined, reject);
    });
}
