import * as THREE from "three";

// The projector beam is a soft, additive frustum running from the lens to the
// corners of the projected picture, with dust drifting through it.

const noiseGLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

export interface Beam {
  group: THREE.Group;
  /** Beam strength, 0 to 1. Multiplied by the film's own brightness each frame. */
  update(time: number, strength: number, filmBrightness: number): void;
  /** Keep the dust the same size on screen at whatever resolution the room draws. */
  setPixelRatio(ratio: number): void;
}

export function buildBeam(lens: THREE.Vector3, corners: THREE.Vector3[]): Beam {
  const group = new THREE.Group();
  const axis = corners
    .reduce((acc, c) => acc.add(c), new THREE.Vector3())
    .multiplyScalar(1 / corners.length)
    .sub(lens)
    .normalize();

  // Near corners: a small square around the lens, facing the screen.
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(axis, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(side, axis).normalize();
  const n = 0.018;
  const near = [
    lens.clone().addScaledVector(side, -n).addScaledVector(realUp, -n),
    lens.clone().addScaledVector(side, n).addScaledVector(realUp, -n),
    lens.clone().addScaledVector(side, n).addScaledVector(realUp, n),
    lens.clone().addScaledVector(side, -n).addScaledVector(realUp, n),
  ];

  // Four side faces. uv.x runs across a face, uv.y from lens (0) to screen (1).
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let f = 0; f < 4; f++) {
    const a = near[f];
    const b = near[(f + 1) % 4];
    const c = corners[(f + 1) % 4];
    const d = corners[f];
    const base = positions.length / 3;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uColor: { value: new THREE.Color("#fff0d6") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${noiseGLSL}
      void main() {
        // max() keeps pow() away from tiny negative values at the edges, which would produce NaN.
        float across = pow(max(sin(vUv.x * 3.14159), 0.0), 1.6);
        float along = mix(1.0, 0.28, pow(vUv.y, 0.6));
        float nearFade = smoothstep(0.0, 0.03, vUv.y);
        float farFade = 1.0 - smoothstep(0.96, 1.0, vUv.y);
        vec3 drift = vec3(uTime * 0.04, uTime * 0.07, -uTime * 0.03);
        float smoke = 0.55 + 0.45 * noise(vWorld * 2.6 + drift) * noise(vWorld * 0.9 - drift);
        float a = uStrength * across * along * nearFade * farFade * smoke * 0.16;
        gl_FragColor = vec4(uColor * a, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beamMesh = new THREE.Mesh(geo, beamMat);
  beamMesh.frustumCulled = false;
  beamMesh.renderOrder = 10;
  group.add(beamMesh);

  // Dust inside the beam.
  const COUNT = 700;
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    seeds.set([Math.random(), Math.random(), Math.random(), 0.01 + Math.random() * 0.03], i * 4);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
  dustGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 4));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uNear: { value: near },
      uFar: { value: corners },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec3 uNear[4];
      uniform vec3 uFar[4];
      varying float vTwinkle;
      vec3 quad(vec3 q[4], vec2 st) {
        return mix(mix(q[0], q[1], st.x), mix(q[3], q[2], st.x), st.y);
      }
      void main() {
        float t = fract(aSeed.z + uTime * aSeed.w);
        vec2 st = aSeed.xy;
        st += 0.04 * vec2(sin(uTime * 0.3 + aSeed.z * 40.0), cos(uTime * 0.23 + aSeed.x * 30.0));
        st = clamp(st, 0.03, 0.97);
        vec3 p = mix(quad(uNear, st), quad(uFar, st), t);
        p.y += sin(uTime * 0.5 + aSeed.y * 20.0) * 0.02;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = 0.006 + 0.006 * fract(aSeed.x * 91.7);
        gl_PointSize = size * uPixelRatio * (900.0 / -mv.z);
        vTwinkle = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.0 + aSeed.w * 60.0) + aSeed.y * 50.0), 6.0))
          * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vTwinkle * uStrength;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a * 0.9, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 11;
  group.add(dust);

  return {
    group,
    update(time, strength, filmBrightness) {
      const s = strength * (0.35 + 0.65 * filmBrightness);
      beamMat.uniforms.uTime.value = time;
      beamMat.uniforms.uStrength.value = s;
      dustMat.uniforms.uTime.value = time;
      dustMat.uniforms.uStrength.value = s;
      group.visible = s > 0.001;
    },
    setPixelRatio(ratio) {
      dustMat.uniforms.uPixelRatio.value = ratio;
    },
  };
}

/** Faint dust drifting in the lamplight. Always on, scaled by the lamp level. */
export function buildRoomDust(center: THREE.Vector3, radius: number) {
  const COUNT = 220;
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    const dir = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * radius);
    seeds.set([dir.x, dir.y, dir.z, Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 1 },
      uCenter: { value: center.clone() },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec3 uCenter;
      varying float vA;
      void main() {
        vec3 p = uCenter + aSeed.xyz;
        p += vec3(sin(uTime * 0.11 + aSeed.w * 30.0), sin(uTime * 0.07 + aSeed.w * 12.0) * 0.6, cos(uTime * 0.09 + aSeed.w * 21.0)) * 0.12;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 0.007 * uPixelRatio * (900.0 / -mv.z);
        float d = length(aSeed.xyz);
        vA = (1.0 - smoothstep(0.2, 1.0, d / ${radius.toFixed(2)})) * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * 0.8 + aSeed.w * 80.0), 4.0));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * uStrength * 0.45;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(time: number, strength: number) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uStrength.value = strength;
      points.visible = strength > 0.001;
    },
    setPixelRatio(ratio: number) {
      mat.uniforms.uPixelRatio.value = ratio;
    },
  };
}
