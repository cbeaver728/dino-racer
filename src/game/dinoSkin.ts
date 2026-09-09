import * as THREE from 'three'
import type { SkinType } from './dinosaurTypes'

/**
 * Skin as shading rather than geometry.
 *
 * Spots used to be floating ellipsoids and stripes were torus rings threaded
 * over the body, so both sat visibly *on* the dinosaur instead of being part of
 * it. This patches MeshStandardMaterial to compute the pale underside, the
 * spots and the stripes procedurally in object space, which paints the body,
 * neck and tail as one continuous hide.
 */

const PATTERN_GLSL = /* glsl */ `
varying vec3 vDinoPos;
varying vec3 vDinoNormal;
varying float vDinoWorldScale;
uniform vec3 uBase;
uniform vec3 uBelly;
uniform vec3 uPattern;
uniform vec3 uOffset;
uniform float uMode;
uniform float uScale;

float dinoHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float dinoNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dinoHash(i), dinoHash(i + vec3(1,0,0)), f.x),
                 mix(dinoHash(i + vec3(0,1,0)), dinoHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dinoHash(i + vec3(0,0,1)), dinoHash(i + vec3(1,0,1)), f.x),
                 mix(dinoHash(i + vec3(0,1,1)), dinoHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// Irregular packed scales. The gap between the nearest two cells forms the
// creases; no texture downloads, UV seams, or additional draw calls are needed.
float dinoScalePlane(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float nearest = 8.0, second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 at = vec2(float(x), float(y));
      vec2 id = cell + at;
      vec2 jitter = vec2(dinoHash(vec3(id, 2.1)), dinoHash(vec3(id, 7.8)));
      vec2 d = at + 0.24 + jitter * 0.52 - f;
      float distance2 = dot(d, d);
      second = min(second, max(nearest, distance2));
      nearest = min(nearest, distance2);
    }
  }
  return smoothstep(0.02, 0.24, second - nearest) * (1.0 - nearest * 0.28);
}

float dinoRelief(vec3 p, vec3 n) {
  vec3 weights = pow(abs(n), vec3(4.0));
  weights /= max(dot(weights, vec3(1.0)), 0.0001);
  vec3 q = p * 18.0;
  float scales = dot(weights, vec3(dinoScalePlane(q.yz), dinoScalePlane(q.xz), dinoScalePlane(q.xy)));
  // Subpixel scales fade to their average, preventing crawling/shimmer in the
  // race's distant cameras and on phone displays.
  float footprint = max(length(dFdx(q)), length(dFdy(q)));
  return mix(scales, 0.58, smoothstep(0.45, 1.4, footprint));
}

vec3 dinoBumpNormal(vec3 surfacePosition, vec3 surfaceNormal, float height) {
  vec3 dx = dFdx(surfacePosition), dy = dFdy(surfacePosition);
  vec3 r1 = cross(dy, surfaceNormal), r2 = cross(surfaceNormal, dx);
  float determinant = dot(dx, r1);
  vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(determinant) * surfaceNormal - gradient);
}

// Scattered round spots: one candidate per cell, jittered inside it, with a
// per-cell radius so they do not read as a regular grid.
float dinoSpots(vec3 p) {
  float cell = 0.54;
  vec3 id = floor(p / cell);
  float mask = 0.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      for (int k = -1; k <= 1; k++) {
        vec3 nid = id + vec3(float(i), float(j), float(k));
        vec3 jitter = vec3(dinoHash(nid + 1.7), dinoHash(nid + 5.3), dinoHash(nid + 9.1));
        vec3 center = (nid + jitter) * cell;
        float radius = cell * (0.32 + 0.2 * dinoHash(nid + 13.9));
        float present = step(0.22, dinoHash(nid));
        float blob = 1.0 - smoothstep(radius * 0.68, radius, distance(p, center));
        mask = max(mask, present * blob);
      }
    }
  }
  return mask;
}

// Bands around the girth, wobbled slightly so they are not mechanical.
float dinoStripes(vec3 p) {
  float w = p.x * 1.15 + sin(p.y * 2.7 + p.x) * 0.18 + sin(p.z * 3.3) * 0.12;
  float band = abs(fract(w) - 0.5) * 2.0;
  return 1.0 - smoothstep(0.3, 0.46, band);
}

vec3 dinoSkinColor(vec3 p, vec3 n, float relief) {
  float mottling = dinoNoise(p * 3.2);
  float fine = dinoNoise(p * 12.0 + 4.7);
  float under = smoothstep(-0.65, 0.42, n.y + (mottling - 0.5) * 0.25);
  vec3 color = mix(uBelly, uBase, under);
  // Soft countershading, pigment clouds, and smaller speckles make even Plain
  // a detailed hide; the player's chosen pattern remains a separate layer.
  color *= mix(0.78, 1.09, mottling) * mix(0.94, 1.05, fine);
  color *= 1.0 - smoothstep(0.28, 0.95, n.y) * 0.22;

  float mask = 0.0;
  if (uMode > 1.5) mask = dinoStripes(p);
  else if (uMode > 0.5) mask = dinoSpots(p);

  // Fade the pattern over the pale belly so the underside stays readable.
  mask *= mix(0.22, 1.0, under);
  color = mix(color, uPattern * mix(0.72, 1.08, mottling), mask * 0.72);
  return color * mix(0.94, 1.025, relief);
}
`

export interface DinoSkinOptions {
  base: string
  belly: string
  pattern: string
  skin: SkinType
  scale?: number
}

const MODE: Record<SkinType, number> = { Plain: 0, Spotted: 1, Striped: 2 }

export interface DinoSkinMaterial extends THREE.MeshStandardMaterial {
  /** Shifts pattern space so separately-positioned parts stay continuous. */
  setPatternOffset(offset: THREE.Vector3Like): void
  applySkin(options: DinoSkinOptions): void
}

export function createDinoSkinMaterial(options: DinoSkinOptions): DinoSkinMaterial {
  const uniforms = {
    uBase: { value: new THREE.Color(options.base) },
    uBelly: { value: new THREE.Color(options.belly) },
    uPattern: { value: new THREE.Color(options.pattern) },
    uOffset: { value: new THREE.Vector3() },
    uMode: { value: MODE[options.skin] },
    uScale: { value: options.scale ?? 1 },
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.35,
  }) as DinoSkinMaterial

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDinoPos;\nvarying vec3 vDinoNormal;\nvarying float vDinoWorldScale;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tvDinoNormal = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvDinoPos = transformed;\nvDinoWorldScale = length(modelViewMatrix[0].xyz);')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PATTERN_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 dinoP = vDinoPos * uScale + uOffset;
        vec3 dinoN = normalize(vDinoNormal);
        float dinoHeight = dinoRelief(dinoP, dinoN);
        diffuseColor.rgb *= dinoSkinColor(dinoP, dinoN, dinoHeight);`,
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(0.9 - dinoHeight * 0.19, 0.65, 0.94);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = dinoBumpNormal(-vViewPosition, normal, dinoHeight * 0.002 * vDinoWorldScale / uScale);`)
  }
  material.customProgramCacheKey = () => 'dino-hide-scales-v2'

  material.setPatternOffset = (offset) => {
    uniforms.uOffset.value.set(offset.x, offset.y, offset.z)
  }

  material.applySkin = (next) => {
    uniforms.uBase.value.set(next.base)
    uniforms.uBelly.value.set(next.belly)
    uniforms.uPattern.value.set(next.pattern)
    uniforms.uMode.value = MODE[next.skin]
    uniforms.uScale.value = next.scale ?? 1
  }

  return material
}
