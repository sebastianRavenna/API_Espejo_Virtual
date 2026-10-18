import * as THREE from 'three';
import { FACE_OVAL } from './constants';

/**
 * Create a dynamic face mesh occluder (triangle fan geometry).
 *
 * The mesh has 37 vertices: 36 face oval landmarks + 1 centroid center.
 * Vertices are updated every frame directly from landmark world coordinates
 * in the main prediction loop (see engine/index.js).
 *
 * Render order = 1 (before glasses at 3), colorWrite = false.
 * This writes only to the depth buffer, creating an invisible barrier
 * that hides temple arms behind the face.
 */
export function createHeadOccluder(cfg) {
    // Head-shaped ellipsoid in the glasses' ADR-015 frame (mm, origin at the
    // bridge, Z forward). The face oval stops at the forehead, so when the head
    // turns and tilts down the far temple shows over the skull; this covers it.
    // Narrower than the temples, so the near temple stays in front of it.
    var geo = new THREE.SphereGeometry(1, 32, 24);
    var mat = new THREE.MeshBasicMaterial({ colorWrite: false });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(cfg.radiusX, cfg.radiusY, cfg.radiusZ);
    mesh.position.set(0, cfg.centerY, cfg.centerZ);
    mesh.renderOrder = 1;
    return mesh;
}

export function createDynamicFaceMesh() {
    var nOval = FACE_OVAL.length;
    var nVerts = nOval + 1;

    var positions = new Float32Array(nVerts * 3);
    var indices = [];

    // Triangle fan: center (0) → oval[i] (i+1) → oval[next] (next+1)
    for (var i = 0; i < nOval; i++) {
        indices.push(0, i + 1, ((i + 1) % nOval) + 1);
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);

    var mat = new THREE.MeshBasicMaterial({
        colorWrite: false,
        side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    return mesh;
}
