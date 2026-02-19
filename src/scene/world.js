import * as THREE from "three";

export function addWorld(scene, renderer, hazeTexture) {
  const hemi = new THREE.HemisphereLight(0x3248aa, 0x140607, 0.26);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xff8146, 1.92);
  key.position.set(0, 10, -34);
  key.castShadow = renderer.shadowMap.enabled;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00008;
  key.shadow.normalBias = 0.018;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 140;
  key.shadow.camera.left = -34;
  key.shadow.camera.right = 34;
  key.shadow.camera.top = 34;
  key.shadow.camera.bottom = -34;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6b86ff, 0.86);
  rim.position.set(-9, 25, -12);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x96a8ff, 0.32);
  fill.position.set(0, 7, 24);
  scene.add(fill);

  const runwayGlow = new THREE.PointLight(0xff6b2a, 78, 132, 2);
  runwayGlow.position.set(0, -1.15, -24);
  scene.add(runwayGlow);

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 280),
    new THREE.MeshStandardMaterial({ color: 0x0a0708, roughness: 0.98, metalness: 0.04 })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, -1.98, -78);
  runway.receiveShadow = true;
  scene.add(runway);

  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 420),
    new THREE.MeshStandardMaterial({ color: 0x020205, roughness: 1, metalness: 0 })
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, -2, -112);
  tarmac.receiveShadow = true;
  scene.add(tarmac);

  const horizonGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 22),
    new THREE.MeshBasicMaterial({
      map: hazeTexture,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xff6c25,
    })
  );
  horizonGlow.position.set(0, 1.4, -94);
  scene.add(horizonGlow);
}

export function addSkyDome(scene) {
  const geometry = new THREE.SphereGeometry(280, 40, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x060f2f) },
      midColor: { value: new THREE.Color(0x22115f) },
      horizonColor: { value: new THREE.Color(0xff5b22) },
      lowerColor: { value: new THREE.Color(0x060107) },
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
        vec3 dusk = mix(topColor, midColor, smoothstep(0.2, 0.7, h));
        vec3 warm = mix(horizonColor, dusk, smoothstep(0.04, 0.58, h));
        vec3 c3 = mix(lowerColor, warm, smoothstep(0.0, 0.88, h));
        float horizonBand = 1.0 - smoothstep(0.0, 0.22, abs(h - 0.3));
        c3 += horizonColor * horizonBand * 0.18;
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
        opacity: 0.68,
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
    const scale = THREE.MathUtils.lerp(1.22, 0.2, depth);
    addLight(0, y, z, scale, depth, 0xffc476);

    const spread = 6 + depth * 28;
    const sideScale = scale * 0.92;
    addLight(-spread, y - 0.02, z + 0.6, sideScale, depth, 0xff9650);
    addLight(spread, y - 0.02, z + 0.6, sideScale, depth, 0xff9650);
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
        opacity: 0.12,
        color: i % 2 === 0 ? 0x8398ff : 0x5f74ff,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

    const x = (Math.random() - 0.5) * 120;
    const y = 16 + Math.random() * 22;
    const z = -110 - Math.random() * 120;
    const s = 18 + Math.random() * 34;

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
      color: i % 2 === 0 ? 0xff8d4a : 0x7c8fff,
      transparent: true,
      opacity: THREE.MathUtils.lerp(0.055, 0.03, depth),
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
