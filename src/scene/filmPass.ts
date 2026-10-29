import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Whole-frame film look: grain, gate weave, flicker, vignette, a warm cast,
 * and a fade to black. Runs after tone mapping, in display color space.
 */
export function createFilmPass() {
  const pass = new ShaderPass({
    name: "FilmLookShader",
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uGrain: { value: 0.05 },
      uWeave: { value: 0 },
      uFlicker: { value: 0 },
      uVignette: { value: 0.35 },
      uWarmth: { value: 0.06 },
      uFade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uGrain;
      uniform float uWeave;
      uniform float uFlicker;
      uniform float uVignette;
      uniform float uWarmth;
      uniform float uFade;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        // Film advances at 18 frames per second; weave and flicker step with it.
        float frame = floor(uTime * 18.0);
        vec2 weave = vec2(hash(vec2(frame, 1.7)) - 0.5, hash(vec2(frame, 9.1)) - 0.5) * 2.0;
        vec2 uv = vUv + weave * uWeave / uResolution;
        vec3 color = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;

        float flicker = 1.0 - uFlicker * hash(vec2(frame, 3.3));
        color *= flicker;

        // Warm, slightly faded print.
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(color, luma * vec3(1.08, 0.98, 0.82), uWarmth);

        // Grain, strongest in the midtones.
        float g = hash(vUv * uResolution + fract(uTime * 7.13) * 100.0) - 0.5;
        color += g * uGrain * (0.4 + luma * (1.0 - luma) * 2.4);

        // Vignette.
        vec2 d = vUv - 0.5;
        float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.85)));
        color *= mix(1.0, v, uVignette);

        color *= 1.0 - uFade;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return pass;
}
