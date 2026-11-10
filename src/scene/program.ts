import * as THREE from "three";
import { PAGE_COUNT, PAGE_H, PAGE_W, paintPage, type RegionAction } from "./programPages";

/** Half-letter paper, in meters. */
export const PAPER = { w: 0.14, h: 0.216 };

/**
 * How large the pages are painted while the program stands on the table, as a share of full size. Seen
 * from across the room that's still more than the screen can show, at a sixteenth of the memory.
 */
const TABLE_SCALE = 0.25;

export interface ProgramPaper {
  /** Placed in the room each frame by the theater. */
  group: THREE.Group;
  /** Every printed face, for picking. */
  meshes: THREE.Mesh[];
  /**
   * open: 0 closed, 1 opened flat to the inside spread. flip: 1 turns the closed
   * program over to its back. centered: 1 shifts the closed program so its middle
   * sits on the group's origin (for holding it up); 0 keeps the fold there (for
   * standing it on the table).
   */
  pose(open: number, flip: number, centered: number): void;
  setGlow(intensity: number): void;
  /**
   * Call every frame. While `want` is true, paints the pages large enough to read up close, one page a
   * call so picking it up never stalls on all four at once. Once it's false, goes back to the small pages
   * and lets the large ones go.
   */
  sharpen(want: boolean): void;
  /** What a click on this spot of a page does, if anything. */
  actionAt(hit: THREE.Intersection): RegionAction | null;
}

/**
 * The program: one sheet folded down the middle. The left leaf is hinged at
 * the fold and carries the cover and the inside-left page; the right leaf
 * carries the inside-right page and the back.
 */
export function buildProgram(sharpScale: () => number, anisotropy: number): ProgramPaper {
  const { w, h } = PAPER;

  const texture = (canvas: HTMLCanvasElement) => {
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = anisotropy;
    return map;
  };
  // The small pages stay for as long as the room does. The large ones are by far the room's biggest
  // textures, so they exist only while the program is off the table.
  const painted = Array.from({ length: PAGE_COUNT }, (_, i) => paintPage(i, TABLE_SCALE));
  const small = painted.map(({ canvas }) => texture(canvas));
  const sharp: (THREE.CanvasTexture | null)[] = small.map(() => null);
  // The large pages' share of full size, settled each time the program is picked up.
  let scale = 1;
  const materials = small.map(
    (map) => new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0.1, roughness: 0.92 }),
  );
  const show = (page: number, map: THREE.Texture) => {
    materials[page].map = materials[page].emissiveMap = map;
  };

  // Each face is a plane from the fold (x = 0) out to the edge. Back faces are turned
  // around so they face the other way, a hair apart so they never fight for depth.
  const geometry = new THREE.PlaneGeometry(w, h).translate(w / 2, 0, 0);
  const face = (page: number, z: number, back: boolean) => {
    const mesh = new THREE.Mesh(geometry, materials[page]);
    mesh.userData.page = page;
    mesh.position.z = z;
    if (back) {
      mesh.rotation.y = Math.PI;
      mesh.position.x = w;
    }
    return mesh;
  };
  const cover = face(0, 0.0016, false);
  const insideLeft = face(1, 0.0008, true);
  const insideRight = face(2, 0, false);
  const back = face(3, -0.0008, true);

  const hinge = new THREE.Group();
  hinge.add(cover, insideLeft);
  const booklet = new THREE.Group();
  booklet.add(hinge, insideRight, back);
  const flipper = new THREE.Group();
  flipper.add(booklet);
  const group = new THREE.Group();
  group.add(flipper);

  return {
    group,
    meshes: [cover, insideLeft, insideRight, back],
    pose(open, flip, centered) {
      // The cover swings toward the viewer and over to the left.
      hinge.rotation.y = -Math.PI * open;
      flipper.rotation.y = Math.PI * flip;
      booklet.position.x = -(w / 2) * (1 - open) * centered;
    },
    setGlow(intensity) {
      for (const m of materials) m.emissiveIntensity = intensity;
    },
    sharpen(want) {
      if (want) {
        // The cover first: it's the page facing the camera on the way up.
        const page = sharp.indexOf(null);
        if (page < 0) return;
        if (page === 0) scale = sharpScale();
        sharp[page] = texture(paintPage(page, scale).canvas);
        show(page, sharp[page]);
        return;
      }
      sharp.forEach((map, page) => {
        if (!map) return;
        show(page, small[page]);
        map.dispose();
        // Emptying the canvas gives its pixels back now, rather than whenever the browser gets to it.
        const canvas = map.image as HTMLCanvasElement;
        canvas.width = canvas.height = 0;
        sharp[page] = null;
      });
    },
    actionAt(hit) {
      const page = hit.object.userData.page as number | undefined;
      if (page === undefined || !hit.uv) return null;
      const x = hit.uv.x * PAGE_W;
      const y = (1 - hit.uv.y) * PAGE_H;
      const region = painted[page].regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      return region?.action ?? null;
    },
  };
}
