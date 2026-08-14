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
uniform vec3 uBase;
uniform vec3 uBelly;
uniform vec3 uPattern;
uniform vec3 uOffset;
uniform float uMode;

float dinoHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
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
  float w = p.x * 1.15 + sin(p.y * 1.7) * 0.15 + sin(p.z * 1.3) * 0.09;
  float band = abs(fract(w) - 0.5) * 2.0;
  return 1.0 - smoothstep(0.3, 0.46, band);
}

vec3 dinoSkinColor(vec3 rawPos, vec3 n) {
  vec3 p = rawPos + uOffset;
  // A big pale belly that climbs well up the flanks and turns over crisply,
  // the way a drawn one is a shape rather than a gradient.
  float under = smoothstep(-0.35, 0.3, n.y);
  vec3 color = mix(uBelly, uBase, under);

  float mask = 0.0;
  if (uMode > 1.5) mask = dinoStripes(p);
  else if (uMode > 0.5) mask = dinoSpots(p);

  // Fade the pattern over the pale belly so the underside stays readable.
  mask *= mix(0.22, 1.0, under);
  return mix(color, uPattern, mask * 0.9);
}
`

export interface DinoSkinOptions {
  base: string
  belly: string
  pattern: string
  skin: SkinType
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
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0,
    envMapIntensity: 0.55,
  }) as DinoSkinMaterial

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDinoPos;\nvarying vec3 vDinoNormal;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tvDinoNormal = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvDinoPos = transformed;')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PATTERN_GLSL}`)
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb *= dinoSkinColor(vDinoPos, normalize(vDinoNormal));',
      )
  }

  material.setPatternOffset = (offset) => {
    uniforms.uOffset.value.set(offset.x, offset.y, offset.z)
  }

  material.applySkin = (next) => {
    uniforms.uBase.value.set(next.base)
    uniforms.uBelly.value.set(next.belly)
    uniforms.uPattern.value.set(next.pattern)
    uniforms.uMode.value = MODE[next.skin]
  }

  return material
}
