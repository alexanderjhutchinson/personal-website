import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { palette } from "./palette";
import { reelFace } from "./textures";

/** A Super 8 home movie projector. Built facing -z; the lens is at the front. */
export interface Projector {
  group: THREE.Group;
  /** Meshes the pointer can hit to start the film. */
  hitTargets: THREE.Object3D[];
  lensWorld: THREE.Vector3;
  setRunning(level: number): void;
  setHover(level: number): void;
  update(dt: number, reelSpeed: number): void;
}

export function buildProjector(position: THREE.Vector3, aimAt: THREE.Vector3): Projector {
  const group = new THREE.Group();
  const body = new THREE.Group();

  const shell = new THREE.MeshStandardMaterial({
    color: "#8f877a",
    metalness: 0.45,
    roughness: 0.42,
    emissive: new THREE.Color(palette.mustard),
    emissiveIntensity: 0,
  });
  const dark = new THREE.MeshStandardMaterial({ color: palette.smoke, metalness: 0.3, roughness: 0.55 });
  const chrome = new THREE.MeshStandardMaterial({ color: palette.chrome, metalness: 0.95, roughness: 0.22 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#151210", roughness: 0.9 });

  const foot = 0.03;
  const bodyH = 0.13;
  const main = new THREE.Mesh(new RoundedBoxGeometry(0.17, bodyH, 0.32, 3, 0.022), shell);
  main.position.y = foot + bodyH / 2;
  const deck = new THREE.Mesh(new RoundedBoxGeometry(0.155, 0.022, 0.29, 2, 0.008), dark);
  deck.position.y = foot + bodyH + 0.006;
  body.add(main, deck);

  for (const [x, z] of [
    [-0.06, -0.12],
    [0.06, -0.12],
    [-0.06, 0.12],
    [0.06, 0.12],
  ]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, foot, 12), rubber);
    f.position.set(x, foot / 2, z);
    body.add(f);
  }

  // Lens barrel.
  const lensY = foot + 0.06;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.1, 28), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, lensY, -0.2);
  const ringFront = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.005, 10, 28), chrome);
  ringFront.position.set(0, lensY, -0.25);
  const focusRing = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.022, 28), rubber);
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(0, lensY, -0.2);
  const lensMat = new THREE.MeshStandardMaterial({
    color: "#1b2330",
    metalness: 0.2,
    roughness: 0.08,
    emissive: new THREE.Color(palette.projectorLight),
    emissiveIntensity: 0,
  });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.027, 28), lensMat);
  glass.position.set(0, lensY, -0.2505);
  glass.rotation.y = Math.PI;
  body.add(barrel, ringFront, focusRing, glass);

  // Cooling vents on the left side, lit from inside when the lamp is on.
  const ventGlow = new THREE.MeshStandardMaterial({
    color: "#0d0b09",
    emissive: new THREE.Color(palette.lampLight),
    emissiveIntensity: 0,
  });
  const ventBack = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.07), ventGlow);
  ventBack.rotation.y = -Math.PI / 2;
  ventBack.position.set(-0.0858, foot + 0.07, 0.06);
  body.add(ventBack);
  for (let i = 0; i < 7; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.13), dark);
    slat.position.set(-0.087, foot + 0.04 + i * 0.01, 0.06);
    body.add(slat);
  }

  // Knobs and the maker's plate.
  for (const z of [-0.09, -0.02]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 20), dark);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(-0.092, foot + 0.07, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 12), chrome);
    cap.rotation.z = Math.PI / 2;
    cap.position.copy(knob.position);
    body.add(knob, cap);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.014, 0.07), chrome);
  plate.position.set(-0.086, foot + 0.115, 0.06);
  body.add(plate);

  // Power switch on the back.
  const switchBase = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.008), dark);
  switchBase.position.set(0.03, foot + 0.07, 0.162);
  const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.008), chrome);
  toggle.position.set(0.03, foot + 0.07, 0.168);
  toggle.rotation.x = -0.4;
  body.add(switchBase, toggle);

  // Reel arms and reels.
  const hubY = 0.33;
  const reelX = -0.03;
  const arm = (z0: number, z1: number) => {
    const a = new THREE.Vector3(0, foot + bodyH + 0.01, z0);
    const b = new THREE.Vector3(0, hubY, z1);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.014, len, 0.022), shell);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.rotation.x = Math.atan2(z1 - z0, b.y - a.y);
    return m;
  };
  body.add(arm(-0.09, -0.135), arm(0.09, 0.17));

  const reelColor = "#7d2c1d";
  const reelFaceTex = reelFace(reelColor);
  const flangeCaps = new THREE.MeshStandardMaterial({
    map: reelFaceTex,
    alphaTest: 0.5,
    metalness: 0.1,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const flangeRim = new THREE.MeshStandardMaterial({ color: reelColor, roughness: 0.4 });
  const filmPack = new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.25, metalness: 0.1 });
  const makeReel = (radius: number, wound: number) => {
    const reel = new THREE.Group();
    for (const side of [-1, 1]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.003, 48), [
        flangeRim,
        flangeCaps,
        flangeCaps,
      ]);
      flange.position.y = side * 0.0065;
      reel.add(flange);
    }
    const pack = new THREE.Mesh(new THREE.CylinderGeometry(wound, wound, 0.01, 40), filmPack);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 16), chrome);
    reel.add(pack, hub);
    reel.rotation.z = Math.PI / 2;
    const spinner = new THREE.Group();
    spinner.add(reel);
    return spinner;
  };
  const supply = makeReel(0.11, 0.088);
  supply.position.set(reelX, hubY, -0.135);
  const takeup = makeReel(0.11, 0.046);
  takeup.position.set(reelX, hubY, 0.17);
  body.add(supply, takeup);

  // Film threading from the supply reel into the body and out to the take-up reel.
  const filmMat = new THREE.MeshStandardMaterial({ color: "#3a2416", roughness: 0.3 });
  const strip = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, len, 0.0012), filmMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  };
  body.add(
    strip(new THREE.Vector3(reelX, hubY - 0.088, -0.135), new THREE.Vector3(reelX, foot + bodyH + 0.012, -0.11)),
    strip(new THREE.Vector3(reelX, foot + bodyH + 0.012, 0.12), new THREE.Vector3(reelX, hubY - 0.046, 0.17)),
  );

  group.add(body);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Power cord trailing off the back of the table.
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, foot + 0.03, 0.16),
    new THREE.Vector3(-0.03, 0.01, 0.3),
    new THREE.Vector3(0.12, 0.0, 0.42),
    new THREE.Vector3(0.3, -0.25, 0.48),
    new THREE.Vector3(0.38, -0.44, 0.7),
    new THREE.Vector3(0.6, -0.44, 1.2),
  ]);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 60, 0.004, 6), rubber);
  group.add(cord);

  // Aim the projector at the screen (yaw plus a small upward tilt).
  group.position.copy(position);
  const flat = aimAt.clone();
  flat.y = position.y;
  group.lookAt(flat);
  group.rotateY(Math.PI);
  group.rotateX(0.05);
  group.updateMatrixWorld(true);

  const lensWorld = glass.getWorldPosition(new THREE.Vector3());
  // Nudge the beam origin just in front of the glass.
  lensWorld.add(aimAt.clone().sub(lensWorld).normalize().multiplyScalar(0.01));

  return {
    group,
    hitTargets: [body],
    lensWorld,
    setRunning(level) {
      lensMat.emissiveIntensity = level * 3.5;
      ventGlow.emissiveIntensity = level * 1.4;
      toggle.rotation.x = level > 0.01 ? 0.4 : -0.4;
    },
    setHover(level) {
      shell.emissiveIntensity = level * 0.12;
    },
    update(dt, reelSpeed) {
      supply.rotation.x -= dt * reelSpeed * 2.4;
      takeup.rotation.x -= dt * reelSpeed * 2.4;
    },
  };
}
