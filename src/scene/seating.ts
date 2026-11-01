import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { palette } from "./palette";
import * as tex from "./textures";

// The room's seating: a loveseat and a lounge chair. Each is built facing +z, standing on the
// floor at its origin, and room.ts puts it in place.

/** Meters of fabric one tile of the upholstery weave covers. */
const WEAVE = 0.24;

/**
 * A rounded box with UVs projected from its faces at a fixed scale, so the weave is the same size
 * on every face of every piece. RoundedBoxGeometry keeps BoxGeometry's vertex order: six faces with
 * the same number of vertices, in the order +x, -x, +y, -y, +z, -z.
 */
function padded(w: number, h: number, d: number, radius: number, segments = 2) {
  const geo = new RoundedBoxGeometry(w, h, d, segments, radius);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const perFace = pos.count / 6;
  for (let i = 0; i < pos.count; i++) {
    const face = Math.floor(i / perFace);
    const u = face < 2 ? pos.getZ(i) : pos.getX(i);
    const v = face === 2 || face === 3 ? pos.getZ(i) : pos.getY(i);
    uv.setXY(i, u / WEAVE, v / WEAVE);
  }
  return geo;
}

/** Woven upholstery with a soft sheen where the light grazes it, like brushed fabric. */
function fabric(base: string, seed: number) {
  const map = tex.upholstery(base, seed);
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: map,
    bumpScale: 1.5,
    roughness: 0.95,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(base).lerp(new THREE.Color(palette.cream), 0.35),
  });
}

/** A low, square-armed loveseat in green tweed, on a recessed plinth, with a mustard pillow. */
export function loveseat() {
  const g = new THREE.Group();
  // Deeper and cooler than the palette's avocado, so it still reads as green under the warm lamps.
  const cover = fabric("#44603c", 71);
  const L = 1.75;
  const D = 0.9;
  const armW = 0.2;
  const plinth = 0.07;
  const deckTop = 0.27;
  const seatTop = 0.43;
  const backFront = -D / 2 + 0.2;
  const inner = L - armW * 2;

  // The plinth is set back from the edges, so the sofa seems to float a little above its shadow.
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(L - 0.12, plinth, D - 0.14),
    new THREE.MeshStandardMaterial({ color: palette.chocolate, roughness: 0.7 }),
  );
  base.position.y = plinth / 2;
  g.add(base);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(padded(armW, 0.55, D, 0.06), cover);
    arm.position.set(side * (L / 2 - armW / 2), plinth + 0.275, 0);
    g.add(arm);
  }
  const deck = new THREE.Mesh(padded(inner + 0.02, deckTop - plinth, D - 0.12, 0.03, 1), cover);
  deck.position.set(0, (plinth + deckTop) / 2, 0.05);
  const back = new THREE.Mesh(padded(inner + 0.02, 0.72, 0.2, 0.05, 1), cover);
  back.position.set(0, plinth + 0.36, backFront - 0.1);
  g.add(deck, back);

  // Two seat cushions, and two back cushions resting on them, leaning back against the frame.
  const half = inner / 2;
  const lean = 0.2;
  const cushionH = 0.44;
  for (const side of [-1, 1]) {
    const seat = new THREE.Mesh(padded(half - 0.01, seatTop - deckTop, D / 2 - backFront, 0.06), cover);
    seat.position.set((side * half) / 2, (deckTop + seatTop) / 2, (D / 2 + backFront) / 2);
    const cushion = new THREE.Mesh(padded(half - 0.01, cushionH, 0.17, 0.07), cover);
    cushion.position.set((side * half) / 2, seatTop + (cushionH / 2) * Math.cos(lean), backFront + 0.085 - (cushionH / 2) * Math.sin(lean) + 0.03);
    cushion.rotation.x = -lean;
    g.add(seat, cushion);
  }

  // A mustard pillow in the corner by the lamp, which picks up the lounge chair across the room.
  const pillow = new THREE.Mesh(padded(0.4, 0.38, 0.11, 0.05), fabric(palette.mustard, 79));
  pillow.position.set(L / 2 - armW - 0.24, seatTop + 0.17, backFront + 0.14);
  pillow.rotation.set(-0.35, 0.25, -0.12);
  g.add(pillow);
  return g;
}

/** A Danish-style lounge chair: a teak frame with its back leaning out, and loose mustard cushions. */
export function loungeChair(frame: THREE.Material) {
  const g = new THREE.Group();
  const cover = fabric(palette.mustard, 73);
  const W = 0.74;
  const D = 0.78;
  const lean = 0.26;
  const tan = Math.tan(lean);
  const x = W / 2 - 0.035;
  const frontZ = D / 2 - 0.07;
  const postZ = -D / 2 + 0.12;
  /** Where the leaning back posts are at a given height. */
  const postAt = (y: number) => postZ - y * tan;
  const armY = 0.585;
  const railY = 0.3;

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, armY, 10), frame);
    leg.position.set(side * x, armY / 2, frontZ);
    const postLen = 0.98;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, postLen, 10), frame);
    post.position.set(side * x, (postLen / 2) * Math.cos(lean), postAt((postLen / 2) * Math.cos(lean)));
    post.rotation.x = -lean;
    const armBack = postAt(armY);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.028, frontZ + 0.05 - armBack, 1, 0.012), frame);
    arm.position.set(side * x, armY + 0.014, (frontZ + 0.05 + armBack) / 2);
    const railBack = postAt(railY);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, frontZ - railBack), frame);
    rail.position.set(side * x, railY, (frontZ + railBack) / 2);
    g.add(leg, post, arm, rail);
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(2 * x, 0.06, 0.03), frame);
  front.position.set(0, railY, frontZ);
  const rear = front.clone();
  rear.position.z = postAt(railY);
  const topY = 0.88;
  const top = new THREE.Mesh(new RoundedBoxGeometry(2 * x, 0.07, 0.03, 1, 0.01), frame);
  top.position.set(0, topY, postAt(topY));
  top.rotation.x = -lean;
  g.add(front, rear, top);

  // The cushions: the seat tips back a little, and the back leans with the posts.
  const seatH = 0.13;
  const seatFront = frontZ + 0.03;
  const seatBack = postAt(railY + 0.1) + 0.03;
  const seat = new THREE.Mesh(padded(W - 0.1, seatH, seatFront - seatBack, 0.05), cover);
  seat.position.set(0, railY + 0.03 + seatH / 2, (seatFront + seatBack) / 2);
  seat.rotation.x = -0.05;
  const backH = 0.52;
  const backMid = railY + 0.03 + seatH + (backH / 2) * Math.cos(lean);
  const cushion = new THREE.Mesh(padded(W - 0.1, backH, 0.12, 0.05), cover);
  cushion.position.set(0, backMid, postAt(backMid) + 0.06 / Math.cos(lean) + 0.02);
  cushion.rotation.x = -lean;
  g.add(seat, cushion);
  return g;
}
