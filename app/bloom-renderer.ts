import {
  Color, Mesh, NoBlending, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, Vector2, Vector4, WebGLRenderer,
} from "three";
import { gradientDiameterVw, orbPulseScale, ORB_GRAIN_FRAME_MS, type GradientOrbColour } from "./gradient-orb";
import type { OrbPositions } from "./bloom-layer";

// Grain is applied in linear light; its size is in CSS pixels, independent of DPR.
const GRAIN_STRENGTH = 0.035;
const GRAIN_SIZE = 1;
const GRAIN_SPEED = 1;
const MAX_COLOURS = 7;
const MAX_PIXEL_RATIO = 1.5;
const MAX_PIXELS = 2_500_000;

export function createBloomRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, depth: false, stencil: false });
  const geometry = new PlaneGeometry(2, 2);
  const uniforms = {
    uResolution: { value: new Vector2() },
    uBackground: { value: new Color() },
    uColours: { value: Array.from({ length: MAX_COLOURS }, () => new Color()) },
    uOrbs: { value: Array.from({ length: MAX_COLOURS }, () => new Vector4()) },
    uOrbActive: { value: new Float32Array(MAX_COLOURS) },
    uOrbScale: { value: new Float32Array(MAX_COLOURS) },
    uOrbFrame: { value: 0 },
    uTime: { value: 0 },
    uGrainStrength: { value: GRAIN_STRENGTH },
    uGrainSize: { value: GRAIN_SIZE },
  };
  const material = new ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    dithering: true,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      #include <common>
      #include <dithering_pars_fragment>
      uniform vec2 uResolution;
      uniform vec3 uBackground;
      uniform vec3 uColours[${MAX_COLOURS}];
      uniform vec4 uOrbs[${MAX_COLOURS}];
      uniform float uOrbActive[${MAX_COLOURS}];
      uniform float uOrbScale[${MAX_COLOURS}];
      uniform float uOrbFrame;
      uniform float uTime;
      uniform float uGrainStrength;
      uniform float uGrainSize;
      varying vec2 vUv;

      void main() {
        vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
        // Compose in sRGB to retain the CSS gradients' palette and overlap colours.
        vec3 colour = uBackground;
        for (int i = 0; i < ${MAX_COLOURS}; i++) {
          vec4 orb = uOrbs[i];
          float radius = max(orb.z, 1.0);
          float distanceFromCentre = length(pixel - orb.xy) / radius;
          float falloff = 1.0 - smoothstep(0.0, 1.0, distanceFromCentre);
          colour = mix(colour, uColours[i], falloff * orb.w);
        }

        colour = sRGBTransferEOTF(vec4(colour, 1.0)).rgb;
        vec2 cell = floor(pixel / uGrainSize);
        float seed = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        float noise = fract(seed + uTime) - 0.5;
        // Fade at black to avoid lifting shadows when negative noise would clip.
        float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
        float shadowMask = smoothstep(0.0, 0.06, luminance);
        colour = clamp(colour + noise * uGrainStrength * shadowMask, 0.0, 1.0);

        // Draw the selectable orbs into the same image as the gradients. Screen
        // each four-CSS-pixel sample against the finished background colour.
        vec3 screened = sRGBTransferOETF(vec4(colour, 1.0)).rgb;
        for (int i = 0; i < ${MAX_COLOURS}; i++) {
          vec4 orb = uOrbs[i];
          if (orb.w == 0.0) continue;

          vec2 local = pixel - orb.xy;
          float orbScale = uOrbScale[i];
          float distancePx = length(local) / orbScale;
          if (distancePx > 48.0) continue;

          float orbActivity = uOrbActive[i];
          float softGlow = (1.0 - smoothstep(16.0, 48.0, distancePx)) * (0.2 + orbActivity * 0.12);
          screened = 1.0 - (1.0 - screened) * (1.0 - uColours[i] * softGlow);

          // Keep grain cells at 4 CSS pixels while the orb occupies more cells.
          vec2 orbCell = floor(local / 4.0) + vec2(8.0);
          float cellDistance = length(orbCell - vec2(7.5)) / orbScale;
          if (cellDistance > 7.5) continue;

          float orbSeed = fract(sin(dot(orbCell, vec2(12.9898, 78.233)) + uOrbFrame * 37.719) * 43758.5453);
          float orbNoise = orbSeed - 0.5;
          float core = 1.0 - step(3.6, cellDistance);
          float glow = max(0.0, 1.0 - max(0.0, cellDistance - 3.4) / 4.1);
          float highlight = core * max(0.0, 1.0 - cellDistance / 4.0) * 0.28;
          float grain = mix(orbNoise * 0.2, orbNoise * 0.45, core);
          float light = mix(0.08 + glow * 0.12, 0.13 + highlight, core);
          vec3 orbColour = clamp(uColours[i] * (1.0 + grain) + (1.0 - uColours[i]) * light, 0.0, 1.0);
          float orbAlpha = mix(185.0 / 255.0 * glow * (0.85 + orbNoise * 0.3), 1.0, core);
          screened = 1.0 - (1.0 - screened) * (1.0 - orbColour * orbAlpha);
        }
        colour = sRGBTransferEOTF(vec4(screened, 1.0)).rgb;
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
        #include <dithering_fragment>
      }
    `,
  });
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scales = new Map<string, number>();
  const scratchColour = new Color();
  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let shaderFailed = false;
  let needsRender = true;
  let grainTime = 0;

  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    shaderFailed = true;
    console.error("Bloom shader failed to compile", {
      program: gl.getProgramInfoLog(program),
      vertex: gl.getShaderInfoLog(vertexShader),
      fragment: gl.getShaderInfoLog(fragmentShader),
    });
  };

  return {
    render({ colours, positions, selectedId, hoveredId, backgroundColour, stageLeft, stageTop, time, delta, reducedMotion }: {
      colours: GradientOrbColour[];
      positions: OrbPositions;
      selectedId: string | null;
      hoveredId: string | null;
      backgroundColour: string;
      stageLeft: number;
      stageTop: number;
      time: number;
      delta: number;
      reducedMotion: boolean;
    }) {
      if (renderer.getContext().isContextLost() || shaderFailed) {
        needsRender = true;
        return false;
      }

      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      if (!nextWidth || !nextHeight) return false;
      const nextRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, Math.sqrt(MAX_PIXELS / (nextWidth * nextHeight)));
      if (width !== nextWidth || height !== nextHeight || pixelRatio !== nextRatio) {
        width = nextWidth;
        height = nextHeight;
        pixelRatio = nextRatio;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        uniforms.uResolution.value.set(width, height);
        needsRender = true;
      }

      scratchColour.set(backgroundColour).convertLinearToSRGB();
      if (!uniforms.uBackground.value.equals(scratchColour)) needsRender = true;
      uniforms.uBackground.value.copy(scratchColour);
      const frameSeconds = Math.min(delta, 50) / 1000;
      for (let i = 0; i < MAX_COLOURS; i++) {
        const colour = colours[i];
        const position = colour && positions[colour.id];
        const orb = uniforms.uOrbs.value[i];
        if (!colour || !position) {
          if (orb.w !== 0) needsRender = true;
          orb.w = 0;
          uniforms.uOrbActive.value[i] = 0;
          uniforms.uOrbScale.value[i] = 1;
          continue;
        }
        const target = selectedId === colour.id ? 2 : 1;
        const previousScale = scales.get(colour.id) ?? 1;
        let scale = reducedMotion ? target : previousScale + (target - previousScale) * (1 - Math.exp(-frameSeconds * 12));
        if (Math.abs(target - scale) < 0.001) scale = target;
        scales.set(colour.id, scale);
        // The old radial gradient faded at 72% of its corner radius.
        const radius = gradientDiameterVw(colour.weight, colours.length) * window.innerWidth / 100 * 0.51 * scale;
        const x = stageLeft + position.x;
        const y = stageTop + position.y;
        if (orb.x !== x || orb.y !== y || orb.z !== radius || orb.w !== 0.8) needsRender = true;
        orb.set(x, y, radius, 0.8);
        const active = selectedId === colour.id || hoveredId === colour.id ? 1 : 0;
        if (uniforms.uOrbActive.value[i] !== active) needsRender = true;
        uniforms.uOrbActive.value[i] = active;
        const orbScale = gradientDiameterVw(colour.weight, colours.length) / 100 * (1 + (scale - 1) * 0.5)
          * orbPulseScale(colour.id, colour.weight, colours.length, time, reducedMotion);
        if (uniforms.uOrbScale.value[i] !== orbScale) needsRender = true;
        uniforms.uOrbScale.value[i] = orbScale;
        scratchColour.set(colour.hex).convertLinearToSRGB();
        if (!uniforms.uColours.value[i].equals(scratchColour)) needsRender = true;
        uniforms.uColours.value[i].copy(scratchColour);
      }

      if (!reducedMotion) {
        grainTime = (grainTime + frameSeconds * GRAIN_SPEED) % 1;
        uniforms.uTime.value = grainTime;
        needsRender = true;
      }
      const orbFrame = reducedMotion ? 0 : Math.floor(time / ORB_GRAIN_FRAME_MS);
      if (uniforms.uOrbFrame.value !== orbFrame) needsRender = true;
      uniforms.uOrbFrame.value = orbFrame;
      if (needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
      }
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
