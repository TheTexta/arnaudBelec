/*
 * Fluid solver adapted from WebGL Fluid Simulation by Pavel Dobryakov.
 * https://paveldogreat.github.io/WebGL-Fluid-Simulation/
 *
 * MIT License — Copyright (c) 2017 Pavel Dobryakov
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {
  HalfFloatType, Mesh, NearestFilter, NoBlending, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import type { HomePalette } from "../site/homepage";

export type FluidPointer = { x: number; y: number; dx: number; dy: number; moved: boolean };
export const FLUID_LIMITS = { simulation: 112, dye: 384, pixelRatio: 1.5, pixels: 2_000_000, pressureIterations: 14 };
const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const common = `precision highp float;
varying vec2 vUv;
uniform sampler2D inputTexture, velocity, pressure, curls;
uniform vec2 texel;
uniform float dt;
vec4 sampleLinear(sampler2D source, vec2 point, vec2 size) {
  vec2 grid = point / size - .5, cell = floor(grid), f = fract(grid);
  return mix(mix(texture2D(source, (cell + vec2(.5, .5)) * size), texture2D(source, (cell + vec2(1.5, .5)) * size), f.x),
    mix(texture2D(source, (cell + vec2(.5, 1.5)) * size), texture2D(source, (cell + vec2(1.5, 1.5)) * size), f.x), f.y);
}`;

// Composite pigment weights over the filler: adding RGB to a light ground
// instead would wash the editor's selected colours out to white.
const displayShader = `uniform vec3 colourA, colourB, background;
uniform vec2 dyeTexel, screenSize;
void main() {
  vec2 dye = max(sampleLinear(inputTexture, vUv, dyeTexel).rg, 0.0);
  float density = dye.r + dye.g;
  vec3 pigment = (colourA * dye.r + colourB * dye.g) / max(density, .0001);
  vec3 colour = mix(background, pigment, smoothstep(.04, .92, density));
  vec2 pixel = floor(vUv * screenSize);
  float grain = fract(sin(dot(pixel, vec2(12.9898, 78.233))) * 43758.5453) - .5;
  gl_FragColor = vec4(clamp(colour + grain / 180.0, 0.0, 1.0), 1.0);
}`;

export function createFluidRenderer(canvas: HTMLCanvasElement, palette: HomePalette) {
  const renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: "low-power" });
  if (!renderer.extensions.has("EXT_color_buffer_float")) {
    renderer.dispose();
    throw new Error("Floating-point fluid targets are unavailable.");
  }
  renderer.autoClear = false;
  renderer.debug.onShaderError = () => { throw new Error("The homepage fluid shader could not compile."); };
  const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const materials: ShaderMaterial[] = [];
  function material(fragment: string, extra = {}) {
    const shader = new ShaderMaterial({ vertexShader, fragmentShader: common + fragment, depthTest: false, depthWrite: false, blending: NoBlending,
      uniforms: { inputTexture: { value: null }, velocity: { value: null }, pressure: { value: null }, curls: { value: null }, texel: { value: new Vector2() }, dt: { value: 0 }, ...extra } });
    materials.push(shader);
    return shader;
  }
  const advection = material(`uniform vec2 sourceTexel; uniform float decay;
    void main() { vec2 point = vUv - dt * sampleLinear(velocity, vUv, texel).xy * texel;
      gl_FragColor = sampleLinear(inputTexture, point, sourceTexel) / (1.0 + decay * dt); }`,
  { sourceTexel: { value: new Vector2() }, decay: { value: 0 } });
  const curl = material(`void main() {
    float l = texture2D(velocity, vUv - vec2(texel.x, 0.)).y;
    float r = texture2D(velocity, vUv + vec2(texel.x, 0.)).y;
    float t = texture2D(velocity, vUv + vec2(0., texel.y)).x;
    float b = texture2D(velocity, vUv - vec2(0., texel.y)).x;
    gl_FragColor = vec4(.5 * (r-l-t+b), 0., 0., 1.); }`);
  const vorticity = material(`void main() {
    float l = texture2D(curls, vUv - vec2(texel.x, 0.)).r;
    float r = texture2D(curls, vUv + vec2(texel.x, 0.)).r;
    float t = texture2D(curls, vUv + vec2(0., texel.y)).r;
    float b = texture2D(curls, vUv - vec2(0., texel.y)).r;
    float c = texture2D(curls, vUv).r;
    vec2 force = .5 * vec2(abs(t)-abs(b), abs(r)-abs(l));
    force /= length(force) + .0001; force *= 22. * c; force.y *= -1.;
    gl_FragColor = vec4(clamp(texture2D(velocity, vUv).xy + dt * force, -250., 250.), 0., 1.); }`);
  const divergence = material(`void main() {
    float l = texture2D(velocity, vUv - vec2(texel.x, 0.)).x;
    float r = texture2D(velocity, vUv + vec2(texel.x, 0.)).x;
    float t = texture2D(velocity, vUv + vec2(0., texel.y)).y;
    float b = texture2D(velocity, vUv - vec2(0., texel.y)).y;
    vec2 c = texture2D(velocity, vUv).xy;
    if (vUv.x < texel.x) l = -c.x; if (vUv.x > 1.-texel.x) r = -c.x;
    if (vUv.y < texel.y) b = -c.y; if (vUv.y > 1.-texel.y) t = -c.y;
    gl_FragColor = vec4(.5 * (r-l+t-b), 0., 0., 1.); }`);
  const pressure = material(`void main() {
    float l = texture2D(pressure, vUv - vec2(texel.x, 0.)).r;
    float r = texture2D(pressure, vUv + vec2(texel.x, 0.)).r;
    float t = texture2D(pressure, vUv + vec2(0., texel.y)).r;
    float b = texture2D(pressure, vUv - vec2(0., texel.y)).r;
    gl_FragColor = vec4((l+r+t+b-texture2D(inputTexture, vUv).r) * .25, 0., 0., 1.); }`);
  const subtract = material(`void main() {
    float l = texture2D(pressure, vUv - vec2(texel.x, 0.)).r;
    float r = texture2D(pressure, vUv + vec2(texel.x, 0.)).r;
    float t = texture2D(pressure, vUv + vec2(0., texel.y)).r;
    float b = texture2D(pressure, vUv - vec2(0., texel.y)).r;
    gl_FragColor = vec4(texture2D(velocity, vUv).xy - vec2(r-l, t-b), 0., 1.); }`);
  const splat = material(`uniform vec2 point; uniform vec3 amount; uniform float aspect, radius;
    void main() { vec2 p = vUv - point; p.x *= aspect;
      gl_FragColor = vec4(texture2D(inputTexture, vUv).xyz + exp(-dot(p,p) / radius) * amount, 1.); }`,
  { point: { value: new Vector2() }, amount: { value: new Vector3() }, aspect: { value: 1 }, radius: { value: .0025 } });
  const seed = material(`uniform float seedVelocity;
    void main() {
      vec2 p = vUv;
      float wave = sin(p.y * 8. + sin(p.x * 7.) * .7) * .12;
      float a = exp(-pow((p.x - .18 - wave) * 2.8, 2.) - pow((p.y - .63) * 1.6, 2.)) * 1.2;
      float b = exp(-pow((p.x - .82 + wave) * 2.2, 2.) - pow((p.y - .28) * 1.8, 2.)) * 1.25;
      vec2 flow = vec2(sin(p.y * 9. + p.x * 3.), cos(p.x * 8. - p.y * 2.)) * 14.;
      gl_FragColor = vec4(mix(vec2(a,b), flow, seedVelocity), 0., 1.); }`,
  { seedVelocity: { value: 0 } });
  const colour = (hex: string) => new Vector3(...[1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number]);
  const display = material(displayShader, { colourA: { value: colour(palette.fluidA) }, colourB: { value: colour(palette.fluidB) }, background: { value: colour(palette.background) }, dyeTexel: { value: new Vector2() }, screenSize: { value: new Vector2() } });
  const quad = new Mesh(geometry, display); quad.frustumCulled = false; scene.add(quad);
  const targets: WebGLRenderTarget[] = [];
  function target(width: number, height: number) {
    const result = new WebGLRenderTarget(width, height, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false, stencilBuffer: false });
    targets.push(result); return result;
  }
  function pair(width: number, height: number) {
    return { read: target(width, height), write: target(width, height), swap() { [this.read, this.write] = [this.write, this.read]; } };
  }
  let flow: ReturnType<typeof pair>, dye: ReturnType<typeof pair>, pressures: ReturnType<typeof pair>, divergenceTarget: WebGLRenderTarget, curlTarget: WebGLRenderTarget;
  let width = 0, height = 0, aspect = 1, disposed = false;
  let simTexel = new Vector2(), dyeTexel = new Vector2();
  function pass(shader: ShaderMaterial, output: WebGLRenderTarget | null) {
    quad.material = shader; renderer.setRenderTarget(output); renderer.render(scene, camera);
  }
  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth)), h = Math.max(1, Math.round(canvas.clientHeight));
    if (w === width && h === height) return;
    width = w; height = h; aspect = w / h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, FLUID_LIMITS.pixelRatio, Math.sqrt(FLUID_LIMITS.pixels / (w * h))));
    renderer.setSize(w, h, false);
    for (const old of targets) old.dispose(); targets.length = 0;
    const dimensions = (resolution: number) => aspect >= 1 ? [Math.min(768, Math.round(resolution * aspect)), resolution] : [resolution, Math.min(768, Math.round(resolution / aspect))];
    const [sw, sh] = dimensions(FLUID_LIMITS.simulation), [dw, dh] = dimensions(FLUID_LIMITS.dye);
    flow = pair(sw, sh); dye = pair(dw, dh); pressures = pair(sw, sh);
    divergenceTarget = target(sw, sh); curlTarget = target(sw, sh);
    simTexel = new Vector2(1 / sw, 1 / sh); dyeTexel = new Vector2(1 / dw, 1 / dh);
    for (const shader of materials) shader.uniforms.texel.value.copy(simTexel);
    for (const buffer of targets) { renderer.setRenderTarget(buffer); renderer.clear(); }
    seed.uniforms.seedVelocity.value = 0; pass(seed, dye.read);
    seed.uniforms.seedVelocity.value = 1; pass(seed, flow.read);
    display.uniforms.dyeTexel.value.copy(dyeTexel);
    display.uniforms.screenSize.value.set(canvas.width, canvas.height);
    splat.uniforms.aspect.value = aspect;
  }
  function inject(buffer: ReturnType<typeof pair>, x: number, y: number, a: number, b: number, radius: number) {
    splat.uniforms.inputTexture.value = buffer.read.texture;
    splat.uniforms.point.value.set(x, y); splat.uniforms.amount.value.set(a, b, 0); splat.uniforms.radius.value = radius;
    pass(splat, buffer.write); buffer.swap();
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const buffer of targets) buffer.dispose();
    for (const shader of materials) shader.dispose();
    geometry.dispose(); renderer.dispose();
  }
  try { resize(); } catch (error) { dispose(); throw error; }
  return {
    render(delta: number, seconds: number, pointer: FluidPointer) {
      if (disposed) return;
      resize();
      const dt = Math.min(Math.max(delta, 0), 1 / 30);
      if (dt > 0) {
        if (pointer.moved) {
          inject(flow, pointer.x, pointer.y, pointer.dx * 2800, pointer.dy * 2800, .0025);
          const blend = .5 + .5 * Math.sin(seconds * .65);
          inject(dye, pointer.x, pointer.y, blend * .85, (1 - blend) * .85, .0035);
        }
        const drift = seconds * .12;
        inject(dye, .1 + Math.sin(drift) * .06, .65 + Math.cos(drift) * .14, dt * .14, 0, .045);
        inject(dye, .86 + Math.cos(drift) * .04, .3 + Math.sin(drift) * .16, 0, dt * .14, .055);
        curl.uniforms.velocity.value = flow.read.texture; pass(curl, curlTarget);
        vorticity.uniforms.velocity.value = flow.read.texture; vorticity.uniforms.curls.value = curlTarget.texture; vorticity.uniforms.dt.value = dt;
        pass(vorticity, flow.write); flow.swap();
        divergence.uniforms.velocity.value = flow.read.texture; pass(divergence, divergenceTarget);
        renderer.setRenderTarget(pressures.read); renderer.clear();
        pressure.uniforms.inputTexture.value = divergenceTarget.texture;
        for (let i = 0; i < FLUID_LIMITS.pressureIterations; i++) {
          pressure.uniforms.pressure.value = pressures.read.texture; pass(pressure, pressures.write); pressures.swap();
        }
        subtract.uniforms.pressure.value = pressures.read.texture; subtract.uniforms.velocity.value = flow.read.texture;
        pass(subtract, flow.write); flow.swap();
        advection.uniforms.dt.value = dt; advection.uniforms.velocity.value = flow.read.texture;
        advection.uniforms.inputTexture.value = flow.read.texture; advection.uniforms.sourceTexel.value.copy(simTexel); advection.uniforms.decay.value = .18;
        pass(advection, flow.write); flow.swap();
        advection.uniforms.velocity.value = flow.read.texture; advection.uniforms.inputTexture.value = dye.read.texture;
        advection.uniforms.sourceTexel.value.copy(dyeTexel); advection.uniforms.decay.value = .055;
        pass(advection, dye.write); dye.swap();
      }
      display.uniforms.inputTexture.value = dye.read.texture; pass(display, null);
    },
    dispose,
  };
}
