import {
  Color, Mesh, NoBlending, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, Vector2, Vector4, WebGLRenderer,
} from "three";
import { gradientDiameterVw, orbPulseScale, ORB_GRAIN_FRAME_MS, type GradientOrbColour } from "./gradient-orb";
import type { OrbPositions } from "./bloom-layer";
import { BLOOM_DEFAULTS, BLOOM_VERTEX_SHADER, bloomFragmentShader, bloomPixelRatio } from "../lib/visual/bloom-shader";

// Grain is applied in linear light; its size is in CSS pixels, independent of DPR.
const { grainStrength: GRAIN_STRENGTH, grainSize: GRAIN_SIZE, grainSpeed: GRAIN_SPEED, maxColours: MAX_COLOURS } = BLOOM_DEFAULTS;

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
    vertexShader: BLOOM_VERTEX_SHADER,
    fragmentShader: bloomFragmentShader(),
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
      const nextRatio = bloomPixelRatio(nextWidth, nextHeight, window.devicePixelRatio);
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
