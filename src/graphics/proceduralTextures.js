import * as THREE from "three";

function finalizeCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Stabilize translucent textures to avoid mip-level alpha artifacts (square blocks/flicker).
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.premultiplyAlpha = true;
  tex.needsUpdate = true;
  return tex;
}

export function makeSoftGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.94)");
  g.addColorStop(0.5, "rgba(255,255,255,0.34)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  return finalizeCanvasTexture(c);
}

export function makeBeamTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext("2d");

  const center = c.width * 0.5;
  const radial = ctx.createRadialGradient(center, c.height * 0.08, 3, center, c.height * 0.5, c.width * 0.55);
  radial.addColorStop(0, "rgba(255,250,235,0.9)");
  radial.addColorStop(0.25, "rgba(255,232,196,0.44)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, c.width, c.height);

  const falloff = ctx.createLinearGradient(0, 0, 0, c.height);
  falloff.addColorStop(0, "rgba(255,255,255,0.86)");
  falloff.addColorStop(0.35, "rgba(255,255,255,0.28)");
  falloff.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, c.width, c.height);

  return finalizeCanvasTexture(c);
}

export function makeStarTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");

  const center = 256;
  const radial = ctx.createRadialGradient(center, center, 0, center, center, center);
  radial.addColorStop(0, "rgba(255,255,255,1)");
  radial.addColorStop(0.12, "rgba(255,250,236,0.95)");
  radial.addColorStop(0.44, "rgba(255,214,180,0.36)");
  radial.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, c.width, c.height);

  const outer = ctx.createRadialGradient(center, center, center * 0.4, center, center, center * 0.96);
  outer.addColorStop(0, "rgba(255,244,220,0.14)");
  outer.addColorStop(0.74, "rgba(178,215,255,0.08)");
  outer.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, c.width, c.height);

  return finalizeCanvasTexture(c);
}

export function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
  g.addColorStop(0, "rgba(255,255,255,0.6)");
  g.addColorStop(0.48, "rgba(192,212,255,0.26)");
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 7; i++) {
    const x = 120 + Math.random() * 272;
    const y = 130 + Math.random() * 240;
    const r = 80 + Math.random() * 110;
    const puff = ctx.createRadialGradient(x, y, r * 0.18, x, y, r);
    puff.addColorStop(0, "rgba(255,255,255,0.2)");
    puff.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = puff;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  return finalizeCanvasTexture(c);
}

export function makeVolumeFogTexture() {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 384;
  const ctx = c.getContext("2d");

  const core = ctx.createRadialGradient(192, 208, 20, 192, 194, 188);
  core.addColorStop(0, "rgba(255,255,255,0.82)");
  core.addColorStop(0.46, "rgba(255,255,255,0.28)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 26 + Math.random() * 70;
    const alpha = 0.016 + Math.random() * 0.04;
    const puff = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    puff.addColorStop(0, `rgba(255,255,255,${alpha})`);
    puff.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = puff;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const edgeFade = ctx.createRadialGradient(192, 192, 122, 192, 192, 198);
  edgeFade.addColorStop(0, "rgba(255,255,255,1)");
  edgeFade.addColorStop(0.76, "rgba(255,255,255,0.78)");
  edgeFade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = edgeFade;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-over";

  return finalizeCanvasTexture(c);
}

export function makeHazeTexture() {
  const c = document.createElement("canvas");
  c.width = 1536;
  c.height = 384;
  const ctx = c.getContext("2d");

  const gradient = ctx.createRadialGradient(768, 272, 40, 768, 248, 620);
  gradient.addColorStop(0, "rgba(255,235,214,0.9)");
  gradient.addColorStop(0.34, "rgba(255,188,152,0.52)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, c.width, c.height);

  const coolLift = ctx.createLinearGradient(0, 0, 0, c.height);
  coolLift.addColorStop(0, "rgba(176,214,255,0.2)");
  coolLift.addColorStop(1, "rgba(176,214,255,0)");
  ctx.fillStyle = coolLift;
  ctx.fillRect(0, 0, c.width, c.height);

  return finalizeCanvasTexture(c);
}
