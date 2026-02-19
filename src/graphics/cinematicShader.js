import * as THREE from "three";

export function createCinematicShader() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uShock: { value: 0 },
      uFlyby: { value: 0 },
      uSpeed: { value: 0 },
      uGrain: { value: 0.006 },
      uVignette: { value: 0.84 },
      uChromatic: { value: 0.0018 },
      uMotionBlur: { value: 0.62 },
      uFogDensity: { value: 0.42 },
      uFogLift: { value: 0.52 },
      uHaloUv: { value: new THREE.Vector2(0.5, 0.58) },
      uHaloSize: { value: 0.14 },
      uHaloStrength: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uShock;
      uniform float uFlyby;
      uniform float uSpeed;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uChromatic;
      uniform float uMotionBlur;
      uniform float uFogDensity;
      uniform float uFogLift;
      uniform vec2 uHaloUv;
      uniform float uHaloSize;
      uniform float uHaloStrength;
      uniform vec2 uResolution;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        vec2 dir = normalize(centered + 1e-6);
        float radial = dot(centered, centered);
        float speedMix = clamp(uSpeed * 0.75 + uShock * 1.05, 0.0, 1.0);
        float warpPower = radial * (0.018 * uShock + 0.006 * speedMix);
        vec2 warpedUv = clamp(vUv + centered * warpPower, 0.0, 1.0);
        float ca = uChromatic * (1.0 + uShock * 1.7);
        float blurAmount = (0.001 + speedMix * 0.0036) * uMotionBlur;
        vec2 motionDir = normalize(vec2(centered.x * 0.55, -1.0));

        vec3 color = vec3(0.0);
        float weightTotal = 0.0;
        for (int i = 0; i < 5; i++) {
          float t = (float(i) - 2.0) * 0.5;
          float w = 1.0 - abs(t) * 0.28;
          vec2 sampleUv = clamp(warpedUv + motionDir * blurAmount * t, 0.0, 1.0);

          vec3 tap;
          tap.r = texture2D(tDiffuse, clamp(sampleUv + dir * ca, 0.0, 1.0)).r;
          tap.g = texture2D(tDiffuse, sampleUv).g;
          tap.b = texture2D(tDiffuse, clamp(sampleUv - dir * ca, 0.0, 1.0)).b;

          color += tap * w;
          weightTotal += w;
        }
        color /= max(weightTotal, 1e-5);

        float horizonFog = smoothstep(0.94, 0.08, vUv.y);
        float verticalFog = pow(clamp(1.0 - vUv.y + uFogLift * 0.15, 0.0, 1.0), 1.4);
        float fogAmount = clamp((horizonFog * 0.48 + verticalFog * 0.26) * uFogDensity, 0.0, 0.62);
        vec3 fogCool = vec3(0.08, 0.11, 0.26);
        vec3 fogWarm = vec3(0.98, 0.37, 0.12);
        vec3 fogColor = mix(fogCool, fogWarm, smoothstep(0.35, 0.86, 1.0 - vUv.y));
        color = mix(color, fogColor, fogAmount);

        vec2 haloDelta = vUv - uHaloUv;
        haloDelta.x *= uResolution.x / max(uResolution.y, 1.0);
        float haloRadius = max(uHaloSize, 0.0001);
        float haloCore = exp(-dot(haloDelta, haloDelta) / (haloRadius * haloRadius));
        float haloRing = exp(-dot(haloDelta, haloDelta) / ((haloRadius * 1.8) * (haloRadius * 1.8)));
        float haloAxis = smoothstep(0.45, 0.0, abs(haloDelta.y)) * smoothstep(0.66, 0.0, abs(haloDelta.x));
        vec3 haloColor = vec3(1.0, 0.72, 0.44) * (0.7 + uFlyby * 0.4) + vec3(0.22, 0.32, 0.66) * 0.22;
        color += haloColor * (haloCore * 0.26 + haloRing * 0.18 + haloAxis * 0.12) * uHaloStrength;

        float vignette = smoothstep(1.08, uVignette, length(centered * 1.38));
        color *= vignette;
        color += vec3(0.03, 0.012, -0.015) * uShock;

        float noise = hash12(vUv * uResolution + uTime * 60.0);
        color += (noise - 0.5) * uGrain * (0.7 + uShock * 0.5);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
}
