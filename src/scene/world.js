import * as THREE from "three";

export function addWorld(scene, renderer, hazeTexture) {
  const hemi = new THREE.HemisphereLight(0x7da4ff, 0x07111a, 0.42);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffb77d, 1.6);
  key.position.set(6, 14, -30);
  key.castShadow = renderer.shadowMap.enabled;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00008;
  key.shadow.normalBias = 0.014;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 140;
  key.shadow.camera.left = -34;
  key.shadow.camera.right = 34;
  key.shadow.camera.top = 34;
  key.shadow.camera.bottom = -34;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0x7dadeb, 0.82);
  rim.position.set(-16, 22, -8);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9fc3ff, 0.46);
  fill.position.set(4, 10, 18);
  scene.add(fill);

  const runwayGlow = new THREE.PointLight(0xffd2b4, 52, 160, 2);
  runwayGlow.position.set(0, -1.15, -24);
  scene.add(runwayGlow);

  // --- REALISTIC PBR TEXTURES (POLYHAVEN ASPHALT) ---
  const tLoader = new THREE.TextureLoader();
  const diffTex = tLoader.load("https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_02/asphalt_02_diff_2k.jpg");
  const norTex = tLoader.load("https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_02/asphalt_02_nor_gl_2k.jpg");
  const roughTex = tLoader.load("https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_02/asphalt_02_rough_2k.jpg");

  const setupTex = (tex, repeatX, repeatY) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  };

  diffTex.colorSpace = THREE.SRGBColorSpace;
  setupTex(diffTex, 4, 35);
  setupTex(norTex, 4, 35);
  setupTex(roughTex, 4, 35);

  const runwayMaterial = new THREE.MeshStandardMaterial({
    map: diffTex,
    normalMap: norTex,
    roughnessMap: roughTex,
    roughness: 0.85,
    metalness: 0.2,
    color: 0x999999,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });

  const runway = new THREE.Mesh(new THREE.PlaneGeometry(32, 280), runwayMaterial);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, -1.98, -78);
  runway.receiveShadow = true;
  scene.add(runway);

  // --- RUNWAY MARKINGS (Transparent Overlay Layer) ---
  const markCanvas = document.createElement("canvas");
  markCanvas.width = 1024;
  markCanvas.height = 1024;
  const ctxM = markCanvas.getContext("2d");
  ctxM.clearRect(0, 0, 1024, 1024);

  ctxM.fillStyle = "rgba(180, 190, 200, 0.75)";
  for (let j = 0; j < 1024; j += 120) {
    ctxM.fillRect(504, j + 20, 16, 60);
  }
  ctxM.fillStyle = "rgba(140, 150, 160, 0.6)";
  ctxM.fillRect(40, 0, 16, 1024);
  ctxM.fillRect(968, 0, 16, 1024);

  ctxM.fillStyle = "rgba(5, 5, 5, 0.65)";
  for (let i = 0; i < 200; i++) {
    ctxM.fillRect(300 + Math.random() * 424, Math.random() * 1024, 6 + Math.random() * 12, 60 + Math.random() * 200);
  }

  const markTex = new THREE.CanvasTexture(markCanvas);
  markTex.wrapS = markTex.wrapT = THREE.RepeatWrapping;
  markTex.repeat.set(1, 12);
  markTex.anisotropy = diffTex.anisotropy;

  const markingsMaterial = new THREE.MeshBasicMaterial({
    map: markTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const runwayMarkings = new THREE.Mesh(new THREE.PlaneGeometry(32, 280), markingsMaterial);
  runwayMarkings.rotation.x = -Math.PI / 2;
  runwayMarkings.position.set(0, -1.97, -78);
  scene.add(runwayMarkings);

  // --- TARMAC ---
  const diffTarmac = diffTex.clone();
  const norTarmac = norTex.clone();
  const roughTarmac = roughTex.clone();

  setupTex(diffTarmac, 30, 45);
  setupTex(norTarmac, 30, 45);
  setupTex(roughTarmac, 30, 45);

  const tarmacMaterial = new THREE.MeshStandardMaterial({
    map: diffTarmac,
    normalMap: norTarmac,
    roughnessMap: roughTarmac,
    roughness: 0.9,
    metalness: 0.15,
    color: 0x888888,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(280, 420), tarmacMaterial);
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, -2.0, -112);
  tarmac.receiveShadow = true;
  scene.add(tarmac);

  const horizonGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 22),
    new THREE.MeshBasicMaterial({
      map: hazeTexture,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xff5010,
    })
  );
  horizonGlow.position.set(0, 1.6, -92);
  scene.add(horizonGlow);

  return {
    keyLight: key,
    ground: {
      runway,
      tarmac,
      runwayMaterial,
      tarmacMaterial,
      runwayGlow,
    },
  };
}

export function addSkyDome(scene) {
  const geometry = new THREE.SphereGeometry(280, 40, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x020a16) },
      midColor: { value: new THREE.Color(0x081f3b) },
      horizonColor: { value: new THREE.Color(0xff4500) },
      lowerColor: { value: new THREE.Color(0x010203) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 lowerColor;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }

      void main() {
        vec3 dir = normalize(vPos);
        float h = dir.y * 0.5 + 0.5;
        vec3 dusk = mix(midColor, topColor, smoothstep(0.24, 0.92, h));
        vec3 warm = mix(horizonColor, dusk, smoothstep(0.08, 0.64, h));
        vec3 c3 = mix(lowerColor, warm, smoothstep(0.0, 0.94, h));
        
        float horizonBand = 1.0 - smoothstep(0.0, 0.2, abs(h - 0.28));
        c3 += horizonColor * horizonBand * 0.22;
        
        float n1 = noise(dir * 180.0);
        float n2 = noise(dir * 380.0);
        float stars = smoothstep(0.85, 1.0, n1) * smoothstep(0.8, 1.0, n2);
        
        float milky = noise(dir * 8.0) * noise(dir * 15.0);
        
        c3 += stars * smoothstep(0.3, 0.8, h) * vec3(0.8, 0.9, 1.0) * 1.5;
        c3 += milky * smoothstep(0.2, 0.7, h) * vec3(0.1, 0.3, 0.6) * 0.45;
        
        gl_FragColor = vec4(c3, 1.0);
      }
    `,
  });

  const dome = new THREE.Mesh(geometry, material);
  scene.add(dome);
}

export function addRunwayLights(scene, starTexture) {
  const stars = [];

  const addLight = (x, y, z, scale, depth, color) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starTexture,
        color,
        transparent: true,
        opacity: 0.74,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale, 1);
    sprite.userData = { phase: Math.random() * Math.PI * 2, baseScale: scale, depth };
    scene.add(sprite);
    stars.push(sprite);
  };

  for (let i = 0; i < 34; i++) {
    const depth = i / 33;
    const z = -8 - depth * 190;
    const y = -1.6 + depth * 0.42;
    const scale = THREE.MathUtils.lerp(1.08, 0.2, depth);
    addLight(0, y, z, scale, depth, 0xfff1d5);

    const spread = 6.5 + depth * 30;
    const sideScale = scale * 0.92;
    addLight(-spread, y - 0.02, z + 0.6, sideScale, depth, 0xbad7ff);
    addLight(spread, y - 0.02, z + 0.6, sideScale, depth, 0xbad7ff);
  }

  return stars;
}

export function addCloudDeck(scene, cloudTexture) {
  const clouds = [];

  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.1,
        color: i % 2 === 0 ? 0xdbe8ff : 0xc4d7ff,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

    const x = (Math.random() - 0.5) * 120;
    const y = 18 + Math.random() * 20;
    const z = -110 - Math.random() * 120;
    const s = 24 + Math.random() * 40;

    cloud.position.set(x, y, z);
    cloud.scale.set(s, s * 0.5, 1);
    cloud.userData.phase = Math.random() * Math.PI * 2;
    cloud.userData.drift = (Math.random() - 0.5) * 0.012;

    scene.add(cloud);
    clouds.push(cloud);
  }

  return clouds;
}

export function addAtmosphereVolumes(scene, volumeFogTexture) {
  const volumes = [];

  for (let i = 0; i < 9; i++) {
    const depth = i / 8;
    const width = THREE.MathUtils.lerp(24, 11, depth);
    const height = THREE.MathUtils.lerp(14, 8, depth);
    const material = new THREE.SpriteMaterial({
      map: volumeFogTexture,
      color: i % 2 === 0 ? 0xffd7bf : 0xc6dcff,
      transparent: true,
      opacity: THREE.MathUtils.lerp(0.062, 0.034, depth),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Sprite(material);
    mesh.scale.set(width, height, 1);
    mesh.position.set((Math.random() - 0.5) * 16, THREE.MathUtils.lerp(1.2, 4.8, depth), -26 - depth * 96);
    mesh.userData = {
      phase: Math.random() * Math.PI * 2,
      baseOpacity: material.opacity,
      baseX: mesh.position.x,
      baseY: mesh.position.y,
      lift: THREE.MathUtils.lerp(0.8, 2.2, depth),
      flybyBoost: THREE.MathUtils.lerp(0.7, 0.28, depth),
    };
    scene.add(mesh);
    volumes.push(mesh);
  }

  return volumes;
}
