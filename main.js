import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ASSETS } from "./src/config/assets.js";
import { createCinematicShader } from "./src/graphics/cinematicShader.js";
import { makeAircraftEnvironment } from "./src/graphics/environment.js";
import {
  addAtmosphereVolumes,
  addCloudDeck,
  addRunwayLights,
  addSkyDome,
  addWorld,
} from "./src/scene/world.js";
import {
  makeBeamTexture,
  makeCloudTexture,
  makeHazeTexture,
  makeSoftGlowTexture,
  makeStarTexture,
  makeVolumeFogTexture,
} from "./src/graphics/proceduralTextures.js";
import { isMobileViewport } from "./src/utils/device.js";
import { gaussianPulse, pulseWindow, smooth } from "./src/utils/motion.js";

const canvas = document.querySelector("#scene");
const initialMobileMode = isMobileViewport();
const isTouchLikeDevice =
  initialMobileMode ||
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
const devicePixelRatio = window.devicePixelRatio || 1;
const mobilePixelRatioCap = 1.55;
const desktopPixelRatioCap = 2;
const pixelRatioCap = isTouchLikeDevice ? mobilePixelRatioCap : desktopPixelRatioCap;
const textureLoader = new THREE.TextureLoader();
const navGlowTexture = makeSoftGlowTexture();
const landingBeamTexture = makeBeamTexture();
const starTexture = makeStarTexture();
const cloudTexture = makeCloudTexture();
const volumeFogTexture = makeVolumeFogTexture();
const hazeTexture = makeHazeTexture();
const aircraftPbrPromise = loadAircraftPbrSet();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(0x040916, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatioCap));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = !initialMobileMode;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070f1d, 0.0106);
scene.environment = makeAircraftEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(34, 1, 0.22, 600);
camera.position.set(0, 1.8, 8.6);

const DISABLE_COMPOSER_MSAA = true;
const composer = new EffectComposer(renderer);
if (renderer.capabilities.isWebGL2 && !isTouchLikeDevice && !DISABLE_COMPOSER_MSAA) {
  composer.renderTarget1.samples = 4;
  composer.renderTarget2.samples = 4;
}
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.86, 0.68, 0.16);
composer.addPass(bloomPass);
const cinematicPass = new ShaderPass(createCinematicShader());
composer.addPass(cinematicPass);
const bokehPass = new BokehPass(scene, camera, {
  focus: 24,
  aperture: 0.00002,
  maxblur: 0.0014,
});
bokehPass.enabled = false;
composer.addPass(bokehPass);
const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

addSkyDome(scene);
const { keyLight, ground } = addWorld(scene, renderer, hazeTexture);
const runwayLights = addRunwayLights(scene, starTexture);
const cloudParticles = addCloudDeck(scene, cloudTexture);
const atmosphereVolumes = addAtmosphereVolumes(scene, volumeFogTexture);

let aircraftEffects = null;
const aircraftRig = new THREE.Group();
scene.add(aircraftRig);
const aircraftReadyPromise = loadAircraft(aircraftRig);

const smoothState = {
  aircraftPos: new THREE.Vector3(0, 0.8, -150),
  aircraftRot: new THREE.Vector3(-0.02, 0, 0),
  cameraPos: new THREE.Vector3(0, 1.8, 8.6),
  cameraLook: new THREE.Vector3(0, 3, -72),
  fov: camera.fov,
  exposure: renderer.toneMappingExposure,
  bloomStrength: bloomPass.strength,
  bloomRadius: bloomPass.radius,
  bloomThreshold: bloomPass.threshold,
  dofFocus: 24,
  dofAperture: 0.00002,
  dofBlur: 0.0014,
  speed: 0,
  fogDensity: scene.fog.density,
  groundVisibility: 1,
};

// Gradual restore plan:
// 0: fully stable mode
// 1: + landing beams
// 2: + blend meshes
// 3: + pulse sprites
// 4: + cinematic pass
// 5: + bokeh
// Bloom is isolated behind a separate flag because it can still trigger black blocks on some GPUs.
const EFFECT_RESTORE_STAGE = 1;
const ENABLE_EXPERIMENTAL_BLOOM = false;

function makeStabilityGuards(stage) {
  const guards = {
    disableBokeh: true,
    disableCinematicPass: true,
    disableBloom: true,
    disablePulseSprites: true,
    hideModelBlendMeshes: true,
    disableLandingBeams: true,
  };

  if (ENABLE_EXPERIMENTAL_BLOOM) guards.disableBloom = false;
  if (stage >= 1) guards.disableLandingBeams = false;
  if (stage >= 2) guards.hideModelBlendMeshes = false;
  if (stage >= 3) guards.disablePulseSprites = false;
  if (stage >= 4) guards.disableCinematicPass = false;
  if (stage >= 5) guards.disableBokeh = false;
  return guards;
}

const STABILITY_GUARDS = Object.freeze(makeStabilityGuards(EFFECT_RESTORE_STAGE));
cinematicPass.enabled = !STABILITY_GUARDS.disableCinematicPass;
bloomPass.enabled = !STABILITY_GUARDS.disableBloom;

const qualityState = {
  frameTime: 0,
  frameCount: 0,
  targetPixelRatio: Math.min(devicePixelRatio, isTouchLikeDevice ? 1.45 : 1.85),
  minPixelRatio: isTouchLikeDevice ? 0.92 : 0.82,
  maxPixelRatio: Math.min(devicePixelRatio, isTouchLikeDevice ? mobilePixelRatioCap : desktopPixelRatioCap),
  postTier: initialMobileMode ? 1 : 2,
  appliedPostTier: -1,
  dofScale: initialMobileMode ? 0 : 1,
  motionBlurScale: 1,
  bloomCeiling: 2.05,
  dynamicQualityEnabled: false,
  allowBokeh: !initialMobileMode && !STABILITY_GUARDS.disableBokeh,
  allowAircraftShadow: !initialMobileMode,
};

const flybyStabilityState = {
  bokehSuppressed: false,
  cameraSafetyOffset: new THREE.Vector3(),
  haloUv: new THREE.Vector2(0.5, 0.58),
  haloStrength: 0,
};

const scratch = {
  v0: new THREE.Vector3(),
  v1: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  v3: new THREE.Vector3(),
  v4: new THREE.Vector3(),
  v5: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
};

const clock = new THREE.Clock();
let restartOffset = 0;
let warmupFrames = 0;
const WARMUP_THRESHOLD = 3;
const loadingOverlay = document.querySelector("#loading-overlay");

window.addEventListener("pointerdown", () => {
  restartOffset = clock.elapsedTime;
});

window.addEventListener("resize", updateViewport);
updateViewport();
waitForSceneReady();

async function waitForSceneReady() {
  await aircraftReadyPromise;
  // Reset timeline after resources are ready, so playback starts from frame zero.
  clock.start();
  restartOffset = 0;
  warmupFrames = 0;
  requestAnimationFrame(animate);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const cycleDuration = 9.4;
  const t = ((elapsed - restartOffset) % cycleDuration) / cycleDuration;

  // Warmup: first few frames render without post-processing to avoid flash/black blocks
  warmupFrames++;
  if (warmupFrames <= WARMUP_THRESHOLD) {
    // Render a bare scene frame to prime GPU pipelines and fill buffers
    renderer.render(scene, camera);
    if (warmupFrames === WARMUP_THRESHOLD) {
      // After warmup, enable passes that depend on valid depth/color buffers
      applyQualityTier(true);
      // Fade out loading overlay
      if (loadingOverlay) {
        loadingOverlay.classList.add("fade-out");
        loadingOverlay.addEventListener("transitionend", () => loadingOverlay.remove(), { once: true });
      }
    }
    requestAnimationFrame(animate);
    return;
  }

  const rush = smooth(0.02, 0.62, t);
  const liftoff = smooth(0.32, 0.58, t);
  const overfly = smooth(0.5, 0.72, t);
  const climb = smooth(0.62, 1.0, t);
  const nearPass = pulseWindow(t, 0.48, 0.66);
  const passShock = pulseWindow(t, 0.5, 0.61);
  const flybySafety = smooth(0.42, 0.66, t);
  const flybyWindow = pulseWindow(t, 0.41, 0.74);
  const dampedShock = passShock * (1 - flybySafety * 0.78);

  const y = 0.78 + liftoff * 4.9 + overfly * 6.8 + climb * 9.1;
  const z = -156 + rush * 186 + overfly * 34 + nearPass * 13;
  const x = Math.sin(elapsed * 0.68) * (0.16 + overfly * 0.34);

  const aircraftTargetRotX = -0.03 + liftoff * 0.14 + overfly * 0.24 + climb * 0.08;
  const aircraftTargetRotY = Math.sin(elapsed * 0.24) * 0.01;
  const aircraftTargetRotZ = Math.sin(elapsed * 1.05) * 0.01 * (0.25 + overfly * 0.75);
  const speedTarget = THREE.MathUtils.clamp(Math.abs((z - smoothState.aircraftPos.z) / Math.max(delta, 0.0001)) / 95, 0, 1.35);

  const shakeAmount = dampedShock * 0.05;
  const shakeX = Math.sin(elapsed * 58) * shakeAmount;
  const shakeY = Math.cos(elapsed * 63) * shakeAmount * 0.75;
  const shakeZ = Math.sin(elapsed * 54) * shakeAmount * 0.6;

  const flybyDrift = Math.sin(elapsed * 0.42 + 0.9) * flybyWindow * 0.28;
  const targetCameraX = x * 0.2 + flybyDrift + shakeX;
  const targetCameraY = 1.7 + liftoff * 0.64 + overfly * 2.35 + nearPass * 0.54 - flybyWindow * 0.1 + shakeY;
  const targetCameraZ = 8.7 - overfly * 2.9 - nearPass * 0.85 - flybyWindow * 0.32 + shakeZ;
  const targetLookX = x * 0.2;
  const targetLookY = 1.64 + liftoff * 2.9 + overfly * 8.6 + nearPass * 0.9;
  const targetLookZ = -66 + rush * 130 + nearPass * 13;
  const upLookFactor = THREE.MathUtils.clamp((targetLookY - targetCameraY - 0.35) / 4.2, 0, 1);
  const timelineGround = 1 - smooth(0.34, 0.62, t);
  const groundTargetVisibility = THREE.MathUtils.clamp(timelineGround * (1 - upLookFactor * 0.9), 0, 1);

  const mobileBaseFov = isTouchLikeDevice ? (camera.aspect < 0.72 ? 48 : 42) : camera.aspect < 0.78 ? 43 : 37;
  const targetFov = mobileBaseFov + nearPass * 2.8 + dampedShock * 6.3;

  const targetExposure = THREE.MathUtils.clamp(1.1 + nearPass * 0.06 + dampedShock * 0.14, 1.04, 1.28);
  const targetBloomStrength = 0.66 + nearPass * 0.08 + dampedShock * 0.22;
  const targetBloomRadius = 0.54 + nearPass * 0.07 + dampedShock * 0.1;
  const targetBloomThreshold = 0.22 - nearPass * 0.016 - dampedShock * 0.024;

  smoothState.aircraftPos.set(
    THREE.MathUtils.damp(smoothState.aircraftPos.x, x, 10, delta),
    THREE.MathUtils.damp(smoothState.aircraftPos.y, y, 10, delta),
    THREE.MathUtils.damp(smoothState.aircraftPos.z, z, 10, delta)
  );
  smoothState.aircraftRot.set(
    THREE.MathUtils.damp(smoothState.aircraftRot.x, aircraftTargetRotX, 10, delta),
    THREE.MathUtils.damp(smoothState.aircraftRot.y, aircraftTargetRotY, 9, delta),
    THREE.MathUtils.damp(smoothState.aircraftRot.z, aircraftTargetRotZ, 9, delta)
  );
  aircraftRig.position.copy(smoothState.aircraftPos);
  aircraftRig.rotation.set(smoothState.aircraftRot.x, smoothState.aircraftRot.y, smoothState.aircraftRot.z);

  if (keyLight.castShadow) {
    keyLight.position.set(smoothState.aircraftPos.x, smoothState.aircraftPos.y + 10, smoothState.aircraftPos.z - 34);
    keyLight.target.position.copy(smoothState.aircraftPos);
  }

  const desiredCameraPos = scratch.v0.set(
    THREE.MathUtils.damp(smoothState.cameraPos.x, targetCameraX, 11, delta),
    THREE.MathUtils.damp(smoothState.cameraPos.y, targetCameraY, 11, delta),
    THREE.MathUtils.damp(smoothState.cameraPos.z, targetCameraZ, 11, delta)
  );
  const desiredCameraLook = scratch.v1.set(
    THREE.MathUtils.damp(smoothState.cameraLook.x, targetLookX, 12, delta),
    THREE.MathUtils.damp(smoothState.cameraLook.y, targetLookY, 12, delta),
    THREE.MathUtils.damp(smoothState.cameraLook.z, targetLookZ, 12, delta)
  );
  const safetyResult = applyFlybyCameraSafety(desiredCameraPos, desiredCameraLook, flybyWindow, delta);
  smoothState.cameraPos.copy(safetyResult.safeCameraPos);
  smoothState.cameraLook.copy(safetyResult.safeLook);
  camera.position.copy(smoothState.cameraPos);
  camera.lookAt(smoothState.cameraLook);

  smoothState.speed = THREE.MathUtils.damp(smoothState.speed, speedTarget, 10, delta);
  smoothState.fov = THREE.MathUtils.damp(smoothState.fov, targetFov, 12, delta);
  camera.fov = smoothState.fov;
  camera.updateProjectionMatrix();

  smoothState.exposure = THREE.MathUtils.damp(smoothState.exposure, targetExposure, 8, delta);
  smoothState.bloomStrength = THREE.MathUtils.damp(smoothState.bloomStrength, targetBloomStrength, 8, delta);
  smoothState.bloomRadius = THREE.MathUtils.damp(smoothState.bloomRadius, targetBloomRadius, 8, delta);
  smoothState.bloomThreshold = THREE.MathUtils.damp(smoothState.bloomThreshold, targetBloomThreshold, 8, delta);
  renderer.toneMappingExposure = smoothState.exposure;
  if (bloomPass.enabled) {
    bloomPass.strength = Math.min(smoothState.bloomStrength, qualityState.bloomCeiling);
    bloomPass.radius = smoothState.bloomRadius;
    bloomPass.threshold = smoothState.bloomThreshold;
  }
  const targetFogDensity = 0.0084 + flybyWindow * 0.0036 + dampedShock * 0.0014;
  smoothState.fogDensity = THREE.MathUtils.damp(smoothState.fogDensity, targetFogDensity, 5.8, delta);
  scene.fog.density = smoothState.fogDensity;

  smoothState.groundVisibility = THREE.MathUtils.damp(smoothState.groundVisibility, groundTargetVisibility, 7, delta);
  if (ground) {
    const runwayOpacity = THREE.MathUtils.clamp(smoothState.groundVisibility, 0, 1);
    const tarmacOpacity = THREE.MathUtils.clamp(smoothState.groundVisibility * 0.85, 0, 1);
    ground.runwayMaterial.opacity = runwayOpacity;
    ground.tarmacMaterial.opacity = tarmacOpacity;
    ground.runway.visible = runwayOpacity > 0.015;
    ground.tarmac.visible = tarmacOpacity > 0.015;
    ground.runwayGlow.intensity = 52 * (0.35 + runwayOpacity * 0.65);
  }

  const passDistance = camera.position.distanceTo(aircraftRig.position);
  const targetDofFocus = THREE.MathUtils.clamp(passDistance * (0.62 + nearPass * 0.05), 8, 70);
  const dofNearFade = 1 - smooth(0.28, 0.9, nearPass);
  const dofScale = qualityState.dofScale * dofNearFade;
  const targetDofAperture = (0.000016 + nearPass * 0.000028 + dampedShock * 0.000012) * dofScale;
  const targetDofBlur = (0.0009 + nearPass * 0.00085 + dampedShock * 0.0007) * dofScale;
  smoothState.dofFocus = THREE.MathUtils.damp(smoothState.dofFocus, targetDofFocus, 9, delta);
  smoothState.dofAperture = THREE.MathUtils.damp(smoothState.dofAperture, targetDofAperture, 9, delta);
  smoothState.dofBlur = THREE.MathUtils.damp(smoothState.dofBlur, targetDofBlur, 9, delta);
  if (flybyStabilityState.bokehSuppressed) {
    if (nearPass < 0.12) flybyStabilityState.bokehSuppressed = false;
  } else if (nearPass > 0.23) {
    flybyStabilityState.bokehSuppressed = true;
  }
  bokehPass.enabled = qualityState.allowBokeh && qualityState.dofScale > 0.001 && !flybyStabilityState.bokehSuppressed;
  bokehPass.uniforms.focus.value = smoothState.dofFocus;
  bokehPass.uniforms.aperture.value = smoothState.dofAperture;
  bokehPass.uniforms.maxblur.value = smoothState.dofBlur;

  if (cinematicPass.enabled) {
    cinematicPass.uniforms.uTime.value = elapsed;
    cinematicPass.uniforms.uShock.value = dampedShock;
    cinematicPass.uniforms.uSpeed.value = smoothState.speed;
    cinematicPass.uniforms.uFlyby.value = flybyWindow;
    cinematicPass.uniforms.uFogDensity.value = 0.24 + flybyWindow * 0.42 + dampedShock * 0.1;
    cinematicPass.uniforms.uFogLift.value = 0.5 + flybyWindow * 0.32;
    const targetMotionBlur = (0.56 + nearPass * 0.18 + dampedShock * 0.16) * qualityState.motionBlurScale;
    cinematicPass.uniforms.uMotionBlur.value = THREE.MathUtils.damp(cinematicPass.uniforms.uMotionBlur.value, targetMotionBlur, 7, delta);
    const halo = computeFlybyHalo(flybyWindow, dampedShock, delta);
    cinematicPass.uniforms.uHaloUv.value.copy(halo.uv);
    cinematicPass.uniforms.uHaloSize.value = halo.size;
    cinematicPass.uniforms.uHaloStrength.value = halo.strength;
  }

  for (const sprite of runwayLights) {
    const pulse = 0.72 + Math.sin(elapsed * 8.2 + sprite.userData.phase) * 0.22;
    const deep = 1 - sprite.userData.depth;
    const size = sprite.userData.baseScale * (1 + pulse * deep * 0.2);
    sprite.scale.set(size, size, 1);
    sprite.material.opacity = 0.52 + pulse * 0.26;
  }

  for (const cloud of cloudParticles) {
    cloud.material.opacity = 0.1 + Math.sin(elapsed * 0.25 + cloud.userData.phase) * 0.024;
    cloud.position.x += cloud.userData.drift * delta * 60;
    if (Math.abs(cloud.position.x) > 65) {
      cloud.position.x *= -1;
    }
  }

  for (const volume of atmosphereVolumes) {
    const breathing = 0.9 + Math.sin(elapsed * 0.32 + volume.userData.phase) * 0.22;
    const drift = Math.sin(elapsed * 0.19 + volume.userData.phase * 1.7) * 0.035;
    volume.position.x = volume.userData.baseX + drift;
    volume.position.y = volume.userData.baseY + flybyWindow * volume.userData.lift * 0.36;
    volume.material.opacity =
      volume.userData.baseOpacity *
      breathing *
      (0.8 + flybyWindow * volume.userData.flybyBoost + dampedShock * 0.38);
  }

  updateAircraftEffects(elapsed, t, dampedShock, delta);
  updateAdaptiveQuality(delta);

  composer.render();
  requestAnimationFrame(animate);
}

function applyFlybyCameraSafety(desiredCameraPos, desiredCameraLook, flybyWindow, delta) {
  const safeCameraPos = scratch.v2.copy(desiredCameraPos);
  const safeLook = scratch.v3.copy(desiredCameraLook);

  const viewDir = scratch.v4.copy(safeLook).sub(safeCameraPos);
  if (viewDir.lengthSq() < 0.000001) {
    viewDir.set(0, 0, -1);
  } else {
    viewDir.normalize();
  }

  const bellyPoint = scratch.v5
    .set(0, -1.05, 2.2)
    .applyQuaternion(aircraftRig.quaternion)
    .add(aircraftRig.position);

  const toBelly = scratch.v0.copy(bellyPoint).sub(safeCameraPos);
  const forwardDist = toBelly.dot(viewDir);
  const minForwardDist = THREE.MathUtils.lerp(camera.near + 1.1, camera.near + 2.35, flybyWindow);
  const pushBack = Math.max(0, minForwardDist - forwardDist);

  const right = scratch.v1.crossVectors(viewDir, scratch.up);
  if (right.lengthSq() < 0.000001) {
    right.set(1, 0, 0);
  } else {
    right.normalize();
  }

  const lateralDist = toBelly.dot(right);
  const lateralSafe = THREE.MathUtils.lerp(0.42, 0.95, flybyWindow);
  const lateralGap = Math.max(0, lateralSafe - Math.abs(lateralDist));
  const lateralPush = lateralGap * -Math.sign(lateralDist || 1) * 0.66;
  const verticalPush = pushBack * 0.18 + flybyWindow * 0.06;

  const targetOffset = scratch.v0.copy(viewDir).multiplyScalar(-pushBack).addScaledVector(right, lateralPush);
  targetOffset.y -= verticalPush;

  flybyStabilityState.cameraSafetyOffset.set(
    THREE.MathUtils.damp(flybyStabilityState.cameraSafetyOffset.x, targetOffset.x, 14, delta),
    THREE.MathUtils.damp(flybyStabilityState.cameraSafetyOffset.y, targetOffset.y, 14, delta),
    THREE.MathUtils.damp(flybyStabilityState.cameraSafetyOffset.z, targetOffset.z, 14, delta)
  );

  safeCameraPos.add(flybyStabilityState.cameraSafetyOffset);
  safeLook.addScaledVector(right, lateralPush * 0.2);
  safeLook.y += flybyWindow * 0.08;

  return { safeCameraPos, safeLook };
}

function computeFlybyHalo(flybyWindow, shock, delta) {
  const haloProbe = scratch.v4
    .set(0, -1.06, 2.1)
    .applyQuaternion(aircraftRig.quaternion)
    .add(aircraftRig.position);
  haloProbe.project(camera);

  const targetUvX = THREE.MathUtils.clamp(haloProbe.x * 0.5 + 0.5, 0.04, 0.96);
  const targetUvY = THREE.MathUtils.clamp(-haloProbe.y * 0.5 + 0.5, 0.06, 0.96);
  flybyStabilityState.haloUv.set(
    THREE.MathUtils.damp(flybyStabilityState.haloUv.x, targetUvX, 10, delta),
    THREE.MathUtils.damp(flybyStabilityState.haloUv.y, targetUvY, 10, delta)
  );

  const cameraDistance = camera.position.distanceTo(aircraftRig.position);
  const proximity = THREE.MathUtils.clamp(1 - (cameraDistance - 7) / 26, 0, 1);
  const strengthTarget = flybyWindow * proximity * (0.64 + shock * 0.48);
  flybyStabilityState.haloStrength = THREE.MathUtils.damp(flybyStabilityState.haloStrength, strengthTarget, 8, delta);

  const size = THREE.MathUtils.lerp(0.09, 0.19, proximity) * (0.94 + flybyWindow * 0.26);
  return { uv: flybyStabilityState.haloUv, size, strength: flybyStabilityState.haloStrength };
}

function loadAircraft(rig) {
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    loader.load(
      ASSETS.aircraftModel,
      async (gltf) => {
        try {
          const craft = gltf.scene;
          const pbrSet = await aircraftPbrPromise.catch(() => null);
          normalizeLoadedAircraft(craft, 18);
          applyAircraftLook(craft, pbrSet);
          rig.add(craft);
          aircraftEffects = attachAircraftEffects(craft);
        } catch {
          const fallback = makeHeroJet();
          rig.add(fallback);
          aircraftEffects = attachAircraftEffects(fallback);
        }

        if (typeof renderer.compileAsync === "function") {
          await renderer.compileAsync(scene, camera).catch(() => {});
        }
        resolve();
      },
      undefined,
      async () => {
        const fallback = makeHeroJet();
        rig.add(fallback);
        aircraftEffects = attachAircraftEffects(fallback);
        if (typeof renderer.compileAsync === "function") {
          await renderer.compileAsync(scene, camera).catch(() => {});
        }
        resolve();
      }
    );
  });
}

function normalizeLoadedAircraft(model, targetWingSpan) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, 0.001);
  const scale = targetWingSpan / span;
  model.scale.setScalar(scale);

  const centered = new THREE.Box3().setFromObject(model);
  const center = centered.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const grounded = new THREE.Box3().setFromObject(model);
  model.position.y -= grounded.min.y + 1.2;
  model.position.z -= 8;
  model.rotation.y = 0;
}

function applyAircraftLook(root, pbrSet) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;

    node.castShadow = qualityState.allowAircraftShadow;
    node.receiveShadow = false;

    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    if (STABILITY_GUARDS.hideModelBlendMeshes) {
      const nodeLabel = `${node.name || ""}`.toLowerCase();
      const keepTransparentGlass = /glass|window|cockpit|windscreen/.test(nodeLabel);
      const hasBlendMaterial = sourceMaterials.some((source) =>
        isLikelyTransparentSource(source, `${nodeLabel} ${(source?.name || "")}`.toLowerCase())
      );
      if (hasBlendMaterial && !keepTransparentGlass) {
        node.visible = false;
        return;
      }
    }
    const rebuilt = sourceMaterials.map((source) => rebuildAircraftMaterial(source, node.name, pbrSet));
    node.material = Array.isArray(node.material) ? rebuilt : rebuilt[0];
  });
}

function isLikelyTransparentSource(source, label) {
  const hasSourceAlpha = typeof source?.opacity === "number" && source.opacity < 0.999;
  const hasAlphaCut = typeof source?.alphaTest === "number" && source.alphaTest > 0;
  const blendHint = /fan|windscreen|fr24|material\.008|24-default/.test(label);
  return Boolean(source?.transparent) || hasSourceAlpha || hasAlphaCut || blendHint;
}

function rebuildAircraftMaterial(source, meshName, pbrSet) {
  const label = `${meshName || ""} ${(source?.name || "")}`.toLowerCase();
  const isTransparentSource = isLikelyTransparentSource(source, label);
  const isGlass = /glass|window|cockpit/.test(label);
  const isWheel = /wheel|tire|tyre|rubber/.test(label);
  const isEngine = /engine|nacelle|fan|intake|turbine/.test(label);
  const isGear = /gear|strut|leg/.test(label);

  if (isTransparentSource) {
    // Keep GLTF transparent materials close to source to avoid black-card artifacts on blend meshes.
    const stable = source?.clone?.() || new THREE.MeshStandardMaterial();
    stable.transparent = true;
    stable.opacity = typeof source?.opacity === "number" ? source.opacity : 1;
    stable.depthWrite = false;
    stable.depthTest = true;
    stable.premultipliedAlpha = true;
    stable.alphaTest = Math.max(typeof source?.alphaTest === "number" ? source.alphaTest : 0, 0.02);
    stable.side = typeof source?.side === "number" ? source.side : THREE.DoubleSide;
    if (stable.map) {
      stable.map.colorSpace = THREE.SRGBColorSpace;
      stable.map.generateMipmaps = false;
      stable.map.minFilter = THREE.LinearFilter;
      stable.map.magFilter = THREE.LinearFilter;
      stable.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    return stable;
  }

  if (isGlass) {
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x7b8fa5,
      transparent: true,
      opacity: 0.25,
      roughness: 0.14,
      metalness: 0.06,
      transmission: 0.5,
      thickness: 0.2,
      envMapIntensity: 1.2,
    });
    glass.side = source.side;
    return glass;
  }

  if (isWheel) {
    return new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.93, metalness: 0.08 });
  }

  if (isGear) {
    return new THREE.MeshStandardMaterial({ color: 0x282e36, roughness: 0.62, metalness: 0.56 });
  }

  const color = source?.color?.clone?.() || new THREE.Color(isEngine ? 0xbac2cc : 0xc8cfd8);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    map: source?.map || null,
    roughness: isEngine ? 0.56 : 0.72,
    metalness: isEngine ? 0.58 : 0.34,
    clearcoat: isEngine ? 0.22 : 0.16,
    clearcoatRoughness: isEngine ? 0.36 : 0.58,
    envMapIntensity: isEngine ? 1.1 : 0.95,
    transparent: source?.transparent || false,
    opacity: typeof source?.opacity === "number" ? source.opacity : 1,
    side: source?.side || THREE.FrontSide,
  });

  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  if (pbrSet) {
    if (!mat.map) {
      mat.map = pbrSet.color;
      mat.color.multiplyScalar(isEngine ? 0.86 : 0.94);
    }
    mat.normalMap = pbrSet.normal;
    mat.roughnessMap = pbrSet.roughness;
    mat.metalnessMap = pbrSet.metalness;
    mat.clearcoatNormalMap = pbrSet.normal;
    mat.normalScale.set(isEngine ? 0.22 : 0.3, isEngine ? 0.22 : 0.3);
    mat.clearcoatNormalScale = new THREE.Vector2(isEngine ? 0.08 : 0.12, isEngine ? 0.08 : 0.12);
  }

  return mat;
}

async function loadAircraftPbrSet() {
  const [color, normal, roughness, metalness] = await Promise.all([
    loadTexture(ASSETS.pbrColor, true),
    loadTexture(ASSETS.pbrNormal, false),
    loadTexture(ASSETS.pbrRoughness, false),
    loadTexture(ASSETS.pbrMetalness, false),
  ]);

  for (const tex of [color, normal, roughness, metalness]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 2);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  return { color, normal, roughness, metalness };
}

function loadTexture(url, isColor) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

function attachAircraftEffects(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const wingX = size.x * 0.48;
  const wingY = center.y - size.y * 0.015;
  const wingZ = center.z - size.z * 0.08;
  const topY = box.max.y - size.y * 0.04;
  const bottomY = box.min.y + size.y * 0.05;
  const tailZ = box.min.z + size.z * 0.07;
  const noseZ = box.max.z - size.z * 0.07;

  const nodes = {
    nav: [],
    strobe: [],
    beacon: [],
    landing: [],
  };

  const leftNav = createLightNode(0xff3f44, 0.72, 0.85, 10.5);
  leftNav.group.position.set(-wingX, wingY, wingZ);
  model.add(leftNav.group);
  nodes.nav.push(leftNav);

  const rightNav = createLightNode(0x44ff72, 0.72, 0.85, 10.5);
  rightNav.group.position.set(wingX, wingY, wingZ);
  model.add(rightNav.group);
  nodes.nav.push(rightNav);

  const strobeLeft = createLightNode(0xf6faff, 0.92, 0.0, 24);
  strobeLeft.group.position.set(-wingX, wingY + 0.02, wingZ);
  model.add(strobeLeft.group);
  nodes.strobe.push(strobeLeft);

  const strobeRight = createLightNode(0xf6faff, 0.92, 0.0, 24);
  strobeRight.group.position.set(wingX, wingY + 0.02, wingZ);
  model.add(strobeRight.group);
  nodes.strobe.push(strobeRight);

  const strobeTail = createLightNode(0xf6faff, 0.85, 0.0, 20);
  strobeTail.group.position.set(0, topY, tailZ);
  model.add(strobeTail.group);
  nodes.strobe.push(strobeTail);

  const beaconTop = createLightNode(0xff3f3f, 1.05, 0.0, 18);
  beaconTop.group.position.set(0, topY, center.z);
  model.add(beaconTop.group);
  nodes.beacon.push(beaconTop);

  const beaconBottom = createLightNode(0xff3f3f, 1.05, 0.0, 18);
  beaconBottom.group.position.set(0, bottomY, center.z + size.z * 0.08);
  model.add(beaconBottom.group);
  nodes.beacon.push(beaconBottom);

  const landingYOffset = center.y - size.y * 0.13;
  const landingXOffset = size.x * 0.075;
  const landing = createLandingLightPair(landingXOffset, landingYOffset, noseZ + 0.16, size.z * 0.6);
  model.add(landing.group);
  nodes.landing.push(...landing.nodes);

  return nodes;
}

function createLightNode(color, spriteScale, intensity, distance) {
  const group = new THREE.Group();
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: navGlowTexture,
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  sprite.scale.setScalar(spriteScale);
  group.add(sprite);

  const point = new THREE.PointLight(color, intensity, distance, 2);
  group.add(point);

  return { group, sprite, point, baseScale: spriteScale };
}

function createLandingLightPair(offsetX, y, z, targetDepth) {
  const group = new THREE.Group();
  const nodes = [];

  for (const side of [-1, 1]) {
    const light = new THREE.SpotLight(0xfff6d6, 0, 145, THREE.MathUtils.degToRad(15), 0.58, 1.7);
    light.position.set(side * offsetX, y, z);
    light.decay = 1.85;
    const target = new THREE.Object3D();
    target.position.set(side * offsetX * 0.12, y - 0.05, z + targetDepth);
    group.add(target);
    light.target = target;
    group.add(light);

    const glow = createLightNode(0xfff2cf, 1.15, 0, 20);
    glow.group.position.copy(light.position);
    group.add(glow.group);

    const beamMaterial = new THREE.MeshBasicMaterial({
      map: landingBeamTexture,
      color: 0xfff5d8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 1.18, targetDepth * 0.9, 24, 1, true), beamMaterial);
    const beamDirection = target.position.clone().sub(light.position);
    beam.position.copy(light.position).addScaledVector(beamDirection, 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDirection.clone().normalize());
    group.add(beam);

    nodes.push({ spot: light, glow, beam, beamMaterial, baseIntensity: 62 });
  }

  return { group, nodes };
}

function updateAircraftEffects(elapsed, timelineT, passShock, delta) {
  if (!aircraftEffects) return;

  const navPulse = 0.82 + Math.sin(elapsed * 1.9) * 0.08;
  for (const nav of aircraftEffects.nav) {
    nav.sprite.material.opacity = navPulse;
    nav.sprite.scale.setScalar(nav.baseScale * (0.96 + navPulse * 0.12));
    nav.point.intensity = 6.5 + navPulse * 1.4;
  }

  const strobePhase = (elapsed * 1.72) % 1;
  const strobePulse = gaussianPulse(strobePhase, 0.03, 0.014) + gaussianPulse(strobePhase, 0.12, 0.018);
  for (const strobe of aircraftEffects.strobe) {
    if (STABILITY_GUARDS.disablePulseSprites) {
      strobe.sprite.visible = false;
      strobe.point.intensity = 0;
      continue;
    }
    const power = THREE.MathUtils.clamp(strobePulse * 1.8, 0, 1);
    strobe.sprite.material.opacity = power;
    strobe.sprite.scale.setScalar(strobe.baseScale * (1 + power * 0.75));
    strobe.point.intensity = 2 + power * 32;
  }

  const beaconPhase = (elapsed * 0.92) % 1;
  const beaconPulse = gaussianPulse(beaconPhase, 0.5, 0.17);
  for (const beacon of aircraftEffects.beacon) {
    if (STABILITY_GUARDS.disablePulseSprites) {
      beacon.sprite.visible = false;
      beacon.point.intensity = 0;
      continue;
    }
    beacon.sprite.material.opacity = beaconPulse * 0.86;
    beacon.sprite.scale.setScalar(beacon.baseScale * (1 + beaconPulse * 0.48));
    beacon.point.intensity = 1.5 + beaconPulse * 16;
  }

  const landingStrength = THREE.MathUtils.clamp(smooth(0.02, 0.42, timelineT) * (1 - smooth(0.48, 0.66, timelineT)), 0, 1);
  const cameraDistance = camera.position.distanceTo(aircraftRig.position);
  const beamNearFade = THREE.MathUtils.clamp((cameraDistance - 11) / 18, 0, 1);
  for (const landing of aircraftEffects.landing) {
    if (STABILITY_GUARDS.disableLandingBeams) {
      landing.spot.intensity = 0;
      landing.glow.sprite.visible = false;
      landing.glow.point.intensity = 0;
      landing.beam.visible = false;
      landing.beamMaterial.opacity = 0;
      continue;
    }
    landing.glow.sprite.visible = true;
    landing.beam.visible = true;
    const target = landingStrength * (1 + passShock * 0.45);
    const intensity = landing.baseIntensity * target;
    landing.spot.intensity = THREE.MathUtils.damp(landing.spot.intensity, intensity, 12, delta);
    landing.spot.angle = THREE.MathUtils.degToRad(12.4 + target * 3.3);
    landing.glow.sprite.material.opacity = THREE.MathUtils.damp(landing.glow.sprite.material.opacity, target * 0.68, 12, delta);
    landing.glow.sprite.scale.setScalar(landing.glow.baseScale * (1 + target * 0.44));
    landing.glow.point.intensity = THREE.MathUtils.damp(landing.glow.point.intensity, 1 + target * 13, 12, delta);
    landing.beamMaterial.opacity = THREE.MathUtils.damp(
      landing.beamMaterial.opacity,
      target * beamNearFade * (0.22 + passShock * 0.12),
      12,
      delta
    );
    const beamSpread = 0.84 + target * 0.9 + passShock * 0.36;
    landing.beam.scale.set(beamSpread, 1, beamSpread);
  }
}

function updateAdaptiveQuality(delta) {
  if (!qualityState.dynamicQualityEnabled) return;

  qualityState.frameTime += delta;
  qualityState.frameCount += 1;

  if (qualityState.frameTime < 1.5) return;
  const fps = qualityState.frameCount / qualityState.frameTime;
  qualityState.frameTime = 0;
  qualityState.frameCount = 0;

  let next = qualityState.targetPixelRatio;
  if (fps < 45 && next > qualityState.minPixelRatio + 0.02) {
    next -= 0.1;
  } else if (fps > 57 && next < qualityState.maxPixelRatio - 0.02) {
    next += 0.08;
  }

  next = THREE.MathUtils.clamp(Math.round(next * 100) / 100, qualityState.minPixelRatio, qualityState.maxPixelRatio);
  if (Math.abs(next - qualityState.targetPixelRatio) > 0.03) {
    qualityState.targetPixelRatio = next;
    resizeRenderer(window.innerWidth, window.innerHeight);
  }

  const nextTier = fps < 42 ? 0 : fps < 52 ? 1 : 2;
  if (nextTier !== qualityState.postTier) {
    qualityState.postTier = nextTier;
    applyQualityTier();
  }
}

function applyQualityTier(force = false) {
  if (!force && qualityState.appliedPostTier === qualityState.postTier) return;
  qualityState.appliedPostTier = qualityState.postTier;
  const isWarming = warmupFrames < WARMUP_THRESHOLD;
  const bokehAllowed = qualityState.allowBokeh && !flybyStabilityState.bokehSuppressed && !isWarming;

  if (qualityState.postTier === 2) {
    bokehPass.enabled = bokehAllowed;
    smaaPass.enabled = true;
    qualityState.dofScale = bokehAllowed ? 1 : 0;
    qualityState.motionBlurScale = 1;
    qualityState.bloomCeiling = 2.1;
    cinematicPass.uniforms.uGrain.value = 0.006;
    return;
  }

  if (qualityState.postTier === 1) {
    bokehPass.enabled = bokehAllowed;
    smaaPass.enabled = true;
    qualityState.dofScale = bokehAllowed ? 0.78 : 0;
    qualityState.motionBlurScale = 0.84;
    qualityState.bloomCeiling = 1.82;
    cinematicPass.uniforms.uGrain.value = 0.0045;
    return;
  }

  bokehPass.enabled = false;
  smaaPass.enabled = false;
  qualityState.dofScale = 0;
  qualityState.motionBlurScale = 0.62;
  qualityState.bloomCeiling = 1.62;
  cinematicPass.uniforms.uGrain.value = 0.0035;
}

function makeHeroJet() {
  const group = new THREE.Group();
  const fuselageMat = new THREE.MeshPhysicalMaterial({ color: 0x131318, roughness: 0.52, metalness: 0.78 });
  const wingMat = new THREE.MeshPhysicalMaterial({ color: 0x101015, roughness: 0.6, metalness: 0.56 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x040406, roughness: 0.92, metalness: 0.08 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.25, 18, 42), fuselageMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = -1.3;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.84, 32, 20), fuselageMat);
  nose.position.set(0, 0.2, 7.8);
  nose.scale.set(1, 1, 1.45);
  group.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(40, 0.36, 3.6), wingMat);
  wing.position.set(0, -0.72, -1.85);
  group.add(wing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.2, 1.7), wingMat);
  tailWing.position.set(0, 0.9, -8.8);
  group.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.25, 0.34), wingMat);
  fin.position.set(0, 2.45, -8.95);
  group.add(fin);

  const engineOffsets = [-11, -5.5, 5.5, 11];
  for (const x of engineOffsets) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.08, 2.8, 28), wingMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(x, -1.25, -2.85);
    group.add(nacelle);
  }

  const wheelOffsets = [
    [0, -2.85, 3.45],
    [-2.7, -2.95, -0.25],
    [-2.2, -2.95, -0.25],
    [2.2, -2.95, -0.25],
    [2.7, -2.95, -0.25],
  ];
  for (const [x, y, z] of wheelOffsets) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.12, 12, 26), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  group.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = qualityState.allowAircraftShadow;
    node.receiveShadow = false;
  });

  group.scale.setScalar(0.72);
  return group;
}

function updateViewport() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  qualityState.maxPixelRatio = Math.min(window.devicePixelRatio || 1, isTouchLikeDevice ? mobilePixelRatioCap : desktopPixelRatioCap);
  qualityState.targetPixelRatio = THREE.MathUtils.clamp(qualityState.targetPixelRatio, qualityState.minPixelRatio, qualityState.maxPixelRatio);
  applyQualityTier(true);
  resizeRenderer(width, height);

  camera.aspect = width / height;
  camera.fov = isTouchLikeDevice ? (camera.aspect < 0.72 ? 48 : 42) : camera.aspect < 0.78 ? 43 : 37;
  smoothState.fov = camera.fov;
  camera.updateProjectionMatrix();
  bokehPass.uniforms.aspect.value = camera.aspect;
}

function resizeRenderer(width, height) {
  const pixelRatio = qualityState.targetPixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  bloomPass.setSize(width, height);
  cinematicPass.uniforms.uResolution.value.set(Math.floor(width * pixelRatio), Math.floor(height * pixelRatio));
}
