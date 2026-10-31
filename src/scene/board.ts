import * as THREE from "three";
import { BOARD } from "./layout";
import { palette } from "./palette";
import * as tex from "./textures";

/**
 * The pin board on the back wall: photos pinned to cork, and a ticket stub. From the couch the board
 * is one thing to click, which takes the camera over to it; there, a photo clicked comes off its pin
 * and up to the camera. The theater does the moving.
 *
 * The photos are web copies in public/photos, made from the originals by scripts/photos.mjs. Each print
 * is painted twice: small for the board, from the small copy loaded with the room, and sharp from the
 * large copy, loaded only once it's held up.
 */

interface Snapshot {
  /** Its web copies' name in public/photos: NAME-small.webp and NAME-large.webp. */
  photo: string;
  /** The picture's width over its height. */
  aspect: number;
  /** Its center on the board, in meters from the board's center, and its tilt in degrees. */
  at: [x: number, y: number, tilt: number];
}

/** In the order the arrows go through them: the top row, then the bottom. */
const SNAPSHOTS: Snapshot[] = [
  // A rest in the mountains, on film.
  { photo: "001717310027", aspect: 3 / 2, at: [-0.35, 0.15, -4] },
  // Dumplings round a big table.
  { photo: "img_1593", aspect: 3 / 4, at: [-0.13, 0.13, 3] },
  // Graduation.
  { photo: "img_1982", aspect: 4 / 3, at: [0.095, 0.16, -2] },
  // Out front of a restaurant in the holiday lights. A night photo, so the lamp's bright spot suits it.
  { photo: "img_1595", aspect: 3 / 4, at: [0.345, 0.12, 5] },
  // A night out, on an old digital camera.
  { photo: "dsc02006", aspect: 3 / 4, at: [-0.32, -0.15, 4] },
  // A shrine by a pond.
  { photo: "img_1592", aspect: 4 / 3, at: [-0.07, -0.17, -3] },
  // The road behind, in a mirror on a mountain road.
  { photo: "img_1594", aspect: 2 / 3, at: [0.19, -0.15, 2] },
];

/** The picture's long side and the white border around it, in meters. */
const PICTURE = 0.19;
const BORDER = 0.012;
/** Pixels on a print's long side: on the board, and held up close. */
const SMALL = 512;
const SHARP = 1600;
/** The cork's face, out from the wall. */
const CORK = 0.02;
const PIN_COLORS = [palette.rust, palette.mustard, palette.avocado, palette.cream, palette.burntOrange];

export interface BoardPhoto {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  /** The print's size, border included, in meters. */
  width: number;
  height: number;
  /** Where it's pinned, in world space. */
  home: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  /** 0 pinned to the board, 1 held up to the camera. */
  lift: number;
  /** The pointer's highlight, 0 to 1. */
  hover: number;
}

export interface Board {
  /** In world space: the board, its pins, and the photos (which the theater moves). */
  group: THREE.Group;
  photos: BoardPhoto[];
  /** What a click on the board lands on: all of it. */
  hitTargets: THREE.Object3D[];
  /** The pointer's highlight over the whole board from the couch, 0 to 1. The photos brighten with it. */
  hover: number;
  /** Brighten the whole board under the pointer, from the couch. */
  highlight(level: number): void;
  /** Paint a photo's print sharp enough to hold up close (once its large copy loads), or go back to the board's small print. */
  sharpen(photo: BoardPhoto, sharp: boolean): void;
}

function printLayout(s: Snapshot): tex.PrintLayout & { width: number; height: number } {
  const pw = s.aspect >= 1 ? PICTURE : PICTURE * s.aspect;
  const ph = s.aspect >= 1 ? PICTURE / s.aspect : PICTURE;
  const width = pw + 2 * BORDER;
  const height = ph + 2 * BORDER;
  return { width, height, aspect: width / height, picture: { x: BORDER / width, y: BORDER / height, w: pw / width, h: ph / height } };
}

async function load(s: Snapshot, size: "small" | "large") {
  const image = new Image();
  image.decoding = "async";
  image.src = `/photos/${s.photo}-${size}.webp`;
  await image.decode();
  return image;
}

export function buildBoard(): Board {
  const group = new THREE.Group();
  const { center, width, height } = BOARD;

  // The board: cork in a walnut frame, standing a little off the wall.
  const board = new THREE.Group();
  const rail = 0.03;
  const corkW = width - 2 * rail;
  const corkH = height - 2 * rail;
  // Both glow in their own colors under the pointer, like the radio.
  const corkMap = tex.cork([corkW / 0.4, corkH / 0.4]);
  const corkMat = new THREE.MeshStandardMaterial({
    map: corkMap,
    emissive: "#ffffff",
    emissiveMap: corkMap,
    emissiveIntensity: 0,
    roughness: 1,
  });
  const cork = new THREE.Mesh(new THREE.BoxGeometry(corkW, corkH, CORK), corkMat);
  cork.position.z = CORK / 2;
  const walnut = new THREE.MeshStandardMaterial({
    color: palette.walnut,
    emissive: palette.walnut,
    emissiveIntensity: 0,
    roughness: 0.55,
  });
  const frame = [
    [width, rail, 0, (height - rail) / 2],
    [width, rail, 0, -(height - rail) / 2],
    [rail, corkH, (width - rail) / 2, 0],
    [rail, corkH, -(width - rail) / 2, 0],
  ].map(([w, h, x, y]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, CORK + 0.01), walnut);
    m.position.set(x, y, (CORK + 0.01) / 2);
    return m;
  });
  board.add(cork, ...frame);
  board.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  board.position.copy(center);
  group.add(board);

  // Pushpins, which stay in the cork when a photo comes off.
  const head = new THREE.CylinderGeometry(0.0075, 0.009, 0.007, 16).rotateX(Math.PI / 2);
  const pinMats = PIN_COLORS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));
  const pin = (x: number, y: number, z: number, i: number) => {
    const m = new THREE.Mesh(head, pinMats[i % pinMats.length]);
    m.position.set(x, y, z);
    board.add(m);
  };

  const Z = new THREE.Vector3(0, 0, 1);
  const layouts = SNAPSHOTS.map(printLayout);
  // Each print's small texture, blank until its photo loads; and whether it's wanted sharp, or loading so.
  const small: THREE.Texture[] = [];
  const wantSharp = SNAPSHOTS.map(() => false);
  const loadingSharp = SNAPSHOTS.map(() => false);
  const photos = SNAPSHOTS.map((s, i): BoardPhoto => {
    const layout = layouts[i];
    const map = tex.print(null, layout, SMALL);
    small.push(map);
    // Satin prints, lit to see once held up (the theater turns up their glow).
    const material = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.62 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(layout.width, layout.height), material);
    mesh.userData.photo = i;
    const [x, y, tilt] = s.at;
    const angle = THREE.MathUtils.degToRad(tilt);
    // Each print a hair in front of the one before, so overlapping corners don't flicker.
    const z = CORK + 0.0008 + i * 0.0006;
    const home = {
      position: center.clone().add(new THREE.Vector3(x, y, z)),
      quaternion: new THREE.Quaternion().setFromAxisAngle(Z, angle),
    };
    mesh.position.copy(home.position);
    mesh.quaternion.copy(home.quaternion);
    group.add(mesh);
    const top = layout.height / 2 - 0.016;
    pin(x - Math.sin(angle) * top, y + Math.cos(angle) * top, CORK + 0.008, i);
    return { mesh, width: layout.width, height: layout.height, home, lift: 0, hover: 0 };
  });

  // The small prints come in with the room, each in its own time. A photo that doesn't load stays blank.
  SNAPSHOTS.forEach((s, i) => {
    load(s, "small")
      .then((image) => {
        const m = photos[i].mesh.material;
        const before = small[i];
        small[i] = tex.print(image, layouts[i], SMALL);
        if (m.map === before) m.map = m.emissiveMap = small[i];
        before.dispose();
      })
      .catch(() => {});
  });

  // A ticket stub in the corner, for the room's own movie night.
  const stub = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.048),
    new THREE.MeshStandardMaterial({ map: tex.ticket(), roughness: 0.8 }),
  );
  stub.position.set(0.43, -0.22, CORK + 0.0008);
  stub.rotation.z = THREE.MathUtils.degToRad(8);
  board.add(stub);
  pin(0.43 - 0.042, -0.22 - 0.006, CORK + 0.008, 3);

  return {
    group,
    photos,
    hitTargets: [group],
    hover: 0,
    highlight(level) {
      this.hover = level;
      corkMat.emissiveIntensity = level * 0.2;
      walnut.emissiveIntensity = level * 0.35;
    },
    sharpen(photo, sharp) {
      const i = photos.indexOf(photo);
      const m = photo.mesh.material;
      wantSharp[i] = sharp;
      if (!sharp) {
        if (m.map !== small[i]) {
          m.map?.dispose();
          m.map = m.emissiveMap = small[i];
        }
        return;
      }
      if (m.map !== small[i] || loadingSharp[i]) return;
      // The small print shows, scaled up, until the large photo is in.
      loadingSharp[i] = true;
      load(SNAPSHOTS[i], "large")
        .then((image) => {
          if (wantSharp[i] && m.map === small[i]) m.map = m.emissiveMap = tex.print(image, layouts[i], SHARP);
        })
        .catch(() => {})
        .finally(() => (loadingSharp[i] = false));
    },
  };
}
