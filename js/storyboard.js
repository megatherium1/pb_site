/* =============================================================
   ProjBox — How It Works interactive storyboard
   Data-driven scene machine over the real product screenshots.
   No dependencies, no build step. Loaded only by how-it-works.html.

   Camera model
   ------------
   Every screenshot sits in a frame sized to `base` — its un-zoomed
   display scale — and is moved with translate + scale. `base` is a
   cover fit clamped by a per-asset sharpness ceiling, because the
   Explorer captures are only ~300px tall and a true cover fit would
   upscale them 1.5-1.9x into mush. When the ceiling binds, the axis
   with slack is centred and the scene renders as a framed window.

   Overlays live inside the frame and are positioned in fractions of
   the image, so they stay registered to the screenshot content at
   any viewport size. They counter-scale via --pb-sb-inv so text and
   stroke weights keep a constant on-screen size.
   ============================================================= */

(function () {
  "use strict";

  var root = document.querySelector("[data-storyboard]");
  if (!root) return;

  var viewport = root.querySelector("[data-storyboard-viewport]");
  var captionEl = root.querySelector("[data-storyboard-caption]");
  var statusEl = root.querySelector("[data-storyboard-status]");
  var loadingEl = root.querySelector("[data-storyboard-loading]");
  var liveEl = root.querySelector("[data-storyboard-live]");
  var replayBtn = root.querySelector("[data-storyboard-replay]");
  var prevBtn = root.querySelector("[data-storyboard-prev]");
  var nextBtn = root.querySelector("[data-storyboard-next]");
  var stepBtns = [].slice.call(root.querySelectorAll("[data-step]"));
  var mobileCur = root.querySelector("[data-storyboard-step-current]");
  var mobileLabel = root.querySelector("[data-storyboard-step-label]");

  if (!viewport) return;

  var ASSET_DIR = "storyboard_assets/";
  var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  var CROSSFADE = 580;
  var SPEED = 1.3; /* global pacing multiplier — scales later() + camera transitions */

  /* -----------------------------------------------------------
     1. Assets
     baseMax      cap on the un-zoomed display scale
     maxEffective cap on scale after scene zoom (sharpness ceiling)
     ----------------------------------------------------------- */
  var ASSETS = {
    "1": { file: "1.png", w: 1374, h: 357, baseMax: 1.0, maxEffective: 1.18 },
    "2": { file: "2.png", w: 2934, h: 1561, baseMax: 1.0, maxEffective: 1.0 },
    "3": { file: "3.png", w: 1359, h: 356, baseMax: 1.0, maxEffective: 1.18 },
    "4": { file: "4.png", w: 977, h: 285, baseMax: 1.0, maxEffective: 1.18 },
    "5": { file: "5.png", w: 995, h: 640, baseMax: 1.0, maxEffective: 1.25 },
    "6": { file: "6.png", w: 1359, h: 332, baseMax: 1.0, maxEffective: 1.18 },
    "7": { file: "7.png", w: 1254, h: 1254, baseMax: 1.0, maxEffective: 1.2 },
    "8": { file: "8_new.png", w: 1202, h: 1308, baseMax: 1.0, maxEffective: 1.2 }
  };

  var LOAD_STAGES = [["1", "2"], ["3", "4", "5", "6"], ["7", "8"]];

  /* -----------------------------------------------------------
     2. Scenes
     Five conceptual steps; each holds one or more internal scenes.
     Coordinates are fractions of the image. `m` / `mCams` hold the
     mobile variant of a value.
     ----------------------------------------------------------- */
  var STEPS = [
    {
      label: "Choose your folder",
      rmScene: 0,
      scenes: [
        {
          asset: "1",
          dur: 2750,
          cams: [
            { at: 0, z: 1.0, fx: 0.3, fy: 0.52, dur: 0 },
            { at: 100, z: 1.06, fx: 0.32, fy: 0.52, dur: 2500 }
          ],
          mCams: [
            { at: 0, z: 1.4, fx: 0.13, fy: 0.5, dur: 0 },
            { at: 100, z: 1.48, fx: 0.15, fy: 0.5, dur: 2500 }
          ],
          captions: [{ at: 188, text: "Start with the folder you already use.", typeOn: true }],
          rings: [
            { at: 500, x: 0.080, y: 0.528, w: 0.118, h: 0.078, tone: "new" },
            { at: 938, x: 0.081, y: 0.611, w: 0.076, h: 0.078, tone: "new" },
            { at: 1375, x: 0.081, y: 0.700, w: 0.132, h: 0.078, tone: "new" }
          ],
          callouts: [
            { n: 1, at: 500, x: 0.218, y: 0.540, anchor: "left", text: "File 1", size: "sm", m: { hide: true } },
            { n: 2, at: 938, x: 0.218, y: 0.650, anchor: "left", text: "File 2", size: "sm", m: { hide: true } },
            { n: 3, at: 1375, x: 0.218, y: 0.765, anchor: "left", text: "File 3", size: "sm", m: { hide: true } }
          ],
          desc: "Windows Explorer showing the my_Project folder with AAPL_prices.csv, notes.txt and vendor_report.pdf."
        },
        {
          asset: "2",
          dur: 2250,
          /* 2.png is 2934px wide, so framing the sidebar alone is what keeps
             the project name at native sharpness. The Run First Snapshot
             button is deliberately left off-frame for step 2 to reveal. */
          cams: [{ at: 0, z: 3.2, fx: 0.1, fy: 0.18, dur: 875 }],
          mCams: [{ at: 0, z: 4.5, fx: 0.08, fy: 0.155, dur: 875 }],
          captions: [{ at: 250, text: "The same folder, now selected in ProjBox." }],
          rings: [{ at: 375, x: 0.006, y: 0.132, w: 0.058, h: 0.045, tone: "glow" }],
          desc: "ProjBox with my_project selected in the project sidebar and no snapshots yet."
        }
      ]
    },

    {
      label: "Run Snapshot",
      rmScene: 2,
      scenes: [
        {
          asset: "2",
          dur: 3200,
          /* z=1.0 cover-framed establishing view, ~2s real hold (raw 1540 / SPEED),
             then zoom to button; ring after arrival, ripple after ring. */
          cams: [
            { at: 0, z: 1.0, fx: 0.50, fy: 0.55, dur: 900, entryDur: 900 },
            { at: 1540, z: 2.6, fx: 0.624, fy: 0.741, dur: 1000 }
          ],
          mCams: [
            { at: 0, z: 1.0, fx: 0.50, fy: 0.55, dur: 900, entryDur: 900 },
            { at: 1540, z: 3.6, fx: 0.624, fy: 0.741, dur: 1000 }
          ],
          captions: [{ at: 300, text: "Save your first version." }],
          rings: [{ at: 2600, x: 0.554, y: 0.712, w: 0.141, h: 0.058, tone: "glow" }],
          ripples: [{ at: 2900, x: 0.624, y: 0.741 }],
          desc: "The Run First Snapshot button is pressed in ProjBox."
        },
        {
          asset: "1",
          dur: 700,
          cams: [{ at: 0, z: 1.1, fx: 0.26, fy: 0.55, dur: 0 }],
          mCams: [{ at: 0, z: 1.4, fx: 0.14, fy: 0.52, dur: 0 }],
          captions: [{ at: 0, text: "ProjBox creates _ProjBox_History automatically." }],
          desc: "The project folder as it was before ProjBox history existed."
        },
        {
          asset: "3",
          dur: 1400,
          cams: [{ at: 0, z: 1.1, fx: 0.26, fy: 0.55, dur: 0 }],
          mCams: [{ at: 0, z: 1.4, fx: 0.14, fy: 0.52, dur: 0 }],
          captions: [{ at: 0, text: "ProjBox creates _ProjBox_History automatically." }],
          rings: [{ at: 250, x: 0.075, y: 0.51, w: 0.148, h: 0.092, tone: "new" }],
          desc: "The same folder now also contains a new _ProjBox_History folder."
        },
        {
          asset: "4",
          dur: 3040,
          cams: [{ at: 0, z: 1.12, fx: 0.3, fy: 0.68, dur: 600 }],
          mCams: [{ at: 0, z: 1.25, fx: 0.285, fy: 0.75, dur: 600 }],
          captions: [{ at: 100, text: "Your saved versions live right inside your project folder." }],
          rings: [
            { at: 200, x: 0.132, y: 0.66, w: 0.345, h: 0.1, tone: "new" },
            { at: 700, x: 0.132, y: 0.776, w: 0.098, h: 0.1, tone: "soft" }
          ],
          desc: "Inside _ProjBox_History: the folder snapshot_0001_2026-08-16_16-24-55 and latest.txt."
        }
      ]
    },

    {
      label: "Keep working",
      rmScene: 0,
      scenes: [
        {
          asset: "5",
          dur: 3750,
          cams: [
            { at: 0, z: 1.05, fx: 0.45, fy: 0.3, dur: 0 },
            { at: 125, z: 1.15, fx: 0.45, fy: 0.32, dur: 3250 }
          ],
          mCams: [
            { at: 0, z: 2.0, fx: 0.28, fy: 0.18, dur: 0 },
            { at: 1750, z: 2.0, fx: 0.62, fy: 0.22, dur: 1125 }
          ],
          captions: [
            { at: 0, text: "We keep working normally." },
            { at: 3000, text: "Four edits in AAPL_prices.csv." }
          ],
          rings: [
            { at: 500, x: 0.147, y: 0.055, w: 0.1, h: 0.93, tone: "new" },
            { at: 1188, x: 0.243, y: 0.055, w: 0.148, h: 0.93, tone: "new" },
            { at: 1875, x: 0.465, y: 0.272, w: 0.122, h: 0.04, tone: "glow", m: { at: 2500 } },
            { at: 2563, x: 0.677, y: 0.055, w: 0.139, h: 0.93, tone: "new", m: { at: 3063 } }
          ],
          callouts: [
            { n: 1, at: 500, x: 0.197, y: 0.205, text: "Close \u00d7 0.25" },
            { n: 2, at: 1188, x: 0.317, y: 0.345, text: "Volume \u00d7 0.25" },
            {
              n: 3,
              at: 1875,
              x: 0.487,
              y: 0.47,
              text: "Market_Cap outlier",
              m: { at: 2500, x: 0.52, y: 0.42, text: "Outlier" }
            },
            {
              n: 4,
              at: 2563,
              x: 0.715,
              y: 0.14,
              anchor: "left",
              text: "New_Column added",
              m: { at: 3063, x: 0.66, y: 0.14, anchor: "left", text: "New_Column" }
            }
          ],
          desc: "The AAPL spreadsheet after four edits: Close divided by four, Volume divided by four, one Market_Cap outlier, and a new column named New_Column."
        },
        {
          asset: "6",
          dur: 3000,
          cams: [
            { at: 0, z: 1.1, fx: 0.2, fy: 0.58, dur: 750 },
            { at: 1438, z: 1.18, fx: 0.26, fy: 0.66, dur: 1000 }
          ],
          mCams: [
            { at: 0, z: 1.3, fx: 0.17, fy: 0.62, dur: 750 },
            { at: 1438, z: 1.35, fx: 0.175, fy: 0.72, dur: 1000 }
          ],
          captions: [{ at: 0, text: "One note updated. One file renamed." }],
          rings: [
            { at: 313, x: 0.082, y: 0.752, w: 0.155, h: 0.088, tone: "new" },
            { at: 1688, x: 0.082, y: 0.848, w: 0.21, h: 0.088, tone: "new" }
          ],
          /* The mobile frame is only wide enough for the Name column, so the
             pills are dropped rather than parked over the filenames they
             describe. The rings and the caption carry the same information. */
          callouts: [
            {
              n: 5,
              at: 313,
              x: 0.25,
              y: 0.796,
              anchor: "left",
              text: "We update notes.txt",
              m: { hide: true }
            },
            {
              n: 6,
              at: 1688,
              x: 0.3,
              y: 0.892,
              anchor: "left",
              text: "We rename vendor_report.pdf",
              m: { hide: true }
            }
          ],
          desc: "The project folder after normal work: notes.txt updated and vendor_report.pdf renamed to vendor_report_RENAMED.pdf."
        }
      ]
    },

    {
      label: "Run Snapshot again",
      rmScene: 0,
      scenes: [
        {
          asset: "2",
          dur: 2200,
          cams: [{ at: 0, z: 3.1, fx: 0.753, fy: 0.06, dur: 900 }],
          mCams: [{ at: 0, z: 3.4, fx: 0.753, fy: 0.055, dur: 900 }],
          captions: [{ at: 100, text: "Now we run Snapshot again." }],
          rings: [{ at: 300, x: 0.706, y: 0.043, w: 0.096, h: 0.05, tone: "glow" }],
          ripples: [{ at: 950, x: 0.753, y: 0.067 }],
          statuses: [{ at: 1350, text: "Saving Snapshot #2\u2026", dur: 750 }],
          desc: "The Run Snapshot button in the ProjBox toolbar is pressed to save snapshot number two."
        }
      ]
    },

    {
      label: "Explore what changed",
      rmScene: 1,
      scenes: [
        {
          asset: "7",
          dur: 5800,
          /* Overview (fy≈0.42 crops toolbar typo) → interpret modified/renamed
             → register → move to Open Diff Viewer → click → crossfade. */
          cams: [
            { at: 0, z: 1.0, fx: 0.50, fy: 0.42, dur: 0 },
            { at: 1540, z: 1.5, fx: 0.45, fy: 0.70, dur: 1200 },
            { at: 3750, z: 1.55, fx: 0.38, fy: 0.78, dur: 1000 }
          ],
          mCams: [
            { at: 0, z: 1.5, fx: 0.515, fy: 0.42, dur: 0 },
            { at: 1540, z: 2.2, fx: 0.42, fy: 0.70, dur: 1200 },
            { at: 3750, z: 2.4, fx: 0.36, fy: 0.78, dur: 1000 }
          ],
          captions: [
            { at: 200, text: "ProjBox catches all of it." },
            { at: 3300, text: "Two modified files. One renamed file." }
          ],
          rings: [
            { at: 500, x: 0.227, y: 0.356, w: 0.140, h: 0.104, tone: "new" },
            { at: 950, x: 0.660, y: 0.356, w: 0.141, h: 0.104, tone: "new" },
            { at: 2900, x: 0.226, y: 0.355, w: 0.143, h: 0.106, tone: "new" },
            { at: 3400, x: 0.208, y: 0.528, w: 0.52, h: 0.088, tone: "new" },
            { at: 4900, x: 0.256, y: 0.774, w: 0.136, h: 0.042, tone: "glow" }
          ],
          ripples: [{ at: 5300, x: 0.324, y: 0.794 }],
          desc: "The ProjBox Snapshot Summary for snapshot two: two modified files, one renamed file, and detected changes in AAPL_prices.csv including Close and Volume multiplied by 0.25, one Market_Cap outlier and one added column."
        },
        {
          asset: "8",
          dur: 4000,
          cams: [
            { at: 0, z: 1.12, fx: 0.52, fy: 0.17, dur: 0 },
            { at: 1000, z: 1.08, fx: 0.48, fy: 0.40, dur: 900 },
            { at: 2600, z: 1.22, fx: 0.42, fy: 0.88, dur: 1000 }
          ],
          mCams: [
            { at: 0, z: 1.8, fx: 0.58, fy: 0.17, dur: 0 },
            { at: 1000, z: 1.7, fx: 0.38, fy: 0.42, dur: 900 },
            { at: 2600, z: 2.0, fx: 0.42, fy: 0.88, dur: 1000 }
          ],
          captions: [
            { at: 200, text: "ProjBox opens the file-level diff." },
            { at: 1800, text: "It detects the exact pattern: \u00d7 0.25." },
            { at: 3100, text: "See exactly what changed, not just which files changed." }
          ],
          rings: [
            { at: 300, x: 0.848, y: 0.150, w: 0.126, h: 0.086, dur: 900, tone: "glow", m: { hide: true } },
            { at: 1900, x: 0.224, y: 0.419, w: 0.267, h: 0.092, tone: "new" },
            { at: 3200, x: 0.600, y: 0.924, w: 0.155, h: 0.016, tone: "new" }
          ],
          desc: "The ProjBox Diff Viewer for AAPL_prices.csv comparing snapshot one to snapshot two: 67 rows modified, one column added, and an exact pattern detected of all comparable numeric values multiplied by 0.25."
        }
      ]
    }
  ];

  /* -----------------------------------------------------------
     3. Environment helpers
     ----------------------------------------------------------- */
  var mqReduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 899px)") : null;

  function reduced() { return !!(mqReduced && mqReduced.matches); }
  function isMobile() { return !!(mqMobile && mqMobile.matches); }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* Pick the mobile variant of a field when one exists. */
  function pick(item, key, fallback) {
    if (isMobile() && item.m && item.m[key] !== undefined) return item.m[key];
    return item[key] !== undefined ? item[key] : fallback;
  }

  function cams(scene) {
    return (isMobile() && scene.mCams) ? scene.mCams : scene.cams;
  }

  /* -----------------------------------------------------------
     4. Generation token — the single guard against stale work.
     Bumping the token turns every queued callback into a no-op,
     so an old delayed transition can never fire after the user
     (or a visibility change) has moved elsewhere.
     ----------------------------------------------------------- */
  var runToken = 0;
  var timers = [];

  function cancelAll() {
    runToken++;
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }

  function later(fn, ms) {
    var token = runToken;
    timers.push(setTimeout(function () {
      if (token !== runToken) return;
      fn();
    }, Math.max(0, ms * SPEED)));
  }

  /* -----------------------------------------------------------
     5. Layers — one per asset, built once, stacked in the viewport
     ----------------------------------------------------------- */
  var layers = {};
  var activeLayer = null;

  function buildLayers() {
    Object.keys(ASSETS).forEach(function (key) {
      var asset = ASSETS[key];

      var el = document.createElement("div");
      el.className = "pb-sb-scene";
      el.setAttribute("aria-hidden", "true");

      var frame = document.createElement("div");
      frame.className = "pb-sb-frame";

      var img = document.createElement("img");
      img.className = "pb-sb-img";
      img.alt = "";
      img.decoding = "async";
      img.width = asset.w;
      img.height = asset.h;

      var overlay = document.createElement("div");
      overlay.className = "pb-sb-overlay";

      frame.appendChild(img);
      frame.appendChild(overlay);
      el.appendChild(frame);
      viewport.insertBefore(el, viewport.firstChild);

      layers[key] = { key: key, asset: asset, el: el, frame: frame, img: img, overlay: overlay };
    });
  }

  /* -----------------------------------------------------------
     6. Preloading
     ----------------------------------------------------------- */
  var loaders = {};

  function loadAsset(key) {
    if (loaders[key]) return loaders[key];
    var layer = layers[key];
    loaders[key] = new Promise(function (resolve) {
      var img = layer.img;
      if (!img.getAttribute("src")) img.src = ASSET_DIR + layer.asset.file;
      if (img.complete && img.naturalWidth) { resolve(); return; }
      img.addEventListener("load", function () { resolve(); }, { once: true });
      img.addEventListener("error", function () { resolve(); }, { once: true });
    }).then(function () {
      if (layer.img.decode) return layer.img.decode().catch(function () {});
    });
    return loaders[key];
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* Never let one slow asset stall the story. */
  function ensureAsset(key) {
    return Promise.race([loadAsset(key), delay(1500)]);
  }

  function preloadRemaining() {
    var chain = Promise.resolve();
    LOAD_STAGES.slice(1).forEach(function (stage) {
      chain = chain.then(function () {
        return Promise.all(stage.map(loadAsset));
      });
    });
    return chain;
  }

  /* -----------------------------------------------------------
     7. Camera
     ----------------------------------------------------------- */
  function measure(layer, cam) {
    var Wv = viewport.clientWidth;
    var Hv = viewport.clientHeight;
    var a = layer.asset;

    var cover = Math.max(Wv / a.w, Hv / a.h);
    var base = Math.min(cover, a.baseMax);
    var eff = Math.min(base * (cam.z || 1), a.maxEffective);
    var zRel = base > 0 ? eff / base : 1;

    var baseW = a.w * base;
    var baseH = a.h * base;
    var frameW = baseW * zRel;
    var frameH = baseH * zRel;

    var fx = cam.fx === undefined ? 0.5 : cam.fx;
    var fy = cam.fy === undefined ? 0.5 : cam.fy;

    var tx = frameW >= Wv
      ? clamp(Wv / 2 - fx * frameW, Wv - frameW, 0)
      : (Wv - frameW) / 2;
    var ty = frameH >= Hv
      ? clamp(Hv / 2 - fy * frameH, Hv - frameH, 0)
      : (Hv - frameH) / 2;

    return {
      baseW: baseW,
      baseH: baseH,
      zRel: zRel,
      tx: tx,
      ty: ty,
      /* Visible slice of the image, in image fractions. */
      x0: -tx / frameW,
      x1: (Wv - tx) / frameW,
      y0: -ty / frameH,
      y1: (Hv - ty) / frameH,
      matted: (frameW < Wv - 0.5) || (frameH < Hv - 0.5)
    };
  }

  /* A still frame must not reveal an overlay that sits outside it. Rings are
     allowed to run off the edge — column bands are drawn that way on purpose. */
  function ringInView(view, ring) {
    var x = pick(ring, "x", 0), w = pick(ring, "w", 0);
    var y = pick(ring, "y", 0), h = pick(ring, "h", 0);
    var ox = Math.max(0, Math.min(x + w, view.x1) - Math.max(x, view.x0));
    var oy = Math.max(0, Math.min(y + h, view.y1) - Math.max(y, view.y0));
    return (w ? ox / w : 1) >= 0.6 && (h ? oy / h : 1) >= 0.3;
  }

  function pointInView(view, item) {
    var x = pick(item, "x", 0.5), y = pick(item, "y", 0.5);
    return x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;
  }

  function applyCam(layer, cam, dur) {
    var m = measure(layer, cam);

    layer.frame.style.width = m.baseW.toFixed(2) + "px";
    layer.frame.style.height = m.baseH.toFixed(2) + "px";
    layer.frame.style.setProperty("--pb-sb-inv", (1 / m.zRel).toFixed(4));
    layer.el.classList.toggle("is-matted", m.matted);

    var transform = "translate3d(" + m.tx.toFixed(2) + "px," + m.ty.toFixed(2) +
      "px,0) scale(" + m.zRel.toFixed(4) + ")";

    if (!dur || reduced()) {
      layer.frame.style.transition = "none";
      layer.frame.style.transform = transform;
      void layer.frame.offsetWidth; /* flush so later transitions animate */
    } else {
      layer.frame.style.transition = "transform " + Math.round(dur * SPEED) + "ms " + EASE;
      layer.frame.style.transform = transform;
    }

    layer.cam = cam;
  }

  /* -----------------------------------------------------------
     8. Overlay construction
     ----------------------------------------------------------- */
  function buildOverlay(layer, scene) {
    var overlay = layer.overlay;
    overlay.textContent = "";

    var built = { rings: [], callouts: [], ripples: [] };

    (scene.rings || []).forEach(function (ring) {
      if (pick(ring, "hide", false)) { built.rings.push(null); return; }
      var el = document.createElement("div");
      el.className = "pb-storyboard__ring pb-storyboard__ring--" + (pick(ring, "tone", "new"));
      el.style.left = (pick(ring, "x", 0) * 100) + "%";
      el.style.top = (pick(ring, "y", 0) * 100) + "%";
      el.style.width = (pick(ring, "w", 0.1) * 100) + "%";
      el.style.height = (pick(ring, "h", 0.1) * 100) + "%";
      overlay.appendChild(el);
      built.rings.push(el);
    });

    (scene.callouts || []).forEach(function (callout) {
      if (pick(callout, "hide", false)) { built.callouts.push(null); return; }
      var el = document.createElement("div");
      var anchor = pick(callout, "anchor", "center");
      el.className = "pb-storyboard__callout pb-storyboard__callout--" + anchor;
      if (pick(callout, "size", "") === "sm") el.classList.add("pb-storyboard__callout--sm");
      el.style.left = (pick(callout, "x", 0.5) * 100) + "%";
      el.style.top = (pick(callout, "y", 0.5) * 100) + "%";

      var inner = document.createElement("span");
      inner.className = "pb-storyboard__callout-inner";

      var num = document.createElement("span");
      num.className = "pb-storyboard__callout-num";
      num.textContent = String(callout.n);

      var text = document.createElement("span");
      text.className = "pb-storyboard__callout-text";
      text.textContent = pick(callout, "text", "");

      inner.appendChild(num);
      inner.appendChild(text);
      el.appendChild(inner);
      overlay.appendChild(el);
      built.callouts.push(el);
    });

    (scene.ripples || []).forEach(function (ripple) {
      var el = document.createElement("span");
      el.className = "pb-storyboard__ripple";
      el.style.left = (pick(ripple, "x", 0.5) * 100) + "%";
      el.style.top = (pick(ripple, "y", 0.5) * 100) + "%";
      overlay.appendChild(el);
      built.ripples.push(el);
    });

    return built;
  }

  /* -----------------------------------------------------------
     9. Caption / status
     ----------------------------------------------------------- */
  function typeText(el, text) {
    var token = runToken;
    var i = 0;
    function step() {
      if (token !== runToken) return;
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) timers.push(setTimeout(step, 16));
    }
    step();
  }

  function setCaption(text, typeOn) {
    if (!captionEl) return;
    if (!text) {
      captionEl.classList.remove("is-in");
      captionEl.textContent = "";
      return;
    }
    captionEl.classList.remove("is-in");
    void captionEl.offsetWidth;
    if (typeOn && !reduced()) {
      captionEl.textContent = "";
      typeText(captionEl, text);
    } else {
      captionEl.textContent = text;
    }
    captionEl.classList.add("is-in");
  }

  function setStatus(text) {
    if (!statusEl) return;
    if (!text) {
      statusEl.classList.remove("is-in");
      return;
    }
    statusEl.textContent = text;
    statusEl.classList.add("is-in");
  }

  /* -----------------------------------------------------------
     10. Step chrome
     ----------------------------------------------------------- */
  function setActiveStep(index) {
    stepBtns.forEach(function (btn, i) {
      var on = i === index;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });

    if (mobileCur) mobileCur.textContent = String(index + 1);
    if (mobileLabel) mobileLabel.textContent = STEPS[index].label;
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === STEPS.length - 1;
  }

  function representative(step) {
    var index = step.rmScene === undefined ? step.scenes.length - 1 : step.rmScene;
    return step.scenes[index];
  }

  var announcedStep = -1;

  /* One announcement per step, not per internal scene: eleven live-region
     updates across a 24-second autoplay would be unusable. */
  function announce(index) {
    if (!liveEl || index === announcedStep) return;
    announcedStep = index;
    var step = STEPS[index];
    liveEl.textContent = "Step " + (index + 1) + " of " + STEPS.length + ": " +
      step.label + ". " + (representative(step).desc || "");
  }

  function showReplay(show) {
    if (!replayBtn) return;
    if (reduced()) { replayBtn.hidden = true; return; }
    replayBtn.hidden = !show;
  }

  /* -----------------------------------------------------------
     11. Scene playback
     ----------------------------------------------------------- */
  var current = { step: 0, scene: 0, mode: "static" };
  var playing = false;
  var suspended = false;
  var started = false;

  function activateLayer(layer, scene, opts) {
    opts = opts || {};
    var previous = activeLayer;
    var first = cams(scene)[0];

    if (previous && previous !== layer) {
      applyCam(layer, first, 0);
      /* Layers sit in a fixed DOM order, so the crossfade has to say
         explicitly which of the two is on top. */
      previous.el.style.zIndex = "1";
      layer.el.style.zIndex = "2";
      layer.el.classList.add("is-active");
      previous.el.classList.remove("is-active");
    } else if (!previous) {
      applyCam(layer, first, 0);
      layer.el.classList.add("is-active");
    } else {
      /* Same screenshot: ease from the previous framing instead of cutting.
         Step 1→2 autoplay passes continuity so the sidebar crop eases out
         to the z=1.0 establishing view before the scene clock runs. */
      var entryDur = opts.continuity ? (first.entryDur || first.dur || 900) : 0;
      applyCam(layer, first, entryDur);
    }

    activeLayer = layer;
  }

  function play(stepIndex, sceneIndex, mode, opts) {
    opts = opts || {};
    var step = STEPS[stepIndex];
    if (!step) return;
    var scene = step.scenes[sceneIndex];
    if (!scene) return;

    current = { step: stepIndex, scene: sceneIndex, mode: mode };
    playing = mode !== "static";

    /* Retire the outgoing scene's queued work before scheduling this one,
       so nothing from the previous scene can still fire against this frame. */
    cancelAll();
    var token = runToken;

    setActiveStep(stepIndex);
    announce(stepIndex);

    ensureAsset(scene.asset).then(function () {
      if (token !== runToken) return;

      if (loadingEl) loadingEl.hidden = true;

      var layer = layers[scene.asset];
      var built = buildOverlay(layer, scene);
      activateLayer(layer, scene, opts);
      setStatus("");

      var sceneCams = cams(scene);
      var still = reduced() || mode === "static";

      /* Camera keyframes after the first */
      for (var i = 1; i < sceneCams.length; i++) {
        (function (cam) {
          if (still) {
            applyCam(layer, cam, 0);
          } else {
            later(function () { applyCam(layer, cam, cam.dur || 800); }, cam.at || 0);
          }
        })(sceneCams[i]);
      }

      var view = still ? measure(layer, sceneCams[sceneCams.length - 1]) : null;

      /* Captions */
      var captions = scene.captions || [];
      if (still) {
        var last = captions[captions.length - 1];
        setCaption(last ? last.text : "", false);
      } else {
        captions.forEach(function (caption) {
          later(function () { setCaption(caption.text, caption.typeOn); }, caption.at || 0);
        });
      }

      /* Rings */
      (scene.rings || []).forEach(function (ring, index) {
        var el = built.rings[index];
        if (!el) return;
        if (still) {
          if (ringInView(view, ring)) el.classList.add("is-in");
          return;
        }
        var at = pick(ring, "at", 0);
        later(function () { el.classList.add("is-in"); }, at);
        var life = pick(ring, "dur", 0);
        if (life) later(function () { el.classList.remove("is-in"); }, at + life);
      });

      /* Callouts */
      (scene.callouts || []).forEach(function (callout, index) {
        var el = built.callouts[index];
        if (!el) return;
        if (still) {
          if (pointInView(view, callout)) el.classList.add("is-in");
          return;
        }
        later(function () { el.classList.add("is-in"); }, pick(callout, "at", 0));
      });

      /* Ripples */
      if (!still) {
        (scene.ripples || []).forEach(function (ripple, index) {
          var el = built.ripples[index];
          if (!el) return;
          later(function () {
            el.classList.remove("is-on");
            void el.offsetWidth;
            el.classList.add("is-on");
          }, pick(ripple, "at", 0));
        });
      }

      /* Status chips */
      if (!still) {
        (scene.statuses || []).forEach(function (status) {
          later(function () { setStatus(status.text); }, status.at || 0);
          later(function () { setStatus(""); }, (status.at || 0) + (status.dur || 700));
        });
      }

      if (!still) later(advance, scene.dur || 2000);
    });
  }

  function advance() {
    var stepIndex = current.step;
    var sceneIndex = current.scene;
    var mode = current.mode;
    var step = STEPS[stepIndex];

    if (sceneIndex + 1 < step.scenes.length) {
      play(stepIndex, sceneIndex + 1, mode);
      return;
    }
    if (mode === "auto" && stepIndex + 1 < STEPS.length) {
      var nextStep = stepIndex + 1;
      var lastScene = step.scenes[sceneIndex];
      /* Step 1 ends on a tight 2.png sidebar crop; Step 2 opens wide on the
         same asset — ease out instead of snapping backward. */
      var continuity = (stepIndex === 0 && sceneIndex === step.scenes.length - 1 &&
        lastScene.asset === "2" && STEPS[nextStep].scenes[0].asset === "2");
      play(nextStep, 0, "auto", { continuity: continuity });
      return;
    }
    finish();
  }

  function finish() {
    playing = false;
    showReplay(true);
  }

  /* Static representative frame for a step (reduced motion, or the
     resting frame before autoplay begins). */
  function renderStatic(stepIndex) {
    var step = STEPS[stepIndex];
    var index = step.rmScene === undefined ? step.scenes.length - 1 : step.rmScene;
    play(stepIndex, index, "static");
  }

  /* -----------------------------------------------------------
     12. Navigation
     ----------------------------------------------------------- */
  function gotoStep(index, viaUser) {
    index = clamp(index, 0, STEPS.length - 1);
    setStatus("");

    if (reduced()) {
      renderStatic(index);
      return;
    }

    if (viaUser) showReplay(true);
    play(index, 0, "step");
  }

  function replay() {
    setStatus("");
    showReplay(false);
    announcedStep = -1;
    if (reduced()) { renderStatic(0); return; }
    play(0, 0, "auto");
  }

  stepBtns.forEach(function (btn, index) {
    btn.disabled = false;
    btn.removeAttribute("tabindex");
    btn.addEventListener("click", function () { gotoStep(index, true); });
  });

  if (prevBtn) {
    prevBtn.removeAttribute("tabindex");
    prevBtn.addEventListener("click", function () { gotoStep(current.step - 1, true); });
  }
  if (nextBtn) {
    nextBtn.removeAttribute("tabindex");
    nextBtn.disabled = false;
    nextBtn.addEventListener("click", function () { gotoStep(current.step + 1, true); });
  }
  if (replayBtn) replayBtn.addEventListener("click", replay);

  /* -----------------------------------------------------------
     13. Visibility — autoplay once, suspend offscreen
     ----------------------------------------------------------- */
  function suspend() {
    if (!playing || suspended) return;
    suspended = true;
    cancelAll(); /* stale timers can no longer fire */
  }

  function resume() {
    if (!suspended) return;
    suspended = false;
    /* Never restart at step 1 — resume the current internal scene. */
    play(current.step, current.scene, current.mode);
  }

  function observeVisibility() {
    if (!("IntersectionObserver" in window)) {
      if (!started) { started = true; play(0, 0, "auto"); }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var ratio = entry.intersectionRatio;
        if (ratio >= 0.4) {
          if (!started) {
            started = true;
            play(0, 0, "auto");
          } else if (suspended) {
            resume();
          }
        } else if (ratio < 0.2) {
          suspend();
        }
      });
    }, { threshold: [0, 0.2, 0.4, 0.75] });

    observer.observe(root);
  }

  /* -----------------------------------------------------------
     14. Resize / preference changes
     ----------------------------------------------------------- */
  /* Re-solve the camera currently on screen. Using the scene's last keyframe
     here would snap the shot forward whenever a mobile browser resizes the
     viewport mid-scene (URL bar collapsing on scroll, for example). */
  function recompute() {
    if (!activeLayer || !activeLayer.cam) return;
    applyCam(activeLayer, activeLayer.cam, 0);
  }

  function observeResize() {
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () { recompute(); });
      ro.observe(viewport);
      return;
    }
    var pending;
    window.addEventListener("resize", function () {
      clearTimeout(pending);
      pending = setTimeout(recompute, 120);
    });
  }

  function onModeChange() {
    cancelAll();
    setStatus("");
    if (reduced()) {
      showReplay(false);
      renderStatic(current.step);
    } else {
      recompute();
    }
  }

  if (mqReduced) {
    if (mqReduced.addEventListener) mqReduced.addEventListener("change", onModeChange);
    else if (mqReduced.addListener) mqReduced.addListener(onModeChange);
  }
  if (mqMobile) {
    var onBreakpoint = function () {
      if (reduced()) { renderStatic(current.step); return; }
      /* Re-render the current scene so mobile camera/callout variants apply. */
      cancelAll();
      play(current.step, current.scene, playing ? current.mode : "static");
    };
    if (mqMobile.addEventListener) mqMobile.addEventListener("change", onBreakpoint);
    else if (mqMobile.addListener) mqMobile.addListener(onBreakpoint);
  }

  /* -----------------------------------------------------------
     15. Boot
     ----------------------------------------------------------- */
  function boot() {
    root.classList.add("is-live");
    buildLayers();
    observeResize();
    setActiveStep(0);

    Promise.all(LOAD_STAGES[0].map(loadAsset)).then(function () {
      preloadRemaining();

      if (reduced()) {
        showReplay(false);
        renderStatic(0);
        return;
      }

      /* Rest on the opening frame until the component is in view. */
      play(0, 0, "static");
      observeVisibility();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
