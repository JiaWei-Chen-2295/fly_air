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
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.15, "rgba(255,255,255,0.92)");
  g.addColorStop(0.45, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  return finalizeCanvasTexture(c);
}

export function makeBeamTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext("2d");

  const center = c.width * 0.5;
  const radial = ctx.createRadialGradient(center, c.height * 0.08, 3, center, c.height * 0.5, c.width * 0.55);
  radial.addColorStop(0, "rgba(255,245,214,0.95)");
  radial.addColorStop(0.25, "rgba(255,220,160,0.52)");
  radial.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, c.width, c.height);

  const falloff = ctx.createLinearGradient(0, 0, 0, c.height);
  falloff.addColorStop(0, "rgba(255,255,255,0.9)");
  falloff.addColorStop(0.35, "rgba(255,255,255,0.32)");
  falloff.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, c.width, c.height);

  return finalizeCanvasTexture(c);
}

export function makeStarTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  const center = 128;
  const radial = ctx.createRadialGradient(center, center, 0, center, center, center);
  radial.addColorStop(0, "rgba(255,255,255,1)");
  radial.addColorStop(0.08, "rgba(255,250,220,0.95)");
  radial.addColorStop(0.35, "rgba(255,170,90,0.5)");
  radial.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.strokeStyle = "rgba(255, 222, 165, 0.8)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(center, 32);
  ctx.lineTo(center, 224);
  ctx.moveTo(32, center);
  ctx.lineTo(224, center);
  ctx.stroke();

  return finalizeCanvasTexture(c);
}

export function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,0.65)");
  g.addColorStop(0.42, "rgba(170,190,255,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  return finalizeCanvasTexture(c);
}

export function makeVolumeFogTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  const core = ctx.createRadialGradient(128, 140, 12, 128, 136, 126);
  core.addColorStop(0, "rgba(255,255,255,0.88)");
  core.addColorStop(0.42, "rgba(255,255,255,0.32)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 24; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 18 + Math.random() * 42;
    const alpha = 0.02 + Math.random() * 0.06;
    const puff = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    puff.addColorStop(0, `rgba(255,255,255,${alpha})`);
    puff.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = puff;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const edgeFade = ctx.createRadialGradient(128, 128, 80, 128, 128, 132);
  edgeFade.addColorStop(0, "rgba(255,255,255,1)");
  edgeFade.addColorStop(0.74, "rgba(255,255,255,0.8)");
  edgeFade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = edgeFade;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-over";

  return finalizeCanvasTexture(c);
}

export function makeHazeTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");

  const gradient = ctx.createRadialGradient(512, 190, 30, 512, 180, 420);
  gradient.addColorStop(0, "rgba(255,220,160,1)");
  gradient.addColorStop(0.35, "rgba(255,115,40,0.62)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, c.width, c.height);

  return finalizeCanvasTexture(c);
}
