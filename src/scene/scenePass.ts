import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { CopyShader } from "three/addons/shaders/CopyShader.js";

/**
 * Draws the scene anti-aliased into a multisampled target of its own, then hands the passes after it
 * (bloom, color, film) a plain copy. Only the scene needs the extra samples: when every pass wrote to
 * multisampled buffers, the anti-aliasing cost more than the rest of the frame put together.
 */
export class ScenePass extends Pass {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private target: THREE.WebGLRenderTarget;
  private material: THREE.ShaderMaterial;
  private copy: FullScreenQuad;

  constructor(scene: THREE.Scene, camera: THREE.Camera, samples: number) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new FullScreenQuad(this.material);
  }

  /** Anti-aliasing samples. 0 draws the scene straight into the composer's buffer. */
  get samples() {
    return this.target.samples;
  }

  set samples(n: number) {
    if (n === this.target.samples) return;
    this.target.samples = n;
    this.target.dispose();
  }

  setSize(width: number, height: number) {
    this.target.setSize(width, height);
  }

  render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    if (this.target.samples === 0) {
      renderer.setRenderTarget(readBuffer);
      renderer.render(this.scene, this.camera);
      return;
    }
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    this.material.uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(readBuffer);
    this.copy.render(renderer);
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.copy.dispose();
  }
}
