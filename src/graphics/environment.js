import * as THREE from "three";

export function makeAircraftEnvironment(rendererRef) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "#08103a");
  g.addColorStop(0.36, "#33207a");
  g.addColorStop(0.56, "#652259");
  g.addColorStop(0.74, "#8a2a28");
  g.addColorStop(1, "#14060a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  const horizon = ctx.createLinearGradient(0, 0, 0, c.height);
  horizon.addColorStop(0.45, "rgba(0,0,0,0)");
  horizon.addColorStop(0.61, "rgba(255, 140, 72, 0.45)");
  horizon.addColorStop(0.72, "rgba(0,0,0,0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, c.width, c.height);

  const equirect = new THREE.CanvasTexture(c);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;
  equirect.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(rendererRef);
  const envRT = pmrem.fromEquirectangular(equirect);
  equirect.dispose();
  pmrem.dispose();
  return envRT.texture;
}
