import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { initHeroScene } from "./hero-scene.js";

gsap.registerPlugin(ScrollTrigger);

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

document.documentElement.classList.toggle("reduced-motion", reduceMotion);

/* ---------- Decorative mandalas ---------- */
function buildMandala(el) {
  const petals = Math.max(8, Number(el.dataset.mandala) || 16);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 600 600");
  svg.setAttribute("aria-hidden", "true");
  const g = document.createElementNS(ns, "g");
  g.setAttribute("fill", "none");
  g.setAttribute("stroke", "currentColor");

  const rings = [
    { r: 292, w: 0.7, o: 0.7, dash: "" },
    { r: 268, w: 0.5, o: 0.4, dash: "2 7" },
    { r: 214, w: 0.5, o: 0.45, dash: "" },
    { r: 148, w: 0.5, o: 0.35, dash: "1 6" },
    { r: 92, w: 0.5, o: 0.5, dash: "" },
  ];
  rings.forEach((ring) => {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "300");
    circle.setAttribute("cy", "300");
    circle.setAttribute("r", String(ring.r));
    circle.setAttribute("stroke-width", String(ring.w));
    circle.setAttribute("opacity", String(ring.o));
    if (ring.dash) circle.setAttribute("stroke-dasharray", ring.dash);
    g.appendChild(circle);
  });

  for (let i = 0; i < petals; i += 1) {
    const angle = (360 / petals) * i;
    const petal = document.createElementNS(ns, "ellipse");
    petal.setAttribute("cx", "300");
    petal.setAttribute("cy", "170");
    petal.setAttribute("rx", "27");
    petal.setAttribute("ry", "120");
    petal.setAttribute("stroke-width", "0.7");
    petal.setAttribute("opacity", "0.55");
    petal.setAttribute("transform", `rotate(${angle} 300 300)`);
    g.appendChild(petal);

    const inner = document.createElementNS(ns, "ellipse");
    inner.setAttribute("cx", "300");
    inner.setAttribute("cy", "232");
    inner.setAttribute("rx", "13");
    inner.setAttribute("ry", "65");
    inner.setAttribute("stroke-width", "0.6");
    inner.setAttribute("opacity", "0.3");
    inner.setAttribute("transform", `rotate(${angle + 180 / petals} 300 300)`);
    g.appendChild(inner);

    const dot = document.createElementNS(ns, "circle");
    const rad = ((angle - 90) * Math.PI) / 180;
    dot.setAttribute("cx", String(300 + Math.cos(rad) * 292));
    dot.setAttribute("cy", String(300 + Math.sin(rad) * 292));
    dot.setAttribute("r", "2.6");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    dot.setAttribute("opacity", "0.8");
    g.appendChild(dot);
  }

  svg.appendChild(g);
  el.appendChild(svg);
}

$$("[data-mandala]").forEach(buildMandala);

/* ---------- Smooth scroll ---------- */
const lenis = new Lenis({
  duration: reduceMotion ? 0.2 : 1.2,
  smoothWheel: !reduceMotion,
  wheelMultiplier: 1,
  touchMultiplier: 1.5,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

let menuOpen = false;

/* ---------- Helpers ---------- */
function splitChars(el) {
  const text = el.textContent.trim();
  el.textContent = "";
  const chars = [];
  [...text].forEach((char) => {
    if (char === " ") {
      el.appendChild(document.createTextNode(" "));
      return;
    }
    const span = document.createElement("span");
    span.className = "ch";
    span.textContent = char;
    el.appendChild(span);
    chars.push(span);
  });
  return chars;
}

function splitWords(root) {
  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    const parts = node.nodeValue.split(/(\s+)/);
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(" "));
        return;
      }
      const outer = document.createElement("span");
      outer.className = "w";
      const inner = document.createElement("span");
      inner.className = "w-in";
      inner.textContent = part;
      outer.appendChild(inner);
      fragment.appendChild(outer);
      fragment.appendChild(document.createTextNode(" "));
    });
    node.replaceWith(fragment);
  });

  return [...root.querySelectorAll(".w-in")];
}

let toastTimer;
function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      return true;
    } catch {
      return false;
    }
  }
}

/* ---------- Petals ---------- */
const petalCanvas = $("#petals");
const petalCtx = petalCanvas?.getContext("2d");
const petalStore = [];
let petalRaf = null;
const petalPalette = ["#e3a12f", "#d9852a", "#c0653a", "#b4474f", "#e3c07a", "#f3ecdf"];

function sizePetals() {
  if (!petalCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  petalCanvas.width = window.innerWidth * dpr;
  petalCanvas.height = window.innerHeight * dpr;
  petalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizePetals();
window.addEventListener("resize", sizePetals);

function addPetal(config) {
  petalStore.push({
    x: config.x,
    y: config.y,
    vx: config.vx,
    vy: config.vy,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.12,
    size: config.size ?? 4 + Math.random() * 7,
    color: petalPalette[Math.floor(Math.random() * petalPalette.length)],
    life: 1,
    decay: 0.0025 + Math.random() * 0.004,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.02 + Math.random() * 0.03,
  });
}

function runPetals() {
  if (!petalCtx) return;
  petalCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (let i = petalStore.length - 1; i >= 0; i -= 1) {
    const p = petalStore[i];
    p.vy += 0.028;
    p.vx *= 0.996;
    p.x += p.vx + Math.sin(p.sway + p.life * 8) * 0.35;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= p.decay;
    if (p.y > window.innerHeight + 40 || p.life <= 0) {
      petalStore.splice(i, 1);
      continue;
    }
    petalCtx.save();
    petalCtx.translate(p.x, p.y);
    petalCtx.rotate(p.rot);
    petalCtx.globalAlpha = Math.min(1, p.life * 1.6);
    petalCtx.fillStyle = p.color;
    petalCtx.beginPath();
    petalCtx.moveTo(0, -p.size);
    petalCtx.bezierCurveTo(p.size * 0.8, -p.size * 0.3, p.size * 0.6, p.size * 0.6, 0, p.size);
    petalCtx.bezierCurveTo(-p.size * 0.7, p.size * 0.5, -p.size * 0.8, -p.size * 0.3, 0, -p.size);
    petalCtx.fill();
    petalCtx.restore();
  }
  if (petalStore.length > 0) {
    petalRaf = requestAnimationFrame(runPetals);
  } else {
    petalRaf = null;
    petalCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

function startPetals() {
  if (petalRaf === null) petalRaf = requestAnimationFrame(runPetals);
}

function petalsBurst(x, y, count = 24) {
  if (!petalCtx) return;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    addPetal({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.4,
      size: 4 + Math.random() * 6,
    });
  }
  startPetals();
}

function petalShower(count = 54) {
  if (!petalCtx) return;
  for (let i = 0; i < count; i += 1) {
    addPetal({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * 180,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.8 + Math.random() * 1.8,
      size: 4 + Math.random() * 7,
    });
  }
  startPetals();
}

/* ---------- Hero scene ---------- */
let heroScene = null;
try {
  heroScene = initHeroScene($("[data-hero-canvas]"), { reduceMotion });
} catch {
  heroScene = { setScroll() {}, destroy() {} };
}

/* ---------- Loader / reveal ---------- */
const heroChars = $$("[data-hero-line]").flatMap(splitChars);
let siteRevealed = false;

if (!reduceMotion) {
  gsap.set(".hero__bg", { scale: 1.14 });
  gsap.set(heroChars, { yPercent: 116 });
  gsap.set("[data-hero-amp]", { scale: 0.35, opacity: 0, rotate: -32 });
  gsap.set("[data-hero-fade]", { y: 26, opacity: 0 });
  gsap.set(".hero__top", { opacity: 0, y: -14 });
  gsap.set(".hero__side", { opacity: 0 });
  gsap.set("[data-badge]", { opacity: 0, scale: 0.65 });
  gsap.set("[data-hero-canvas]", { opacity: 0 });
  gsap.set(".nav", { opacity: 0, y: -18 });
}

function runHeroIntro() {
  if (reduceMotion) return;
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.to(".hero__bg", { scale: 1, duration: 2.4 }, 0)
    .to("[data-hero-canvas]", { opacity: 1, duration: 1.8 }, 0.15)
    .to(".nav", { opacity: 1, y: 0, duration: 1.2 }, 0.1)
    .to(".hero__top", { opacity: 1, y: 0, duration: 1.1 }, 0.2)
    .to(".hero__side", { opacity: 1, duration: 1.1 }, 0.4)
    .to(heroChars, { yPercent: 0, duration: 1.4, stagger: 0.055, ease: "expo.out" }, 0.15)
    .to("[data-hero-amp]", { scale: 1, opacity: 1, rotate: -9, duration: 1.3, ease: "back.out(1.6)" }, 0.7)
    .to("[data-hero-fade]", { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 }, 0.55)
    .to("[data-badge]", { opacity: 1, scale: 1, duration: 1.2, ease: "back.out(1.5)" }, 0.75);
}

function revealSite() {
  if (siteRevealed) return;
  siteRevealed = true;
  const finish = () => {
    const loader = $("#loader");
    if (loader) loader.style.display = "none";
    document.body.classList.remove("is-loading");
    document.documentElement.classList.remove("is-locked");
    lenis.start();
    if (finePointer) document.body.classList.add("has-cursor");
    ScrollTrigger.refresh();
  };

  if (reduceMotion) {
    finish();
    return;
  }

  const tl = gsap.timeline();
  tl.to(".loader__content", { autoAlpha: 0, y: -24, duration: 0.55, ease: "power2.in" });
  tl.addLabel("lift");
  tl.to(".loader__pane--left", { yPercent: -100, duration: 1.15, ease: "expo.inOut" }, "lift");
  tl.to(".loader__pane--right", { yPercent: -100, duration: 1.15, ease: "expo.inOut" }, "lift+=0.08");
  tl.call(
    () => {
      document.body.classList.remove("is-loading");
      lenis.start();
      if (finePointer) document.body.classList.add("has-cursor");
      runHeroIntro();
    },
    null,
    "lift+=0.25"
  );
  tl.call(() => {
    finish();
  });
}

function initLoader() {
  const loader = $("#loader");
  if (!loader) return;
  if (reduceMotion) {
    loader.style.display = "none";
    document.body.classList.remove("is-loading");
    document.documentElement.classList.remove("is-locked");
    lenis.start();
    if (finePointer) document.body.classList.add("has-cursor");
    return;
  }

  document.documentElement.classList.add("is-locked");
  lenis.stop();
  const countEl = $("[data-count]");
  const barEl = $("[data-loader-bar]");
  const counter = { value: 0 };
  gsap.to(counter, {
    value: 100,
    duration: 2,
    ease: "power2.inOut",
    onUpdate: () => {
      const value = Math.round(counter.value);
      if (countEl) countEl.textContent = String(value).padStart(2, "0");
      if (barEl) barEl.style.width = `${value}%`;
    },
    onComplete: revealSite,
  });

  setTimeout(() => {
    if (!siteRevealed) {
      revealSite();
    }
  }, 6500);
}

initLoader();

/* ---------- Cursor ---------- */
function initCursor() {
  if (!finePointer) return;
  const cursor = $("#cursor");
  if (!cursor) return;
  const label = $(".cursor__label", cursor);
  const moveX = gsap.quickTo(cursor, "x", { duration: 0.22, ease: "power3.out" });
  const moveY = gsap.quickTo(cursor, "y", { duration: 0.22, ease: "power3.out" });
  let current = null;

  const setState = (el) => {
    if (el === current) return;
    current = el;
    cursor.classList.toggle("is-label", Boolean(el?.dataset?.cursor));
    cursor.classList.toggle("is-hover", Boolean(el) && !el?.dataset?.cursor);
    if (el?.dataset?.cursor && label) label.textContent = el.dataset.cursor;
  };

  window.addEventListener("pointermove", (event) => {
    moveX(event.clientX);
    moveY(event.clientY);
    if (event.pointerType === "touch") return;
    const target = event.target.closest("[data-cursor], a, button, input, textarea, [role='button']");
    setState(target || null);
  });

  document.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  document.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
  document.addEventListener("pointerleave", () => setState(null));
}

function initMagnetic() {
  if (!finePointer) return;
  $$(".magnetic").forEach((el) => {
    const strength = Number(el.dataset.strength) || 0.28;
    let rect = null;
    el.addEventListener("pointerenter", () => {
      rect = el.getBoundingClientRect();
    });
    el.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      if (!rect) rect = el.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.6, ease: "power3.out" });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: "elastic.out(1, 0.45)" });
    });
  });
}

function initTilt() {
  if (!finePointer || reduceMotion) return;
  const targets = [...$$("[data-tilt]"), $("#envelope")].filter(Boolean);
  targets.forEach((el) => {
    let rect = null;
    el.addEventListener("pointerenter", () => {
      rect = el.getBoundingClientRect();
      gsap.set(el, { transformPerspective: 1000 });
    });
    el.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      if (!rect) rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      gsap.to(el, {
        rotateY: x * 6,
        rotateX: -y * 6,
        duration: 0.7,
        ease: "power2.out",
      });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1, 0.6)" });
    });
  });
}

/* ---------- Navigation ---------- */
const nav = $("#nav");
const menu = $("#menu");

function setNavSolid(scroll) {
  if (!nav) return;
  nav.classList.toggle("is-solid", scroll > window.innerHeight * 0.72);
}

function initNav() {
  if (!nav) return;
  setNavSolid(window.scrollY);
  lenis.on("scroll", ({ scroll, direction }) => {
    if (menuOpen) return;
    setNavSolid(scroll);
    if (scroll > window.innerHeight * 0.85 && direction === 1) {
      nav.classList.add("is-hidden");
    } else if (direction === -1 || scroll < 140) {
      nav.classList.remove("is-hidden");
    }
  });
}

function openMenu() {
  if (!menu || menuOpen) return;
  menuOpen = true;
  menu.classList.add("is-open");
  menu.setAttribute("aria-hidden", "false");
  document.body.classList.add("menu-open");
  lenis.stop();
  const openBtn = $("[data-menu-open]");
  if (openBtn) openBtn.setAttribute("aria-expanded", "true");
  if (nav) nav.classList.remove("is-hidden");
  if (!reduceMotion) {
    gsap.fromTo(
      ".menu__nav a",
      { y: 48, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, stagger: 0.055, ease: "expo.out", delay: 0.2 }
    );
    gsap.fromTo(".menu__foot", { opacity: 0 }, { opacity: 1, duration: 0.7, delay: 0.55 });
  }
}

function closeMenu() {
  if (!menu || !menuOpen) return;
  menuOpen = false;
  menu.classList.remove("is-open");
  menu.setAttribute("aria-hidden", "true");
  document.body.classList.remove("menu-open");
  lenis.start();
  const openBtn = $("[data-menu-open]");
  if (openBtn) openBtn.setAttribute("aria-expanded", "false");
}

function initMenu() {
  $("[data-menu-open]")?.addEventListener("click", openMenu);
  $("[data-menu-close]")?.addEventListener("click", closeMenu);
  $$("[data-menu-link]").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function initAnchors() {
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      closeMenu();
      if (id === "#top") {
        lenis.scrollTo(0, { duration: 1.5 });
      } else {
        lenis.scrollTo(target, { offset: -6, duration: 1.4 });
      }
    });
  });

  $("[data-top]")?.addEventListener("click", () => {
    lenis.scrollTo(0, { duration: 1.6 });
  });
}

/* ---------- Scroll progress / chapters ---------- */
function initScrollProgress() {
  const percent = $("[data-scroll-percent]");
  const fill = $("[data-scroll-fill]");
  const bar = $("[data-page-progress]");
  const chapter = $("[data-chapter-label]");
  const navLinks = $$(".nav__links [href^='#']");

  const chapters = [
    ["hero", "Opening"],
    ["invitation", "Invitation"],
    ["blessings", "Invocation"],
    ["couple", "The Couple"],
    ["countdown", "Countdown"],
    ["story", "Our Story"],
    ["events", "Celebrations"],
    ["moments", "The Album"],
    ["venue", "The Setting"],
    ["location", "The Location"],
    ["detailed", "Details"],
    ["rsvp", "The Reply"],
    ["footer", "Blessings"],
  ]
    .map(([id, label]) => ({ el: document.getElementById(id), label }))
    .filter((item) => item.el);

  let max = 1;
  const measure = () => {
    max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };
  measure();
  ScrollTrigger.addEventListener("refresh", measure);

  const update = () => {
    const y = window.scrollY;
    const progress = Math.min(1, Math.max(0, y / max));
    if (percent) percent.textContent = String(Math.round(progress * 100)).padStart(2, "0");
    if (fill) fill.style.height = `${progress * 100}%`;
    if (bar) bar.style.transform = `scaleX(${progress})`;

    const marker = window.innerHeight * 0.45;
    let active = chapters[0];
    chapters.forEach((item) => {
      if (item.el.getBoundingClientRect().top <= marker) active = item;
    });
    if (chapter && active && chapter.textContent !== active.label) {
      chapter.textContent = active.label;
    }

    let activeLink = null;
    navLinks.forEach((link) => {
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (target && target.getBoundingClientRect().top <= marker) activeLink = link;
    });
    navLinks.forEach((link) => link.classList.toggle("is-active", link === activeLink));
  };

  lenis.on("scroll", update);
  update();
}

/* ---------- Hero pointer spotlight ---------- */
function initHeroSpot() {
  const hero = $("#hero");
  const spot = $("[data-hero-spot]");
  if (!hero || !spot || reduceMotion || !finePointer) return;

  let targetX = 50;
  let targetY = 42;
  let x = targetX;
  let y = targetY;
  let last = "";

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width) * 100;
    targetY = ((event.clientY - rect.top) / rect.height) * 100;
    spot.classList.add("is-on");
  });
  hero.addEventListener("pointerleave", () => spot.classList.remove("is-on"));

  gsap.ticker.add(() => {
    x += (targetX - x) * 0.08;
    y += (targetY - y) * 0.08;
    if (Math.abs(targetX - x) + Math.abs(targetY - y) < 0.01) return;
    const next = `${x.toFixed(2)}% ${y.toFixed(2)}%`;
    if (next === last) return;
    last = next;
    spot.style.setProperty("--spot-x", `${x.toFixed(2)}%`);
    spot.style.setProperty("--spot-y", `${y.toFixed(2)}%`);
  });
}

/* ---------- Marquee band ---------- */
function initMarquee() {
  const row = $("[data-marquee]");
  if (!row) return;
  const base = row.innerHTML;
  row.innerHTML = `<div class="marquee__group">${base}</div><div class="marquee__group">${base}</div>`;
  if (reduceMotion) return;

  let tween = null;
  let skewTimer;
  let resizeTimer;

  const start = () => {
    const group = $(".marquee__group", row);
    if (!group) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const width = group.getBoundingClientRect().width + gap;
    if (!width) return;
    tween?.kill();
    gsap.set(row, { x: 0 });
    tween = gsap.to(row, {
      x: -width,
      duration: 34,
      repeat: -1,
      ease: "none",
    });
  };

  lenis.on("scroll", ({ velocity }) => {
    if (!tween) return;
    tween.timeScale(1 + Math.min(Math.abs(velocity) * 0.12, 2));
    gsap.to(row, {
      skewX: gsap.utils.clamp(-8, 8, -velocity * 0.35),
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
    clearTimeout(skewTimer);
    skewTimer = setTimeout(() => {
      tween?.timeScale(1);
      gsap.to(row, { skewX: 0, duration: 0.9, ease: "power3.out", overwrite: "auto" });
    }, 140);
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 260);
  });
}

/* ---------- Location ---------- */
function initLocation() {
  const map = $("[data-map]");
  const pin = $(".map__pin");
  if (map && pin && !reduceMotion) {
    gsap.to(pin, {
      y: -9,
      duration: 2.6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    gsap.fromTo(
      map.querySelector(".map__fallback"),
      { yPercent: -2.5 },
      {
        yPercent: 2.5,
        ease: "none",
        scrollTrigger: { trigger: map, start: "top bottom", end: "bottom top", scrub: 1 },
      }
    );
  }

  const copyBtn = $("[data-copy-address]");
  if (!copyBtn) return;
  const label = $("span", copyBtn);
  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(
      "Gayatri Mandir, Mogri, Anand Rural, Gujarat 388121, India"
    );
    toast(ok ? "Address copied — see you in Mogri." : "Copy the address from the card.");
    if (!ok || !label) return;
    const original = label.textContent;
    label.textContent = "Copied ✓";
    copyBtn.disabled = true;
    setTimeout(() => {
      label.textContent = original;
      copyBtn.disabled = false;
    }, 2200);
  });
}

/* ---------- Hero scroll + pointer ---------- */
function initHeroScroll() {
  ScrollTrigger.create({
    trigger: "#hero",
    start: "top top",
    end: "bottom top",
    onUpdate: (self) => heroScene?.setScroll(self.progress),
  });

  if (reduceMotion) return;
  gsap
    .timeline({
      scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 1 },
    })
    .to(".hero__inner", { yPercent: -12, opacity: 0.12 }, 0)
    .to(".hero__bg", { yPercent: 10, scale: 1.04 }, 0)
    .to(".hero__badge", { yPercent: 90, opacity: 0 }, 0)
    .to(".hero__canvas", { opacity: 0 }, 0);
}

/* ---------- Text + media reveals ---------- */
function initReveals() {
  $$("[data-split-words]").forEach((el) => {
    const words = splitWords(el);
    if (reduceMotion) return;
    gsap.set(words, { yPercent: 118, rotate: 2 });
    gsap.to(words, {
      yPercent: 0,
      rotate: 0,
      duration: 1.2,
      ease: "expo.out",
      stagger: 0.045,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  if (reduceMotion) return;

  $$("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 38,
      opacity: 0,
      duration: 1.15,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  $$(".section-label").forEach((label) => {
    const line = $(".section-label__line", label);
    if (!line) return;
    gsap.from(line, {
      scaleX: 0,
      duration: 1.3,
      ease: "expo.inOut",
      scrollTrigger: { trigger: label, start: "top 92%", once: true },
    });
  });

  $$(".media-reveal:not(.event__media)").forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: "inset(0 0 100% 0)" },
      {
        clipPath: "inset(0 0 0% 0)",
        duration: 1.4,
        ease: "expo.inOut",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
    const img = $("img", el);
    if (img) {
      gsap.fromTo(
        img,
        { scale: 1.18 },
        {
          scale: 1,
          duration: 1.8,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    }
  });

  gsap.from("[data-shloka]", {
    y: 26,
    opacity: 0,
    duration: 1.2,
    stagger: 0.07,
    ease: "power3.out",
    scrollTrigger: { trigger: "#blessings", start: "top 60%", once: true },
  });

  gsap.from(".count__unit", {
    y: 44,
    opacity: 0,
    duration: 1.1,
    stagger: 0.08,
    ease: "power3.out",
    scrollTrigger: { trigger: ".count-grid", start: "top 88%", once: true },
  });

  gsap.from(".footer__meta-item", {
    y: 20,
    opacity: 0,
    duration: 1,
    stagger: 0.08,
    ease: "power3.out",
    scrollTrigger: { trigger: ".footer__meta", start: "top 94%", once: true },
  });

  gsap.from("[data-footer-line]", {
    yPercent: 112,
    opacity: 0,
    duration: 1.3,
    stagger: 0.1,
    ease: "expo.out",
    scrollTrigger: { trigger: ".footer__names", start: "top 92%", once: true },
  });

  gsap.to(".venue__img", {
    yPercent: 8,
    scale: 1.05,
    ease: "none",
    scrollTrigger: { trigger: ".venue__hero", start: "top bottom", end: "bottom top", scrub: 1 },
  });
}

/* ---------- Ticker ---------- */
function initTicker() {
  const inner = $(".ticker__inner");
  if (!inner) return;
  const group = $(".ticker__group", inner);
  if (!group) return;
  const base = Math.max(group.getBoundingClientRect().width, 400);
  const copies = Math.max(2, Math.ceil((window.innerWidth + base * 2) / base));
  inner.innerHTML = inner.innerHTML.repeat(copies);
  const width = $(".ticker__group", inner).getBoundingClientRect().width;
  if (!width) return;
  if (reduceMotion) return;

  const tween = gsap.to(inner, {
    x: -width,
    duration: 36,
    repeat: -1,
    ease: "none",
  });

  lenis.on("scroll", ({ velocity }) => {
    gsap.to(tween, {
      timeScale: 1 + Math.min(Math.abs(velocity) * 0.25, 2.5),
      duration: 0.6,
      overwrite: true,
    });
  });
  inner.parentElement?.addEventListener("pointerenter", () => gsap.to(tween, { timeScale: 0.35, duration: 0.5 }));
  inner.parentElement?.addEventListener("pointerleave", () => gsap.to(tween, { timeScale: 1, duration: 0.8 }));
}

/* ---------- Countdown ---------- */
const countdownTarget = new Date("2027-01-28T13:30:00+05:30").getTime();
function initCountdown() {
  const grid = $("[data-countdown]");
  if (!grid) return;
  const values = {
    days: $('[data-unit="days"]'),
    hours: $('[data-unit="hours"]'),
    minutes: $('[data-unit="minutes"]'),
    seconds: $('[data-unit="seconds"]'),
  };
  let visible = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }).observe(grid);
  }

  const updateUnit = (el, value, animate) => {
    if (!el) return;
    if (el.textContent === value) return;
    el.textContent = value;
    if (animate) {
      gsap.fromTo(
        el,
        { yPercent: 30, opacity: 0.25 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: "power2.out", overwrite: true }
      );
    }
  };

  const update = () => {
    const diff = Math.max(0, countdownTarget - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff / 3600000) % 24);
    const minutes = Math.floor((diff / 60000) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    const animate = visible && !reduceMotion;

    updateUnit(values.days, String(days).padStart(diff > 0 && days < 100 ? 2 : 3, "0"), false);
    updateUnit(values.hours, String(hours).padStart(2, "0"), false);
    updateUnit(values.minutes, String(minutes).padStart(2, "0"), false);
    updateUnit(values.seconds, String(seconds).padStart(2, "0"), animate);
  };

  update();
  setInterval(update, 1000);
}

/* ---------- Story ---------- */
function initStory() {
  if (reduceMotion) return;
  const mm = gsap.matchMedia();

  mm.add("(min-width: 1025px)", () => {
    const chapters = $$(".story__chapter");
    const images = $$(".story__img");
    if (!chapters.length || !images.length) return;
    const year = $("[data-story-year]");
    const current = $("[data-story-current]");
    const progress = $("[data-story-progress]");
    let activeIndex = -1;

    const setActive = (index) => {
      if (index === activeIndex) return;
      activeIndex = index;
      if (year) year.textContent = ["01", "02", "03"][index];
      if (current) current.textContent = String(index + 1).padStart(2, "0");
      if (progress) progress.style.width = `${[33, 66, 100][index]}%`;
    };

    gsap.set(chapters, { autoAlpha: 0, y: 40 });
    gsap.set(chapters[0], { autoAlpha: 1, y: 0 });
    gsap.set(images.slice(1), { clipPath: "inset(100% 0 0 0)" });
    setActive(0);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".story__pin",
        start: "top top",
        end: "+=240%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const index = self.progress < 0.3 ? 0 : self.progress < 0.68 ? 1 : 2;
          setActive(index);
        },
      },
    });

    tl.to(chapters[0], { autoAlpha: 0, y: -40, duration: 0.4, ease: "power2.in" }, 0.55)
      .to(chapters[1], { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.68)
      .fromTo(
        images[1],
        { clipPath: "inset(100% 0 0 0)" },
        { clipPath: "inset(0% 0 0 0)", duration: 0.9, ease: "power3.inOut" },
        0.45
      )
      .to(chapters[1], { autoAlpha: 0, y: -40, duration: 0.4, ease: "power2.in" }, 1.8)
      .to(chapters[2], { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 1.92)
      .fromTo(
        images[2],
        { clipPath: "inset(100% 0 0 0)" },
        { clipPath: "inset(0% 0 0 0)", duration: 0.9, ease: "power3.inOut" },
        1.68
      )
      .to({}, { duration: 0.4 });
  });
}

/* ---------- Celebrations rail ---------- */
function initEvents() {
  if (reduceMotion) return;
  const mm = gsap.matchMedia();

  mm.add("(min-width: 1025px)", () => {
    const stage = $(".events__stage");
    const rail = $("[data-rail]");
    if (!stage || !rail) return;
    const fill = $("[data-rail-fill]");
    const label = $(".rail-progress__label");
    const distance = () => Math.max(0, rail.scrollWidth - window.innerWidth);
    if (distance() < 20) return;

    gsap.to(rail, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: stage,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (fill) fill.style.width = `${self.progress * 100}%`;
          if (label) {
            const index = Math.min(7, Math.max(1, Math.floor(self.progress * 7) + 1));
            label.textContent = `Chapter ${String(index).padStart(2, "0")} / 07`;
          }
        },
      },
    });

    gsap.from(".event__content", {
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: { trigger: stage, start: "top 75%", once: true },
    });

    gsap.fromTo(
      ".event__media",
      { clipPath: "inset(0 0 100% 0)" },
      {
        clipPath: "inset(0% 0 0 0)",
        duration: 1.3,
        stagger: 0.08,
        ease: "expo.inOut",
        scrollTrigger: { trigger: stage, start: "top 75%", once: true },
      }
    );
  });

}

/* ---------- Envelope ---------- */
function initEnvelope() {
  const envelope = $("#envelope");
  if (!envelope) return;
  const caption = $("[data-env-caption] span");
  const seal = $(".env__seal");
  if (!seal) return;

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: "power3.inOut" },
    onReverseComplete: () => {
      envelope.classList.remove("is-open");
    },
  });

  tl.to(seal, { scale: 0, rotate: 140, opacity: 0, duration: 0.5, ease: "back.in" })
    .to(".env__flap", { rotateX: 180, duration: 0.85, ease: "power3.inOut" }, "-=0.25")
    .to(".env__card", { yPercent: -52, scale: 1.02, duration: 0.95, ease: "power3.out" }, "-=0.55")
    .from(
      ".env__card-inner > *",
      { y: 16, opacity: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" },
      "-=0.6"
    );

  let open = false;
  const setCaption = () => {
    if (caption) caption.textContent = open ? "Tap the seal to close" : "Tap the seal to open";
    envelope.setAttribute("data-cursor", open ? "Close" : "Open");
  };

  const toggle = () => {
    open = !open;
    envelope.setAttribute("aria-expanded", String(open));
    envelope.classList.toggle("is-open", open);
    setCaption();
    if (open) {
      tl.play();
      const rect = envelope.getBoundingClientRect();
      petalsBurst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, 16);
    } else {
      tl.reverse();
    }
  };

  envelope.addEventListener("click", toggle);
  envelope.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
}

/* ---------- Gallery ---------- */
let lightboxOpen = false;
let lightboxIndex = 0;
let lastLightboxTrigger = null;

function initGallery() {
  const scroller = $("[data-gallery]");
  if (!scroller) return;
  const fill = $("[data-gallery-fill]");
  const items = $$(".gallery__item");
  const lightbox = $("#lightbox");
  const lightboxImg = $("[data-lightbox-img]");
  const lightboxCaption = $("[data-lightbox-caption]");
  const lightboxCount = $("[data-lightbox-count]");

  const updateProgress = () => {
    const max = scroller.scrollWidth - scroller.clientWidth;
    const ratio = max > 0 ? scroller.scrollLeft / max : 0;
    if (fill) fill.style.width = `${Math.max(8, ratio * 100)}%`;
  };
  scroller.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  let down = false;
  let startX = 0;
  let startLeft = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let moved = false;
  let dragMoved = false;
  let pointerId = null;

  scroller.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    down = true;
    moved = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startLeft = scroller.scrollLeft;
    lastX = event.clientX;
    lastTime = performance.now();
    velocity = 0;
    scroller.classList.add("is-dragging");
    scroller.setPointerCapture(event.pointerId);
    gsap.killTweensOf(scroller);
  });

  scroller.addEventListener("pointermove", (event) => {
    if (!down) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    scroller.scrollLeft = startLeft - dx;
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (event.clientX - lastX) / dt;
    lastX = event.clientX;
    lastTime = now;
  });

  const endDrag = () => {
    if (!down) return;
    down = false;
    scroller.classList.remove("is-dragging");
    if (pointerId !== null && scroller.hasPointerCapture(pointerId)) {
      scroller.releasePointerCapture(pointerId);
    }
    pointerId = null;
    if (moved) {
      dragMoved = true;
      gsap.to(scroller, {
        scrollLeft: scroller.scrollLeft - velocity * 280,
        duration: 1.1,
        ease: "power3.out",
        onUpdate: updateProgress,
      });
      setTimeout(() => {
        dragMoved = false;
      }, 260);
    }
  };

  scroller.addEventListener("pointerup", endDrag);
  scroller.addEventListener("pointercancel", endDrag);
  scroller.addEventListener("pointerleave", endDrag);

  const step = (direction) => {
    scroller.scrollBy({ left: direction * Math.min(window.innerWidth * 0.7, 640), behavior: "smooth" });
  };
  $("[data-gallery-prev]")?.addEventListener("click", () => step(-1));
  $("[data-gallery-next]")?.addEventListener("click", () => step(1));

  scroller.setAttribute("tabindex", "0");
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "Wedding photo gallery — use arrow keys to scroll");
  scroller.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  });

  items.forEach((item, index) => {
    item.addEventListener("click", (event) => {
      if (dragMoved) {
        dragMoved = false;
        event.preventDefault();
        return;
      }
      openLightbox(index);
    });
  });

  function updateLightbox(index) {
    const item = items[index];
    if (!item || !lightboxImg) return;
    const img = $("img", item);
    const caption = item.querySelector("figcaption");
    lightboxImg.src = img.dataset.full
      ? new URL(img.dataset.full, document.baseURI).href
      : img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    if (lightboxCaption) {
      lightboxCaption.textContent = caption ? caption.textContent.replace(/^\d+\s*/, "") : "";
    }
    if (lightboxCount) {
      lightboxCount.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    }
    gsap.fromTo(
      lightboxImg,
      { opacity: 0, scale: 1.03 },
      { opacity: 1, scale: 1, duration: 0.55, ease: "power2.out" }
    );
  }

  function openLightbox(index) {
    if (!lightbox || !items[index]) return;
    lightboxIndex = index;
    lastLightboxTrigger = items[index];
    updateLightbox(index);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    lightboxOpen = true;
    lenis.stop();
    const closeBtn = $("[data-lightbox-close]", lightbox);
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxOpen = false;
    lenis.start();
    lastLightboxTrigger?.focus?.();
  }

  const showRelative = (direction) => {
    lightboxIndex = (lightboxIndex + direction + items.length) % items.length;
    updateLightbox(lightboxIndex);
  };

  $("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  $("[data-lightbox-prev]")?.addEventListener("click", () => showRelative(-1));
  $("[data-lightbox-next]")?.addEventListener("click", () => showRelative(1));
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (!lightboxOpen) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowRight") showRelative(1);
    if (event.key === "ArrowLeft") showRelative(-1);
  });
}

/* ---------- FAQ ---------- */
function initFaq() {
  const items = $$(".faq__item");
  items.forEach((item) => {
    const trigger = $(".faq__trigger", item);
    const panel = $(".faq__panel", item);
    if (!trigger || !panel) return;
    trigger.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      items.forEach((other) => {
        if (other !== item && other.classList.contains("is-open")) {
          other.classList.remove("is-open");
          const otherTrigger = $(".faq__trigger", other);
          const otherPanel = $(".faq__panel", other);
          if (otherTrigger) otherTrigger.setAttribute("aria-expanded", "false");
          if (otherPanel) gsap.to(otherPanel, { height: 0, autoAlpha: 0, duration: 0.4, ease: "power2.inOut" });
        }
      });

      if (isOpen) {
        item.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        gsap.to(panel, { height: 0, autoAlpha: 0, duration: 0.45, ease: "power2.inOut" });
      } else {
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        gsap.to(panel, {
          height: "auto",
          autoAlpha: 1,
          duration: 0.55,
          ease: "power3.inOut",
          onComplete: () => ScrollTrigger.refresh(),
        });
      }
    });
  });
}

/* ---------- Sound ---------- */
function initSound() {
  const button = $("[data-sound]");
  const text = $("[data-sound-text]");
  if (!button) return;
  let ctx = null;
  let master = null;
  let playing = false;
  let bellTimer = null;
  const oscillators = [];

  const buildDrone = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.7;
    filter.connect(master);

    const notes = [
      { freq: 110, type: "sine", gain: 0.18, detune: -4 },
      { freq: 164.81, type: "sine", gain: 0.11, detune: 3 },
      { freq: 220, type: "triangle", gain: 0.06, detune: -2 },
      { freq: 329.63, type: "sine", gain: 0.045, detune: 4 },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.value = note.freq;
      osc.detune.value = note.detune;
      gain.gain.value = note.gain;
      osc.connect(gain).connect(filter);
      osc.start();
      oscillators.push(osc);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06 + Math.random() * 0.08;
      lfoGain.gain.value = note.gain * 0.35;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      oscillators.push(lfo);
    });

    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 3);

    bellTimer = setInterval(() => {
      if (!playing || !ctx) return;
      const notesBell = [523.25, 587.33, 659.25, 783.99, 880];
      const frequency = notesBell[Math.floor(Math.random() * notesBell.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.022, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
      osc.connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 3.4);
    }, 11000);
  };

  button.addEventListener("click", async () => {
    try {
      if (!ctx) buildDrone();
      if (ctx.state === "suspended") await ctx.resume();
      playing = !playing;
      button.classList.toggle("is-playing", playing);
      button.setAttribute("aria-pressed", String(playing));
      if (text) text.textContent = playing ? "Sound on" : "Sound off";
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(playing ? 0.055 : 0, ctx.currentTime + (playing ? 2 : 0.8));
      }
      if (!playing) {
        clearInterval(bellTimer);
        bellTimer = null;
      } else if (!bellTimer) {
        bellTimer = setInterval(() => {
          if (!playing || !ctx) return;
          const notesBell = [523.25, 587.33, 659.25, 783.99, 880];
          const frequency = notesBell[Math.floor(Math.random() * notesBell.length)];
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
          osc.connect(gain).connect(master);
          osc.start();
          osc.stop(ctx.currentTime + 3.4);
        }, 11000);
      }
    } catch {
      toast("Sound isn't available in this browser");
    }
  });
}

/* ---------- Calendar ---------- */
const calendarEvents = {
  all: null,
  ganesh: {
    title: "Ganesh Puja — Mohit & Archana",
    start: "20270127T033000Z",
    end: "20270127T050000Z",
    location: "The Family Home, Mogri, Anand",
    description: "The Ganesh Puja opening the wedding celebrations. Dress in ivory and gold.",
  },
  haldi: {
    title: "Haldi Ceremony — Mohit & Archana",
    start: "20270127T050000Z",
    end: "20270127T070000Z",
    location: "The Family Home, Mogri, Anand",
    description: "A morning of turmeric and blessings. Dress in shades of yellow.",
  },
  mehndi: {
    title: "Mehndi Afternoon — Mohit & Archana",
    start: "20270127T093000Z",
    end: "20270127T133000Z",
    location: "The Family Home, Mogri, Anand",
    description: "Henna, chai and stories. Dress in greens and yellows.",
  },
  sangeet: {
    title: "Sangeet Soirée — Mohit & Archana",
    start: "20270127T140000Z",
    end: "20270127T182900Z",
    location: "The Family Lawn, Mogri, Anand",
    description: "Performances, dinner and dancing. Dress in jewel tones.",
  },
  baraat: {
    title: "The Baraat — Mohit & Archana",
    start: "20270128T040000Z",
    end: "20270128T053000Z",
    location: "Gayatri Mandir Road, Mogri, Anand",
    description: "The groom's procession. Dress in royal red and gold.",
  },
  wedding: {
    title: "Varmala & Pheras — Mohit & Archana",
    start: "20270128T080000Z",
    end: "20270128T120000Z",
    location: "Gayatri Mandir, Mogri, Anand",
    description: "The wedding ceremony and pheras. Please be seated by 1:15 PM IST.",
  },
};

function escapeIcs(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildIcs(keys) {
  const stamp = `${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mohit & Archana//Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ].join("\r\n");
  keys.forEach((key) => {
    const event = calendarEvents[key];
    if (!event) return;
    ics += [
      "\r\nBEGIN:VEVENT",
      `UID:mohit-archana-${key}@wedding-invite`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${event.start}`,
      `DTEND:${event.end}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `LOCATION:${escapeIcs(event.location)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  ics += "\r\nEND:VCALENDAR\r\n";
  return ics;
}

function downloadIcs(keys, filename) {
  const blob = new Blob([buildIcs(keys)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function initCalendar() {
  $$("[data-calendar]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.locked) return;
      const key = button.dataset.calendar;
      const all = key === "all";
      const keys = all ? ["ganesh", "haldi", "mehndi", "sangeet", "baraat", "wedding"] : [key];
      downloadIcs(keys, all ? "mohit-archana-wedding.ics" : `mohit-archana-${key}.ics`);
      const original = button.innerHTML;
      button.dataset.locked = "true";
      button.innerHTML = "<span>Added to calendar ✓</span>";
      toast(all ? "The whole week is in your calendar." : "Ceremony added to your calendar.");
      setTimeout(() => {
        button.innerHTML = original;
        delete button.dataset.locked;
      }, 2800);
    });
  });
}

/* ---------- Share / blessings / clock ---------- */
function initShare() {
  $$("[data-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const shareData = {
        title: "Mohit & Archana — 27–28 January 2027",
        text: "Join us in Mogri for two days of ceremony and one promise.",
        url: window.location.href,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          toast("Thank you for sharing the joy.");
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      const ok = await copyText(window.location.href);
      toast(ok ? "Invitation link copied." : "Copy the link from your address bar.");
    });
  });
}

function initBlessings() {
  $$("[data-bless]").forEach((button) => {
    button.addEventListener("click", () => {
      petalShower(58);
      toast("Marigolds for your blessings.");
    });
  });
}

function initClock() {
  const el = $("[data-clock]");
  if (!el) return;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const update = () => {
    el.textContent = formatter.format(new Date());
  };
  update();
  setInterval(update, 1000);
}

/* ---------- RSVP ---------- */
function initRsvp() {
  const form = $("[data-rsvp]");
  if (!form) return;
  const endpoint = "https://formsubmit.co/ajax/mohitpanaliya0@gmail.com";
  const honeypot = $('input[name="_honey"]', form);
  const card = $(".rsvp__card");
  const seg = $("[data-seg]");
  const attendanceInput = $('input[name="attendance"]');
  const guestsOutput = $("[data-guests]");
  const guestsInput = $('input[name="guests"]');
  const stepper = $("[data-stepper]");
  const chips = $$("[data-chips] .chip");
  const submitLabel = $("[data-submit-label]");
  const submit = $(".btn--submit");
  const success = $("[data-success]");
  const successName = $("[data-success-name]");
  const successCopy = $("[data-success-copy]");
  const successDetails = $("[data-success-details]");
  const nameInput = $("#rsvp-name");
  const emailInput = $("#rsvp-email");
  const noteInput = $("#rsvp-note");
  const declineGroups = $$("[data-decline-hide]");
  const key = "aa-rsvp-v1";

  const state = {
    attendance: "yes",
    guests: 1,
    events: new Set(chips.map((chip) => chip.dataset.event)),
  };

  const setTimelineLabel = () => {
    if (submitLabel) {
      submitLabel.textContent = state.attendance === "yes" ? "Seal the reply" : "Send my regrets";
    }
  };

  const setAttendance = (value, animate = true) => {
    state.attendance = value;
    if (seg) seg.dataset.choice = value;
    if (attendanceInput) attendanceInput.value = value;
    $$("[data-value]", seg).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    });
    declineGroups.forEach((group) => {
      if (value === "no") {
        if (animate) {
          group.style.overflow = "hidden";
          group.style.display = "block";
          gsap.to(group, {
            height: 0,
            opacity: 0,
            duration: 0.45,
            ease: "power2.inOut",
            onComplete: () => {
              group.style.display = "none";
            },
          });
        } else {
          group.style.display = "none";
        }
      } else if (animate) {
        group.style.display = "block";
        group.style.height = "auto";
        const height = group.offsetHeight;
        gsap.fromTo(
          group,
          { height: 0, opacity: 0 },
          {
            height,
            opacity: 1,
            duration: 0.5,
            ease: "power2.out",
            onComplete: () => {
              group.style.height = "";
              group.style.overflow = "";
            },
          }
        );
      } else {
        group.style.display = "block";
        group.style.height = "";
        group.style.opacity = "";
      }
    });
    setTimelineLabel();
  };

  const setGuests = (value) => {
    state.guests = Math.max(1, Math.min(6, value));
    if (guestsOutput) guestsOutput.textContent = String(state.guests);
    if (guestsInput) guestsInput.value = String(state.guests);
    $$("[data-step]", stepper).forEach((button) => {
      const step = Number(button.dataset.step);
      button.disabled = (step < 0 && state.guests <= 1) || (step > 0 && state.guests >= 6);
    });
    if (guestsOutput && !reduceMotion) {
      gsap.fromTo(
        guestsOutput,
        { y: 8, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.4, ease: "back.out(2)" }
      );
    }
  };

  $$("[data-value]", seg).forEach((button) => {
    button.addEventListener("click", () => setAttendance(button.dataset.value));
  });

  $$("[data-step]", stepper).forEach((button) => {
    button.addEventListener("click", () => setGuests(state.guests + Number(button.dataset.step)));
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const eventName = chip.dataset.event;
      const active = !chip.classList.contains("is-active");
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
      if (active) state.events.add(eventName);
      else state.events.delete(eventName);
      if (!reduceMotion) {
        gsap.fromTo(chip, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: "back.out(2.4)" });
      }
    });
  });

  setGuests(1);
  setAttendance("yes", false);

  const setDetails = (data) => {
    if (successName) successName.textContent = data.name.trim().split(/\s+/)[0] || "friend";
    if (successCopy) {
      successCopy.textContent =
        data.attendance === "yes"
          ? "We can't wait to celebrate with you in Mogri."
          : "We'll miss you — thank you for letting us know. We'll raise a glass to you from Mogri.";
    }
    if (successDetails) {
      successDetails.textContent = "";
      const lines = [];
      lines.push(data.attendance === "yes" ? "Joyfully accepts" : "Regretfully declines");
      if (data.attendance === "yes") {
        lines.push(`${data.guests} ${data.guests === 1 ? "guest" : "guests"}`);
        if (data.events.length === 6) lines.push("All six celebrations");
        else if (data.events.length > 0) lines.push(data.events.join(" · "));
        else lines.push("No ceremonies selected");
      }
      lines.forEach((line) => {
        const span = document.createElement("div");
        span.textContent = line;
        successDetails.appendChild(span);
      });
    }
  };

  const showSuccess = (data, silent = false) => {
    setDetails(data);
    card?.classList.add("is-complete");
    success?.setAttribute("aria-hidden", "false");
    if (!silent) {
      if (!reduceMotion) {
        const rect = card?.getBoundingClientRect();
        if (rect) petalsBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 34);
      }
      toast("Your reply is sealed. Thank you!");
    }
  };

  const readSaved = () => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.name) return null;
      return data;
    } catch {
      return null;
    }
  };

  const saved = readSaved();
  if (saved) {
    if (nameInput) nameInput.value = saved.name || "";
    if (emailInput) emailInput.value = saved.email || "";
    if (noteInput) noteInput.value = saved.note || "";
    state.guests = Number(saved.guests) || 1;
    setGuests(state.guests);
    state.events = new Set(Array.isArray(saved.events) ? saved.events : []);
    chips.forEach((chip) => {
      const active = state.events.has(chip.dataset.event);
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    setAttendance(saved.attendance === "no" ? "no" : "yes", false);
    showSuccess(
      {
        name: saved.name,
        attendance: saved.attendance === "no" ? "no" : "yes",
        guests: state.guests,
        events: [...state.events],
      },
      true
    );
  }

  $("[data-edit]")?.addEventListener("click", () => {
    card?.classList.remove("is-complete");
    success?.setAttribute("aria-hidden", "true");
    nameInput?.focus();
  });

  const sendByEmail = async (data) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `RSVP — ${data.name}${data.attendance === "yes" ? " · accepts" : " · regrets"}`,
        _template: "table",
        _captcha: "false",
        _replyto: data.email,
        _honey: honeypot?.value || "",
        name: data.name,
        email: data.email,
        attendance: data.attendance === "yes" ? "Joyfully accepts" : "Regretfully declines",
        guests: data.attendance === "yes" ? data.guests : 0,
        events: data.events.length ? data.events.join(", ") : "—",
        note: data.note || "—",
      }),
    });
    if (!response.ok) throw new Error(`RSVP email failed (${response.status})`);
    const result = await response.json().catch(() => ({}));
    if (result.success === "false" || result.success === false) {
      throw new Error(result.message || "RSVP email was not accepted");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    if (!name || !email) {
      form.reportValidity();
      card?.classList.add("is-shaking");
      setTimeout(() => card?.classList.remove("is-shaking"), 500);
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = {
      name,
      email,
      attendance: state.attendance,
      guests: state.guests,
      events: [...state.events],
      note: noteInput?.value.trim() || "",
    };

    submit?.classList.add("is-loading");
    if (submit) submit.disabled = true;
    if (submitLabel) submitLabel.textContent = "Sealing the reply…";

    try {
      await sendByEmail(data);
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* private browsing */
      }
      showSuccess(data);
    } catch (error) {
      console.error(error);
      toast("We couldn't send your reply. Please check your connection and try again.");
    } finally {
      submit?.classList.remove("is-loading");
      if (submit) submit.disabled = false;
      setTimelineLabel();
    }
  });
}

/* ---------- Boot ---------- */
const safeInit = (fn) => {
  try {
    fn();
  } catch (error) {
    console.error(`Init failed: ${fn.name}`, error);
  }
};

[
  initCursor,
  initMagnetic,
  initTilt,
  initNav,
  initMenu,
  initAnchors,
  initScrollProgress,
  initHeroScroll,
  initHeroSpot,
  initMarquee,
  initLocation,
  initReveals,
  initTicker,
  initCountdown,
  initStory,
  initEvents,
  initEnvelope,
  initGallery,
  initFaq,
  initSound,
  initCalendar,
  initShare,
  initBlessings,
  initClock,
  initRsvp,
].forEach(safeInit);

window.addEventListener("load", () => ScrollTrigger.refresh());
if (document.fonts?.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
