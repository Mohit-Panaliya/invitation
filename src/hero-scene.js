import * as THREE from "three";

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 248, 225, 1)");
  gradient.addColorStop(0.22, "rgba(246, 216, 150, 0.9)");
  gradient.addColorStop(0.55, "rgba(218, 166, 78, 0.32)");
  gradient.addColorStop(1, "rgba(218, 166, 78, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function goldColor(t = Math.random()) {
  const color = new THREE.Color();
  if (t > 0.82) color.setHSL(0.055, 0.72, 0.6);
  else if (t > 0.28) color.setHSL(0.105, 0.68, 0.52 + Math.random() * 0.22);
  else color.setHSL(0.11, 0.35, 0.78);
  return color;
}

function buildPoints(positions, colors, size, texture, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

export function initHeroScene(canvas, options = {}) {
  const reduceMotion = options.reduceMotion ?? false;
  const smallScreen = window.matchMedia("(max-width: 680px)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !smallScreen, powerPreference: "high-performance" });
  } catch {
    return { setScroll() {}, destroy() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  camera.position.set(0, 0, 8.4);

  const group = new THREE.Group();
  scene.add(group);

  const texture = makeGlowTexture();

  const ringPositions = [];
  const ringColors = [];
  const rings = [
    { radius: 1.35, count: 70, z: 0.18 },
    { radius: 2.0, count: 110, z: 0.05 },
    { radius: 2.68, count: 150, z: -0.05 },
    { radius: 3.42, count: 190, z: -0.16 },
  ];
  rings.forEach((ring, index) => {
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < ring.count; i += 1) {
      const angle = offset + (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.02;
      const radius = ring.radius + (Math.random() - 0.5) * 0.06;
      ringPositions.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        ring.z + Math.sin(angle * 3 + index) * 0.12 + (Math.random() - 0.5) * 0.05
      );
      const color = goldColor();
      ringColors.push(color.r, color.g, color.b);
    }
  });

  const petalPositions = [];
  const petalColors = [];
  const petalCount = 14;
  for (let p = 0; p < petalCount; p += 1) {
    const base = (p / petalCount) * Math.PI * 2;
    const direction = p % 2 === 0 ? 1 : -1;
    for (let i = 0; i < 46; i += 1) {
      const s = i / 45;
      const angle = base + direction * s * 0.55;
      const radius = 1.05 + s * 2.25;
      const lift = Math.sin(Math.PI * s) * 0.35;
      petalPositions.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        lift + (Math.random() - 0.5) * 0.04
      );
      const color = goldColor(i % 9 === 0 ? 0.95 : 0.6);
      petalColors.push(color.r * 0.85, color.g * 0.8, color.b * 0.75);
    }
  }

  const dustPositions = [];
  const dustColors = [];
  for (let i = 0; i < 420; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.pow(Math.random(), 0.6) * 6.5;
    dustPositions.push(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.8,
      (Math.random() - 0.5) * 3.5
    );
    const color = goldColor(0.4);
    dustColors.push(color.r, color.g, color.b);
  }

  const ringsPoints = buildPoints(ringPositions, ringColors, 0.055, texture, 0.95);
  const petalsPoints = buildPoints(petalPositions, petalColors, 0.04, texture, 0.85);
  const dustPoints = buildPoints(dustPositions, dustColors, 0.045, texture, 0.5);
  group.add(ringsPoints, petalsPoints, dustPoints);

  const lineGroup = new THREE.Group();
  [2.35, 3.1, 3.85].forEach((radius, index) => {
    const points = [];
    for (let i = 0; i <= 160; i += 1) {
      const a = (i / 160) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, -0.2 - index * 0.05));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xd8b06a,
      transparent: true,
      opacity: 0.16 - index * 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    lineGroup.add(new THREE.Line(geometry, material));
  });
  group.add(lineGroup);

  const glowTexture = new THREE.CanvasTexture((() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255, 224, 160, 0.8)");
    g.addColorStop(0.4, "rgba(214, 158, 74, 0.3)");
    g.addColorStop(1, "rgba(214, 158, 74, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return c;
  })());
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.scale.set(5.2, 5.2, 1);
  glow.position.z = -1.4;
  scene.add(glow);

  let scrollTarget = 0;
  let scrollCurrent = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerXCurrent = 0;
  let pointerYCurrent = 0;
  let visible = true;
  let rafId = null;
  let clock = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function renderFrame(delta, time) {
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.06;
    pointerXCurrent += (pointerX - pointerXCurrent) * 0.055;
    pointerYCurrent += (pointerY - pointerYCurrent) * 0.055;

    if (!reduceMotion) {
      group.rotation.z += delta * 0.085;
      lineGroup.rotation.z -= delta * 0.045;
      group.rotation.x = pointerYCurrent * 0.12 + scrollCurrent * 0.05;
      group.rotation.y = pointerXCurrent * 0.16;
      group.position.y = scrollCurrent * 1.4 + Math.sin(time * 0.35) * 0.06;
      group.position.x = pointerXCurrent * 0.18;
      camera.position.z = 8.4 + scrollCurrent * 2.6;
      camera.position.x = pointerXCurrent * 0.35;
      camera.position.y = -pointerYCurrent * 0.22;
      camera.lookAt(0, 0, 0);
      glow.material.opacity = 0.4 + Math.sin(time * 0.8) * 0.06;
    }

    renderer.render(scene, camera);
  }

  function loop() {
    const delta = Math.min(clock + 0.016, 0.05);
    clock += delta;
    renderFrame(delta, clock);
    if (visible) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function start() {
    if (rafId === null) {
      clock = 0;
      rafId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onPointerMove(event) {
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  }

  function onVisibility() {
    if (document.hidden) stop();
    else if (visible) start();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    },
    { threshold: 0 }
  );
  intersectionObserver.observe(canvas);

  if (reduceMotion) {
    renderFrame(0.016, 1);
  } else {
    start();
  }

  return {
    setScroll(value) {
      scrollTarget = Math.max(0, Math.min(1.4, value));
    },
    destroy() {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
    },
  };
}
