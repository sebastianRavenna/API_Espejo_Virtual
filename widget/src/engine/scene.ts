import * as THREE from 'three';

// Internal render width; the canvas is scaled with CSS to fit the modal
const CANVAS_WIDTH = 960;

/** Create an orthographic camera sized to the video dimensions. */
export function createCamera(video: HTMLVideoElement): THREE.OrthographicCamera {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cam = new THREE.OrthographicCamera(-vw / 2, vw / 2, vh / 2, -vh / 2, 0.1, 5000);
    cam.position.set(-vw / 2, -vh / 2, 500);
    return cam;
}

/** Create the video background sprite and its texture. */
export function createVideoBackground(video: HTMLVideoElement, camera: THREE.Camera): { bg: THREE.Texture; sprite: THREE.Sprite } {
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const bg = new THREE.Texture(video);
    bg.encoding = THREE.sRGBEncoding;  // camera frames are sRGB; without this the output encoding brightens them twice
    bg.minFilter = THREE.LinearFilter;

    // Double-sided basic material (as upstream): the sprite is mirrored with a negative
    // scale, so with the default front side it would face away and not be drawn
    const material = new THREE.MeshBasicMaterial({ map: bg, depthWrite: false, side: THREE.DoubleSide });
    material.toneMapped = false;  // keep the camera image as is; tone mapping is for the 3D model only
    const sprite = new THREE.Sprite(material as unknown as THREE.SpriteMaterial);
    sprite.center.set(0.5, 0.5);
    sprite.scale.set(-vw, vh, 1);
    sprite.position.copy(camera.position);
    sprite.position.z = 0;

    return { bg, sprite };
}

/** Create the scene lighting (key, fill, rim, accent, ambient). */
export function createLights(): THREE.Light[] {
    // Key light — main illumination from upper front
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(0, 120, 250);

    // Fill light — softer, from left side to reduce harsh shadows
    const fill = new THREE.DirectionalLight(0xeef0ff, 0.5);
    fill.position.set(-100, 40, 120);

    // Rim light — back-lighting for edge highlights on frame
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(60, 80, -100);

    // Top accent — helps clearcoat reflections on brow line
    const topAccent = new THREE.DirectionalLight(0xffffff, 0.25);
    topAccent.position.set(0, 200, 50);

    // Ambient — hemisphere for natural outdoor feel
    const amb = new THREE.HemisphereLight(0xffffff, 0x444466, 0.5);

    return [key, fill, rim, topAccent, amb];
}

/** Create the WebGL renderer; CSS sizes the canvas, so the inline style is not set. */
export function createRenderer(video: HTMLVideoElement): THREE.WebGLRenderer {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(CANVAS_WIDTH, CANVAS_WIDTH * video.videoHeight / video.videoWidth, false);
    r.physicallyCorrectLights = true;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.outputEncoding = THREE.sRGBEncoding;
    return r;
}
