import * as THREE from 'three';
import { FACE_OVAL, type HeadOccluderConfig } from './constants';

/**
 * Head-shaped ellipsoid in the glasses' ADR-015 frame (mm, origin at the
 * bridge, Z forward). The face oval stops at the forehead, so when the head
 * turns and tilts down the far temple shows over the skull; this covers it.
 * Narrower than the temples, so the near temple stays in front of it.
 */
export function createHeadOccluder(cfg: HeadOccluderConfig): THREE.Mesh {
    const geo = new THREE.SphereGeometry(1, 32, 24);
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(cfg.radiusX, cfg.radiusY, cfg.radiusZ);
    mesh.position.set(0, cfg.centerY, cfg.centerZ);
    mesh.renderOrder = 1;
    return mesh;
}

/**
 * Create a dynamic face mesh occluder (triangle fan geometry).
 *
 * The mesh has 37 vertices: 36 face oval landmarks + 1 centroid center.
 * Vertices are updated every frame from landmark coordinates in the engine.
 *
 * Render order = 1 (before glasses at 3), colorWrite = false.
 * This writes only to the depth buffer, creating an invisible barrier
 * that hides temple arms behind the face.
 */
export function createDynamicFaceMesh(): THREE.Mesh {
    const nOval = FACE_OVAL.length;
    const positions = new Float32Array((nOval + 1) * 3);
    const indices: number[] = [];

    // Triangle fan: center (0) → oval[i] (i+1) → oval[next] (next+1)
    for (let i = 0; i < nOval; i++) {
        indices.push(0, i + 1, ((i + 1) % nOval) + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);

    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    return mesh;
}
