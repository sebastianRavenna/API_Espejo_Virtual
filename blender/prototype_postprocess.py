"""
Prototype of the 3D post-process (steps 2-4 of docs/02-arquitectura.md) for the Fase 0 spike.

Takes a Hunyuan3D-2mv mesh and writes a GLB in the ADR-015 convention:
  1. Removes the AI's lens geometry, found as the lens areas of the front photo
     (transparent holes for clear lenses, the lens tint for sunglasses), and the
     front geometry the photo shows as background (shapes the AI invented).
  2. Replaces each lens with a clean glass surface following the lens outline
     (ADR-015), as a separate primitive with a material named "lens".
  3. Scales to real millimetres from the frame measurements (eye, bridge).
  4. Puts the origin at the bridge (lateral centre, back face). Hunyuan already
     outputs X across, Y up, Z forward, so no rotation is needed.
  5. Assigns a PBR material to the frame (Hunyuan's shape model has no texture).

It uses numpy, Pillow and OpenCV so it runs outside Blender; the real pipeline
will port these steps to the headless Blender script (see docs/04-desarrollo.md).

Usage:
  python blender/prototype_postprocess.py <mesh.glb> <front_photo> <out.glb>
      --eye 53 --bridge 17 --material acetate_black --lens clear|tinted
"""
import argparse, json, struct
from collections import deque
import numpy as np
from PIL import Image

MATERIALS = {
    # name: (baseColorFactor RGBA, metallic, roughness)
    'acetate_black': ([0.02, 0.02, 0.02, 1.0], 0.0, 0.25),
    # Not fully metallic: the spike's scene has no environment map, so a pure metal reflects black
    'metal_rose_gold': ([0.86, 0.62, 0.52, 1.0], 0.35, 0.35),
}
ENDPIECES_MM = 12          # assumed: total front width ≈ 2·eye + bridge + both endpieces
WHITE_THRESHOLD = 245      # same as the Colab notebook
LENS_LIGHT = 200           # lens pixels: every channel at least this light...
LENS_MAX_SAT = 30          # ...and nearly grey (max − min channel)
ISLAND_MAX_FRAC = 0.004    # dark islands inside a lens smaller than this share of the image are filled
LENS_MIN_FRAC = 0.01       # a lens covers at least this share of the image
LENS_TINT_MIN_GREEN = 8     # tinted (G-15) lens pixels: green above blue by at least this...
LENS_TINT_LUM = (30, 150)   # ...and mid-dark; the black acetate frame is darker
LENS_TUCK_PX = 6            # the glass outline grows this much so its edge hides under the rim
LENS_MATERIALS = {
    'clear': [1.0, 1.0, 1.0, 0.08],
    'tinted': [0.03, 0.038, 0.024, 0.92],  # G-15 grey-green; glTF colours are linear, so dark values
}
COMP = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    b = open(path, 'rb').read()
    jlen = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jlen])
    start = 20 + jlen + 8

    def acc(i):
        a = j['accessors'][i]
        bv = j['bufferViews'][a['bufferView']]
        n = NCOMP[a['type']]
        off = start + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(b, COMP[a['componentType']], a['count'] * n, off).reshape(a['count'], n)

    prim = j['meshes'][0]['primitives'][0]
    return acc(prim['attributes']['POSITION']).astype(np.float64), acc(prim['indices']).reshape(-1, 3).astype(np.int64)


def lens_holes(photo_path, tinted=False):
    """Mask of the lens areas of the front photo, the frame's enclosed area and its bbox.

    Clear lenses show as transparent holes; tinted (sun) lenses as their tint colour.
    """
    rgb = np.asarray(Image.open(photo_path).convert('RGB'))
    clear = (rgb >= WHITE_THRESHOLD).all(axis=-1)
    h, w = clear.shape
    outside = np.zeros_like(clear)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if clear[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if clear[y, x])
    for y, x in q:
        outside[y, x] = True
    while q:                                   # flood fill the background from the border
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and clear[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    enclosed = ~outside
    # Lens = light, unsaturated pixels enclosed by the frame. Lens tint, reflections and
    # printed demo text break pure white, so the test is looser than the background one.
    if tinted:
        c = rgb.astype(int)
        lum = c.mean(axis=-1)
        light = (c[..., 1] - c[..., 2] > LENS_TINT_MIN_GREEN) & (lum > LENS_TINT_LUM[0]) & (lum < LENS_TINT_LUM[1])
    else:
        light = (rgb >= LENS_LIGHT).all(axis=-1) & (rgb.max(axis=-1).astype(int) - rgb.min(axis=-1) < LENS_MAX_SAT)
    holes = enclosed & light
    # Small dark islands inside a lens (text, reflections, nose pads seen through it) become lens
    # too. The rim is the dark region touching the background, so it is never filled.
    import cv2
    others = (enclosed & ~holes).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(others, connectivity=8)
    touching = np.unique(labels[cv2.dilate(outside.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)])
    small = stats[:, cv2.CC_STAT_AREA] < ISLAND_MAX_FRAC * h * w
    fill = np.isin(labels, [i for i in range(1, n) if small[i] and i not in touching])
    holes |= fill
    # Keep only lens-sized regions
    n, labels, stats, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), connectivity=4)
    big = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > LENS_MIN_FRAC * h * w]
    # Lens openings are close to convex: fill each one's convex hull, so whatever is seen
    # through the clear lens (temples, hinges, nose pads) also counts as lens
    hull_mask = np.zeros((h, w), np.uint8)
    for i in big:
        pts = cv2.findNonZero((labels == i).astype(np.uint8))
        cv2.fillPoly(hull_mask, [cv2.convexHull(pts)], 1)
    holes = hull_mask.astype(bool) & enclosed
    ys, xs = np.nonzero(enclosed)
    return holes, enclosed, (xs.min(), xs.max(), ys.min(), ys.max())


def project_to_photo(V, P, frame_px, bbox):
    """Pixel coordinates of points P (mesh front view, looking from +Z) on the photo.

    The height cannot be matched bbox to bbox: product photos are shot slightly
    from below and the temples stick out above the frame. So the scale is the same
    on both axes (orthographic), starting from the width match, and the scale and
    offset are searched so the most mesh points land on the frame's material.
    """
    x0, x1, y0, y1 = bbox
    h, w = frame_px.shape
    base = (x1 - x0) / (V[:, 0].max() - V[:, 0].min())
    cx_m, cx_p = (V[:, 0].max() + V[:, 0].min()) / 2, (x0 + x1) / 2
    best = (-1, base, 0, 0)
    for k in np.linspace(0.94, 1.06, 13):
        s = base * k
        px = ((P[:, 0] - cx_m) * s + cx_p).round().astype(int)
        ys = -P[:, 1] * s
        okx = (px >= 0) & (px < w)
        for ty in range(int(y0 - ys.min()) - 150, int(y1 - ys.max()) + 150, 3):
            py = (ys + ty).round().astype(int)
            ok = okx & (py >= 0) & (py < h)
            score = frame_px[py[ok], px[ok]].sum()
            if score > best[0]:
                best = (score, s, ty, k)
    _, s, ty, k = best
    print(f'  photo alignment: scale x{k:.2f} of the width match, vertical offset {ty}px')
    px = ((P[:, 0] - cx_m) * s + cx_p).round().astype(int).clip(0, w - 1)
    py = (-P[:, 1] * s + ty).round().astype(int).clip(0, h - 1)
    return px, py, {'s': s, 'ty': ty, 'cx_m': cx_m, 'cx_p': cx_p}


def clean_front(V, F, photo_path, tinted, margin_px=4, background_margin_px=12):
    """Remove, in the front band, the faces that the front photo shows as lens or as background.

    Background hits are geometry the AI invented (e.g. ledges under the lenses).
    The margins keep the rim safe from small misalignments. Returns the kept faces
    and what build_lenses needs (lens mask and photo alignment).
    """
    import cv2
    holes, enclosed, bbox = lens_holes(photo_path, tinted)
    if holes.sum() < 1000:
        raise SystemExit('  no lenses found in the front photo: check --lens clear|tinted')
    k = lambda r: np.ones((2 * r + 1, 2 * r + 1), np.uint8)
    lens = cv2.erode(holes.astype(np.uint8), k(margin_px)).astype(bool)
    background = cv2.erode((~enclosed).astype(np.uint8), k(background_margin_px)).astype(bool)
    c = V[F].mean(axis=1)
    in_front = c[:, 2] > V[:, 2].max() - 0.15          # only the front band, never the temples
    # Align the front band's faces with the photo; the score counts hits on frame material
    px, py, align = project_to_photo(V, c[in_front], enclosed & ~holes, bbox)
    idx = np.nonzero(in_front)[0]
    drop = np.zeros(len(F), bool)
    drop[idx] = lens[py, px] | background[py, px]
    print(f'  removed {lens[py, px].sum()} lens faces and {background[py, px].sum()} faces over the background, of {len(F)}')
    return F[~drop], holes, align


def build_lenses(V, F, holes, align):
    """One flat glass surface per lens, following the lens outline of the photo.

    The plane is fitted to the depths of the frame vertices next to the outline,
    so each lens follows the frame's wrap, and the outline grows LENS_TUCK_PX so
    the glass edge hides under the rim. Triangulated as a fan from the centre
    (lens openings are convex).
    """
    import cv2
    grown = cv2.dilate(holes.astype(np.uint8), np.ones((2 * LENS_TUCK_PX + 1,) * 2, np.uint8))
    n, labels = cv2.connectedComponents(grown)
    front = V[np.unique(F)]
    front = front[front[:, 2] > V[:, 2].max() - 0.15]
    s, ty, cx_m, cx_p = align['s'], align['ty'], align['cx_m'], align['cx_p']
    LV, LF = [], []
    for i in range(1, n):
        contours, _ = cv2.findContours((labels == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        outline = cv2.approxPolyDP(max(contours, key=cv2.contourArea), 2.0, True)[:, 0, :].astype(float)
        x = (outline[:, 0] - cx_p) / s + cx_m                     # photo pixels -> mesh units
        y = -(outline[:, 1] - ty) / s
        d = (front[None, :, 0] - x[:, None]) ** 2 + (front[None, :, 1] - y[:, None]) ** 2
        z = front[d.argmin(axis=1), 2] - 0.005                     # just behind the rim's front face
        # The AI's rim is bumpy, so its depths would facet the glass and warp reflections:
        # fit one plane per lens (ADR-015: flat lenses) and put the outline on it
        A = np.stack([x, y, np.ones_like(x)], axis=1)
        z = A @ np.linalg.lstsq(A, z, rcond=None)[0]
        ring = np.stack([x, y, z], axis=1)
        base = sum(len(v) for v in LV)
        LV.append(np.vstack([ring.mean(axis=0), ring]))
        k = len(ring)
        LF.append(np.array([[base, base + 1 + j, base + 1 + (j + 1) % k] for j in range(k)]))
    print(f'  built {len(LV)} lens surfaces')
    return np.vstack(LV), np.vstack(LF)


def remove_small_pieces(F, n_vertices, min_frac=0.02):
    """Drop loose pieces (e.g. lens leftovers) smaller than min_frac of all faces."""
    parent = np.arange(n_vertices)

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:              # path compression
            parent[x], x = root, parent[x]
        return root

    for a, b, c in F:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra
        parent[rc] = ra
    roots = np.array([find(v) for v in F[:, 0]])
    labels, counts = np.unique(roots, return_counts=True)
    keep = labels[counts >= min_frac * len(F)]
    mask = np.isin(roots, keep)
    print(f'  pieces: {len(labels)}, kept {len(keep)}, removed {(~mask).sum()} faces in small pieces')
    return F[mask]


def compact(V, F):
    used = np.unique(F)
    remap = -np.ones(len(V), np.int64); remap[used] = np.arange(len(used))
    return V[used], remap[F]


def vertex_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, F[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


def write_glb(path, parts):
    """parts: list of (V, F, material dict). One mesh with one primitive per part."""
    blobs, views, accessors, prims, materials = [], [], [], [], []
    offset = 0
    for V, F, material in parts:
        V = V.astype(np.float32); N = vertex_normals(V, F).astype(np.float32); I = F.astype(np.uint32).ravel()
        for data, target, count, typ, extra in (
                (V, 34962, len(V), 'VEC3', {'min': V.min(0).tolist(), 'max': V.max(0).tolist()}),
                (N, 34962, len(V), 'VEC3', {}),
                (I, 34963, len(I), 'SCALAR', {})):
            raw = data.tobytes()
            views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw), 'target': target})
            accessors.append({'bufferView': len(views) - 1, 'componentType': 5125 if typ == 'SCALAR' else 5126,
                              'count': count, 'type': typ, **extra})
            blobs.append(raw); offset += len(raw)
        a = len(accessors)
        prims.append({'attributes': {'POSITION': a - 3, 'NORMAL': a - 2}, 'indices': a - 1, 'material': len(materials)})
        materials.append(material)
    j = {
        'asset': {'version': '2.0', 'generator': 'espejo-virtual prototype_postprocess'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': prims}], 'materials': materials,
        'buffers': [{'byteLength': offset}], 'bufferViews': views, 'accessors': accessors,
    }
    js = json.dumps(j).encode(); js += b' ' * (-len(js) % 4)
    bin_ = b''.join(blobs); bin_ += b'\0' * (-len(bin_) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942) + bin_)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mesh'); ap.add_argument('photo'); ap.add_argument('out')
    ap.add_argument('--eye', type=float, required=True); ap.add_argument('--bridge', type=float, required=True)
    ap.add_argument('--material', choices=MATERIALS, required=True)
    ap.add_argument('--lens', choices=LENS_MATERIALS, required=True, help='clear (reading) or tinted (sun) lenses')
    a = ap.parse_args()

    V, F = read_glb(a.mesh)
    print(a.mesh)
    F, holes, align = clean_front(V, F, a.photo, a.lens == 'tinted')
    F = remove_small_pieces(F, len(V))
    LV, LF = build_lenses(V, F, holes, align)
    V, F = compact(V, F)

    # Scale: front width (front band only) maps to the frame's total width in mm
    front = V[V[:, 2] > V[:, 2].max() - 0.25]
    width_mm = 2 * a.eye + a.bridge + ENDPIECES_MM
    s = width_mm / (front[:, 0].max() - front[:, 0].min())
    # Origin: bridge = vertices near x = 0 in the front band; lateral centre, vertical centre, back face
    br = front[np.abs(front[:, 0]) < 0.03]
    origin = np.array([0.0, (br[:, 1].min() + br[:, 1].max()) / 2, br[:, 2].min()])
    V = (V - origin) * s
    LV = (LV - origin) * s
    size = V.max(0) - V.min(0)
    print(f'  {width_mm:.0f} mm wide -> scale {s:.2f} mm/unit; size {size.round(1)} mm; {len(F)} faces')
    color, metallic, rough = MATERIALS[a.material]
    frame_mat = {'name': a.material, 'doubleSided': True, 'pbrMetallicRoughness': {
        'baseColorFactor': color, 'metallicFactor': metallic, 'roughnessFactor': rough}}
    # The widget recognises the lens by this name and gives it its glass material
    lens_mat = {'name': 'lens', 'doubleSided': True, 'alphaMode': 'BLEND', 'pbrMetallicRoughness': {
        'baseColorFactor': LENS_MATERIALS[a.lens], 'metallicFactor': 0.0, 'roughnessFactor': 0.0}}
    write_glb(a.out, [(V, F, frame_mat), (LV, LF, lens_mat)])


if __name__ == '__main__':
    main()
