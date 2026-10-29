import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { COFFEE_TABLE, LAMP, ROOM, SCREEN, WINDOW } from "./layout";
import { palette } from "./palette";
import { rng } from "./random";
import * as tex from "./textures";

export interface Room {
  group: THREE.Group;
  lamp: {
    light: THREE.PointLight;
    shade: THREE.MeshStandardMaterial;
    bulb: THREE.MeshBasicMaterial;
    /** Lamp position in world space, used for the dust drifting around it. */
    position: THREE.Vector3;
  };
  fill: THREE.HemisphereLight;
  moon: THREE.DirectionalLight;
  windowGlass: THREE.MeshBasicMaterial;
  screen: {
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
  };
}

const shadowed = <T extends THREE.Object3D>(o: T, cast = true, receive = true) => {
  o.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return o;
};

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function wood(color: string, roughness = 0.6, map?: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ color, roughness });
  if (map) m.map = map;
  return m;
}

export function buildRoom(filmTexture: THREE.Texture): Room {
  const group = new THREE.Group();
  const T = 0.1; // wall thickness
  const depth = ROOM.front - ROOM.back;
  const width = ROOM.halfWidth * 2;
  const tile = 1.2; // meters covered by one paneling texture

  // Floor and rug.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: tex.carpet("#4a3121", [width / 0.6, depth / 0.6]), roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (ROOM.front + ROOM.back) / 2);
  floor.receiveShadow = true;
  group.add(floor);

  const shagTex = tex.shag([3, 2.2]);
  const rug = new THREE.Mesh(
    new RoundedBoxGeometry(2.7, 0.03, 1.95, 2, 0.012),
    new THREE.MeshStandardMaterial({ map: shagTex, bumpMap: shagTex, bumpScale: 3, roughness: 1 }),
  );
  rug.position.set(COFFEE_TABLE.center.x, 0.015, COFFEE_TABLE.center.z - 0.05);
  rug.receiveShadow = true;
  group.add(rug);

  // Ceiling.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: tex.carpet("#cbbfa6", [width / 0.5, depth / 0.5], 9), roughness: 1 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.height, (ROOM.front + ROOM.back) / 2);
  ceiling.receiveShadow = true;
  // Blocks moonlight from leaking in over the top of the walls.
  ceiling.castShadow = true;
  group.add(ceiling);

  // Back wall and left wall: wood paneling.
  const backWall = box(
    width + T * 2,
    ROOM.height,
    T,
    wood("#ffffff", 0.75, tex.woodPaneling([width / tile, ROOM.height / tile])),
    0,
    ROOM.height / 2,
    ROOM.back - T / 2,
  );
  const leftWall = box(
    T,
    ROOM.height,
    depth,
    wood("#ffffff", 0.75, tex.woodPaneling([depth / tile, ROOM.height / tile])),
    -ROOM.halfWidth - T / 2,
    ROOM.height / 2,
    (ROOM.front + ROOM.back) / 2,
  );
  group.add(shadowed(backWall), shadowed(leftWall));

  // Right wall: wallpaper, built in four pieces around the window opening.
  const paper = tex.wallpaper([1, 1]);
  const paperTile = 0.62;
  const rightX = ROOM.halfWidth + T / 2;
  const wallPiece = (z0: number, z1: number, y0: number, y1: number) => {
    const t = paper.clone();
    t.repeat.set((z1 - z0) / paperTile, (y1 - y0) / paperTile);
    t.offset.set(z0 / paperTile, y0 / paperTile);
    t.needsUpdate = true;
    const m = box(T, y1 - y0, z1 - z0, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
    m.position.set(rightX, (y0 + y1) / 2, (z0 + z1) / 2);
    return shadowed(m);
  };
  group.add(
    wallPiece(ROOM.back, WINDOW.z0, 0, ROOM.height),
    wallPiece(WINDOW.z1, ROOM.front, 0, ROOM.height),
    wallPiece(WINDOW.z0, WINDOW.z1, 0, WINDOW.y0),
    wallPiece(WINDOW.z0, WINDOW.z1, WINDOW.y1, ROOM.height),
  );

  // Baseboards.
  const trim = wood(palette.walnut, 0.5);
  group.add(
    shadowed(box(width, 0.09, 0.02, trim, 0, 0.045, ROOM.back + 0.01)),
    shadowed(box(0.02, 0.09, depth, trim, -ROOM.halfWidth + 0.01, 0.045, (ROOM.front + ROOM.back) / 2)),
    shadowed(box(0.02, 0.09, depth, trim, ROOM.halfWidth - 0.01, 0.045, (ROOM.front + ROOM.back) / 2)),
  );

  // Window: frame, night sky, curtains.
  const winW = WINDOW.z1 - WINDOW.z0;
  const winH = WINDOW.y1 - WINDOW.y0;
  const winZ = (WINDOW.z0 + WINDOW.z1) / 2;
  const winY = (WINDOW.y0 + WINDOW.y1) / 2;
  const frameMat = wood("#5a3a22", 0.55);
  const fx = ROOM.halfWidth + 0.02;
  group.add(
    shadowed(box(0.08, 0.06, winW + 0.12, frameMat, fx, WINDOW.y0 - 0.03, winZ)),
    shadowed(box(0.08, 0.06, winW + 0.12, frameMat, fx, WINDOW.y1 + 0.03, winZ)),
    shadowed(box(0.08, winH, 0.06, frameMat, fx, winY, WINDOW.z0 - 0.03)),
    shadowed(box(0.08, winH, 0.06, frameMat, fx, winY, WINDOW.z1 + 0.03)),
    shadowed(box(0.05, winH, 0.035, frameMat, fx + 0.02, winY, winZ)),
    shadowed(box(0.05, 0.035, winW, frameMat, fx + 0.02, winY, winZ)),
    shadowed(box(0.24, 0.04, winW + 0.2, frameMat, ROOM.halfWidth - 0.08, WINDOW.y0 - 0.06, winZ)),
  );
  const windowGlass = new THREE.MeshBasicMaterial({ map: tex.nightSky(), color: "#9aa4c4" });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), windowGlass);
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(ROOM.halfWidth + 0.09, winY, winZ);
  group.add(glass);

  const curtainMat = new THREE.MeshStandardMaterial({ color: palette.burntOrange, roughness: 1, side: THREE.DoubleSide });
  const curtain = (zCenter: number, seed: number) => {
    const geo = new THREE.PlaneGeometry(0.62, 1.75, 40, 1);
    const pos = geo.attributes.position;
    const r = rng(seed);
    const phase = r() * Math.PI;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      pos.setZ(i, Math.sin(u * 32 + phase) * 0.028 + Math.sin(u * 11) * 0.012);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, curtainMat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(ROOM.halfWidth - 0.1, winY + 0.02, zCenter);
    return shadowed(m);
  };
  group.add(curtain(WINDOW.z0 - 0.12, 31), curtain(WINDOW.z1 + 0.12, 37));
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, winW + 1.0, 12),
    new THREE.MeshStandardMaterial({ color: "#b08a4a", metalness: 0.7, roughness: 0.35 }),
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.set(ROOM.halfWidth - 0.1, winY + 0.92, winZ);
  group.add(rod);

  // Pull-down screen.
  const screenMaterial = new THREE.MeshStandardMaterial({
    map: tex.screenFabric(SCREEN.width, SCREEN.height, SCREEN.border),
    emissiveMap: filmTexture,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0,
    roughness: 0.95,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height), screenMaterial);
  screenMesh.position.copy(SCREEN.center);
  screenMesh.receiveShadow = true;
  group.add(screenMesh);

  const metal = new THREE.MeshStandardMaterial({ color: "#3b342e", metalness: 0.6, roughness: 0.4 });
  const top = SCREEN.center.y + SCREEN.height / 2;
  const bottom = SCREEN.center.y - SCREEN.height / 2;
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, SCREEN.width + 0.2, 24), metal);
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, top + 0.05, SCREEN.center.z + 0.02);
  const bar = box(SCREEN.width + 0.02, 0.028, 0.022, metal, 0, bottom - 0.012, SCREEN.center.z + 0.005);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 24), metal);
  ring.position.set(0, bottom - 0.075, SCREEN.center.z + 0.012);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.035, 6), metal);
  cord.position.set(0, bottom - 0.04, SCREEN.center.z + 0.012);
  group.add(shadowed(roller), shadowed(bar), ring, cord);

  // Teak sideboard under the screen.
  const teak = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: tex.woodPaneling([1.6, 0.4]),
    roughness: 0.5,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
  });
  const sideboard = new THREE.Group();
  const sbW = 2.5;
  const sbH = 0.5;
  const sbD = 0.45;
  const legH = 0.12;
  sideboard.add(new THREE.Mesh(new RoundedBoxGeometry(sbW, sbH, sbD, 2, 0.015), teak));
  sideboard.children[0].position.y = legH + sbH / 2;
  const legMat = wood(palette.walnut, 0.5);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, legH, 10), legMat);
      leg.position.set(sx * (sbW / 2 - 0.12), legH / 2, sz * (sbD / 2 - 0.07));
      sideboard.add(leg);
    }
  }
  const brass = new THREE.MeshStandardMaterial({ color: "#c89b4a", metalness: 0.85, roughness: 0.3 });
  for (const gx of [-sbW / 6, sbW / 6]) {
    sideboard.add(box(0.008, sbH - 0.06, 0.004, legMat, gx, legH + sbH / 2, sbD / 2 + 0.001));
  }
  for (const kx of [-sbW / 3 + 0.1, -0.06, 0.06, sbW / 3 - 0.1]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), brass);
    knob.position.set(kx, legH + sbH / 2, sbD / 2 + 0.01);
    sideboard.add(knob);
  }
  sideboard.position.set(0, 0, ROOM.back + sbD / 2 + 0.05);
  group.add(shadowed(sideboard));
  const sbTop = legH + sbH;
  const sbZ = sideboard.position.z;

  // Radio on the sideboard.
  const radio = new THREE.Group();
  radio.add(new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.24, 0.17, 3, 0.03), wood("#7b4c2a", 0.45)));
  const grille = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.16),
    new THREE.MeshStandardMaterial({ map: tex.grilleCloth(), roughness: 1 }),
  );
  grille.position.set(-0.07, 0, 0.0855);
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.045, 32),
    new THREE.MeshStandardMaterial({ color: palette.cream, roughness: 0.6 }),
  );
  dial.position.set(0.13, 0.02, 0.0855);
  const knobA = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), brass);
  knobA.rotation.x = Math.PI / 2;
  knobA.position.set(0.1, -0.07, 0.09);
  const knobB = knobA.clone();
  knobB.position.x = 0.16;
  radio.add(grille, dial, knobA, knobB);
  radio.position.set(0.78, sbTop + 0.12, sbZ + 0.02);
  radio.rotation.y = -0.08;
  group.add(shadowed(radio));

  // A stack of records.
  const sleeves = [palette.mustard, palette.cream, palette.rust, palette.avocado];
  sleeves.forEach((color, i) => {
    const lp = box(0.31, 0.004, 0.31, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    lp.position.set(-0.32, sbTop + 0.002 + i * 0.0045, sbZ + 0.02);
    lp.rotation.y = (i - 1.5) * 0.06;
    group.add(shadowed(lp));
  });

  // Snake plant on the sideboard.
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.07, 0.16, 24),
    new THREE.MeshPhysicalMaterial({ color: palette.avocado, roughness: 0.3, clearcoat: 0.6 }),
  );
  pot.position.y = 0.08;
  plant.add(pot);
  const leafTex = tex.snakeLeaf();
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, side: THREE.DoubleSide, roughness: 0.6 });
  const pr = rng(41);
  for (let i = 0; i < 9; i++) {
    const h = 0.32 + pr() * 0.26;
    const w = 0.045 + pr() * 0.02;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.quadraticCurveTo(-w * 0.7, h * 0.55, 0, h);
    shape.quadraticCurveTo(w * 0.7, h * 0.55, w / 2, 0);
    shape.lineTo(-w / 2, 0);
    const geo = new THREE.ShapeGeometry(shape, 8);
    const uv = geo.attributes.uv;
    const p = geo.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / w + 0.5, p.getY(k) / h);
    const leaf = new THREE.Mesh(geo, leafMat);
    const a = (i / 9) * Math.PI * 2 + pr() * 0.4;
    leaf.position.set(Math.cos(a) * 0.035, 0.14, Math.sin(a) * 0.035);
    leaf.rotation.set(0, -a + Math.PI / 2, 0);
    leaf.rotateX((pr() - 0.5) * 0.25);
    leaf.rotateZ(Math.cos(a) * 0.12);
    plant.add(leaf);
  }
  plant.position.set(-0.95, sbTop, sbZ);
  group.add(shadowed(plant));

  // Side table with the lamp.
  const sideTable = new THREE.Group();
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.035, 40), teak);
  tableTop.position.y = 0.6;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.58, 16), legMat);
  pedestal.position.y = 0.29;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.025, 32), legMat);
  foot.position.y = 0.0125;
  sideTable.add(tableTop, pedestal, foot);

  const lampProfile = [
    [0, 0],
    [0.075, 0],
    [0.085, 0.02],
    [0.115, 0.08],
    [0.125, 0.14],
    [0.105, 0.21],
    [0.065, 0.27],
    [0.036, 0.31],
    [0.03, 0.34],
    [0, 0.34],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const lampBase = new THREE.Mesh(
    new THREE.LatheGeometry(lampProfile, 40),
    new THREE.MeshPhysicalMaterial({ color: palette.burntOrange, roughness: 0.25, clearcoat: 0.8 }),
  );
  lampBase.position.y = 0.6175;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 8), brass);
  neck.position.y = 0.6175 + 0.34 + 0.08;
  const shade = new THREE.MeshStandardMaterial({
    color: palette.cream,
    emissive: new THREE.Color(palette.lampLight),
    emissiveIntensity: 1,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.3, 40, 1, true), shade);
  const shadeY = 0.6175 + 0.34 + 0.2;
  shadeMesh.position.y = shadeY;
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.lampLight).multiplyScalar(3) });
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), bulb);
  bulbMesh.position.y = shadeY - 0.04;
  sideTable.add(lampBase, neck, shadeMesh, bulbMesh);
  sideTable.position.copy(LAMP.table);
  group.add(shadowed(sideTable));
  shadeMesh.castShadow = false;
  bulbMesh.castShadow = false;

  const lampLight = new THREE.PointLight(palette.lampLight, 9, 0, 2);
  lampLight.position.set(LAMP.table.x, shadeY - 0.02, LAMP.table.z);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.002;
  lampLight.shadow.radius = 4;
  lampLight.shadow.camera.near = 0.05;
  group.add(lampLight);

  // Posters on the left wall.
  const posterMat = (t: THREE.Texture) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  const frameBlack = new THREE.MeshStandardMaterial({ color: "#1a1410", roughness: 0.5 });
  const hangPoster = (kind: "late-show" | "double-feature", z: number, y: number) => {
    const g = new THREE.Group();
    g.add(box(0.012, 0.79, 0.54, frameBlack));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), posterMat(tex.poster(kind)));
    art.rotation.y = Math.PI / 2;
    art.position.x = 0.0065;
    g.add(art);
    g.position.set(-ROOM.halfWidth + 0.008, y, z);
    return shadowed(g);
  };
  group.add(hangPoster("late-show", -3.05, 1.62), hangPoster("double-feature", -1.85, 1.55));

  // Coffee table.
  const coffee = new THREE.Group();
  const ct = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.045, 64), teak);
  ct.scale.set(0.72, 1, 0.42);
  ct.position.y = COFFEE_TABLE.top - 0.0225;
  coffee.add(ct);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.013, 0.42, 10), legMat);
      leg.position.set(sx * 0.46, 0.21, sz * 0.22);
      leg.rotation.z = sx * 0.12;
      leg.rotation.x = -sz * 0.12;
      coffee.add(leg);
    }
  }
  coffee.position.set(COFFEE_TABLE.center.x, 0, COFFEE_TABLE.center.z);
  group.add(shadowed(coffee));

  // Film cans: the reels foreshadow how phase 2 navigates.
  const canSide = new THREE.MeshStandardMaterial({ color: "#8f8a80", metalness: 0.75, roughness: 0.35 });
  const cans: [string, string][] = [
    ["Photos", palette.avocado],
    ["Projects", palette.burntOrange],
    ["Experience", palette.mustard],
  ];
  cans.forEach(([label, accent], i) => {
    const lid = new THREE.MeshStandardMaterial({ map: tex.canLid(label, accent), metalness: 0.3, roughness: 0.45 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.022, 40), [canSide, lid, canSide]);
    can.position.set(COFFEE_TABLE.center.x - 0.3 + i * 0.012, COFFEE_TABLE.top + 0.011 + i * 0.0225, COFFEE_TABLE.center.z - 0.12 - i * 0.008);
    can.rotation.y = 0.5 + i * 0.7;
    group.add(shadowed(can));
  });

  // Popcorn.
  const bowlProfile = [
    [0, 0],
    [0.055, 0],
    [0.06, 0.008],
    [0.1, 0.035],
    [0.125, 0.075],
    [0.13, 0.085],
    [0.122, 0.085],
    [0.117, 0.075],
    [0.093, 0.04],
    [0, 0.012],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(bowlProfile, 40),
    new THREE.MeshPhysicalMaterial({ color: "#7b4a28", roughness: 0.4, clearcoat: 0.5 }),
  );
  bowl.position.set(COFFEE_TABLE.center.x - 0.62, COFFEE_TABLE.top, COFFEE_TABLE.center.z - 0.05);
  const kernels = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.014, 0),
    new THREE.MeshStandardMaterial({ color: "#f3e3b5", roughness: 0.9, flatShading: true }),
    90,
  );
  const kr = rng(53);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = kr() * Math.PI * 2;
    const rad = Math.sqrt(kr()) * 0.1;
    const y = 0.045 + (1 - rad / 0.1) * 0.05 + kr() * 0.02;
    m4.compose(
      new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(kr() * 6, kr() * 6, kr() * 6)),
      new THREE.Vector3(1, 0.8 + kr() * 0.4, 1),
    );
    kernels.setMatrixAt(i, m4);
  }
  kernels.position.copy(bowl.position);
  group.add(shadowed(bowl), shadowed(kernels));

  // Ambient fill and moonlight through the window.
  const fill = new THREE.HemisphereLight("#6a4a35", "#1d130d", 0.9);
  group.add(fill);

  const moon = new THREE.DirectionalLight(palette.moonLight, 2.2);
  moon.position.set(ROOM.halfWidth + 4, 3.6, winZ + 0.8);
  moon.target.position.set(0.6, 0, winZ - 0.3);
  moon.castShadow = true;
  // The shadow camera covers the whole room, so moonlight only gets in through the window.
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -6;
  moon.shadow.camera.right = 6;
  moon.shadow.camera.top = 6;
  moon.shadow.camera.bottom = -6;
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 20;
  moon.shadow.bias = -0.001;
  moon.shadow.radius = 3;
  group.add(moon, moon.target);

  return {
    group,
    lamp: {
      light: lampLight,
      shade,
      bulb,
      position: lampLight.position.clone(),
    },
    fill,
    moon,
    windowGlass,
    screen: { mesh: screenMesh, material: screenMaterial },
  };
}
