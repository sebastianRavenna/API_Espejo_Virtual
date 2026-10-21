import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

/**
 * 360° panorama reflected on frames and lenses (ADR-033, P-18): Poly Haven's
 * "Lebombo" by Greg Zaal, CC0, 1k HDR (~1.5 MB). Served next to the models in
 * development and from R2 in production. Downloaded once per page; the
 * reflection map is rebuilt for each WebGL context because it lives on the GPU.
 */
let panorama: Promise<THREE.DataTexture> | null = null;

/** Load (once) the panorama and turn it so its brightest side faces the person. */
export function loadPanorama(url: string, yawTurns: number): Promise<THREE.DataTexture> {
    if (!panorama) {
        panorama = new Promise<THREE.DataTexture>((resolve, reject) => {
            new RGBELoader().load(url, (texture) => {
                rollEquirect(texture as THREE.DataTexture, yawTurns);
                resolve(texture as THREE.DataTexture);
            }, undefined, reject);
        });
        panorama.catch(() => { panorama = null; });   // allow a retry on the next opening
    }
    return panorama;
}

/** Reflection map (PMREM) for this renderer from the loaded panorama. */
export function panoramaEnvironment(renderer: THREE.WebGLRenderer, texture: THREE.DataTexture): THREE.Texture {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(texture).texture;
    pmrem.dispose();
    return env;
}

/**
 * Rotate an equirectangular image around the vertical axis by shifting its
 * columns. The face looks at the camera (+Z); a lens facing it reflects what
 * is behind the person's view, which three.js maps to the image's edges, so
 * half a turn brings the image's centre (Lebombo's window) into the reflection.
 */
function rollEquirect(texture: THREE.DataTexture, turns: number): void {
    const { data, width, height } = texture.image as unknown as { data: Uint8Array; width: number; height: number };
    const shift = Math.round(((turns % 1) + 1) % 1 * width);
    if (!shift) return;
    const row = new Uint8Array(width * 4);
    for (let y = 0; y < height; y++) {
        const start = y * width * 4;
        row.set(data.subarray(start, start + width * 4));
        for (let x = 0; x < width; x++) {
            const from = ((x + shift) % width) * 4;
            data.set(row.subarray(from, from + 4), start + x * 4);
        }
    }
    texture.needsUpdate = true;
}
