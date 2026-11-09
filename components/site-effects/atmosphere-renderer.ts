import {
  Color, Mesh, NoBlending, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, Vector2, Vector4, WebGLRenderer,
} from "three";
import { atmosphereProfile, atmosphereField, type AtmospherePreset } from "../../lib/visual/atmosphere";
import type { PagePalette } from "../../lib/site/page-palette";
import { BLOOM_DEFAULTS, BLOOM_VERTEX_SHADER, bloomFragmentShader, bloomPixelRatio } from "../../lib/visual/bloom-shader";

export function createAtmosphereRenderer(canvas: HTMLCanvasElement, preset: AtmospherePreset, palette: PagePalette | null = null) {
  const profile = atmosphereProfile(preset, palette);
  const renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, depth: false, stencil: false });
  const geometry = new PlaneGeometry(2, 2);
  const uniforms = {
    uResolution: { value: new Vector2() },
    // Match the native photo renderer: compose CSS/sRGB values before linear grain.
    uBackground: { value: new Color(profile.background).convertLinearToSRGB() },
    uColours: { value: profile.colours.map((hex) => new Color(hex).convertLinearToSRGB()) },
    uOrbs: { value: profile.colours.map(() => new Vector4()) },
    uOrbActive: { value: new Float32Array(BLOOM_DEFAULTS.maxColours) },
    uOrbScale: { value: new Float32Array(BLOOM_DEFAULTS.maxColours) },
    uOrbFrame: { value: 0 },
    uTime: { value: 0 },
    uGrainStrength: { value: palette ? .005 : BLOOM_DEFAULTS.grainStrength },
    uGrainSize: { value: BLOOM_DEFAULTS.grainSize },
    uPointer: { value: new Vector2() },
    uWaveStrength: { value: 0 },
    uDrift: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    dithering: true,
    vertexShader: BLOOM_VERTEX_SHADER,
    fragmentShader: bloomFragmentShader({ wave: true }),
  });
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let width = 0;
  let height = 0;
  let ratio = 0;
  let shaderFailed = false;
  renderer.debug.onShaderError = () => { shaderFailed = true; };

  return {
    render(seconds: number, reducedMotion: boolean, pointer: { x: number; y: number; strength: number }) {
      if (shaderFailed || renderer.getContext().isContextLost()) return false;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return false;
      const nextRatio = bloomPixelRatio(w, h, window.devicePixelRatio);
      if (w !== width || h !== height || nextRatio !== ratio) {
        width = w;
        height = h;
        ratio = nextRatio;
        renderer.setPixelRatio(ratio);
        renderer.setSize(w, h, false);
        uniforms.uResolution.value.set(w, h);
      }
      for (let i = 0; i < BLOOM_DEFAULTS.maxColours; i++) {
        const field = atmosphereField(i, seconds, reducedMotion);
        uniforms.uOrbs.value[i].set(field.x * w, field.y * h, field.radius * Math.max(w, h),
          field.opacity * (i >= 5 ? profile.accentOpacity : profile.washOpacity));
        // Warm reading pages have no decorative point lights.
        uniforms.uOrbScale.value[i] = palette || preset === "journal" ? 0 : field.lightScale;
      }
      uniforms.uTime.value = reducedMotion ? 0 : (seconds * BLOOM_DEFAULTS.grainSpeed) % 1;
      uniforms.uOrbFrame.value = reducedMotion ? 0 : Math.floor(seconds * 1000 / BLOOM_DEFAULTS.orbFrameMs);
      uniforms.uDrift.value = reducedMotion ? 0 : seconds;
      uniforms.uPointer.value.set(pointer.x * w, pointer.y * h);
      uniforms.uWaveStrength.value = reducedMotion ? 0 : pointer.strength;
      renderer.render(scene, camera);
      return !shaderFailed;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
