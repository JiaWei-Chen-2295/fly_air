import * as THREE from "three";

export function addWorld(scene, renderer, hazeTexture) {
  const hemi = new THREE.HemisphereLight(0xaec9ff, 0x0a1628, 0.42);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffddc3, 1.58);
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

  const rim = new THREE.DirectionalLight(0xc6dcff, 0.72);
  rim.position.set(-16, 22, -8);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9fc3ff, 0.46);
  fill.position.set(4, 10, 18);
  scene.add(fill);

  const runwayGlow = new THREE.PointLight(0xffd2b4, 52, 160, 2);
  runwayGlow.position.set(0, -1.15, -24);
  scene.add(runwayGlow);

  const runwayMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    roughness: 0.92,
    metalness: 0.08,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(32, 280), runwayMaterial);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, -1.98, -78);
  runway.receiveShadow = true;
  scene.add(runway);

  const tarmacMaterial = new THREE.MeshStandardMaterial({
    color: 0x050b16,
    roughness: 0.98,
    metalness: 0.01,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(280, 420), tarmacMaterial);
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, -2, -112);
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
      color: 0xffd8c4,
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
      topColor: { value: new THREE.Color(0x0f3567) },
      midColor: { value: new THREE.Color(0x5c89c0) },
      horizonColor: { value: new THREE.Color(0xffbb9f) },
      lowerColor: { value: new THREE.Color(0x040a14) },
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

      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        vec3 dusk = mix(midColor, topColor, smoothstep(0.24, 0.92, h));
        vec3 warm = mix(horizonColor, dusk, smoothstep(0.08, 0.64, h));
        vec3 c3 = mix(lowerColor, warm, smoothstep(0.0, 0.94, h));
        float horizonBand = 1.0 - smoothstep(0.0, 0.2, abs(h - 0.28));
        c3 += horizonColor * horizonBand * 0.12;
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
