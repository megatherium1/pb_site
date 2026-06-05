/* =============================================================
   ProjBox marketing site — main.js
   - Video modal (opened by Watch Demo CTA + hero poster)
   - Mobile nav toggle
   - Scroll fade-in via IntersectionObserver (reduced-motion aware)
   No external dependencies. Plain ES5/ES6, no build step.
   ============================================================= */

(function () {
  "use strict";

  // -----------------------------------------------------------
  // 1. Single source of truth for the demo video URL.
  //    Accepts a YouTube watch URL or a Vimeo page/player URL —
  //    the embed URL is derived automatically.
  // -----------------------------------------------------------
  var DEMO_VIDEO_URL = "https://vimeo.com/1198644021?share=copy&fl=sv&fe=ci";

  /**
   * Convert a YouTube or Vimeo URL into an embed URL with autoplay.
   * Falls back to the raw URL if no video id is found.
   */
  function toEmbedUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "");
      var id = "";

      if (host === "vimeo.com") {
        id = u.pathname.replace(/^\//, "").split("/")[0];
        if (!id) return url;
        return "https://player.vimeo.com/video/" + encodeURIComponent(id) +
               "?badge=0&autopause=0&autoplay=1";
      }

      if (host === "player.vimeo.com" && u.pathname.indexOf("/video/") === 0) {
        id = u.pathname.split("/video/")[1].split("/")[0];
        if (!id) return url;
        return "https://player.vimeo.com/video/" + encodeURIComponent(id) +
               "?badge=0&autopause=0&autoplay=1";
      }

      if (host.indexOf("youtu.be") !== -1) {
        id = u.pathname.replace(/^\//, "");
      } else if (u.searchParams.get("v")) {
        id = u.searchParams.get("v");
      } else if (u.pathname.indexOf("/embed/") === 0) {
        id = u.pathname.split("/embed/")[1];
      }
      if (!id) return url;
      return "https://www.youtube.com/embed/" + encodeURIComponent(id) +
             "?autoplay=1&rel=0&modestbranding=1";
    } catch (err) {
      return url;
    }
  }

  // -----------------------------------------------------------
  // 2. Video modal wiring
  // -----------------------------------------------------------
  function initVideoModal() {
    var modal   = document.querySelector("[data-video-modal]");
    if (!modal) return;
    var iframe  = modal.querySelector("iframe");
    var closeEl = modal.querySelector("[data-video-close]");
    var triggers = document.querySelectorAll("[data-video-open]");

    function open() {
      iframe.setAttribute("src", toEmbedUrl(DEMO_VIDEO_URL));
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("pb-no-scroll");
      // Move focus to close button for keyboard users
      if (closeEl) closeEl.focus();
    }
    function close() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("pb-no-scroll");
      // Clearing src stops playback in the iframe
      iframe.setAttribute("src", "");
    }

    triggers.forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    });

    if (closeEl) closeEl.addEventListener("click", close);

    // Close on backdrop click (but not when clicking the dialog itself)
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });

    // Close on ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  }

  // -----------------------------------------------------------
  // 3. Mobile nav toggle
  // -----------------------------------------------------------
  function initNavToggle() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav    = document.querySelector("[data-nav]");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close mobile menu after tapping a link
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // -----------------------------------------------------------
  // 4. Scroll fade-in (no-op when reduced motion is preferred)
  // -----------------------------------------------------------
  function initFadeIn() {
    var prefersReduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els = document.querySelectorAll(".pb-fade-in");
    if (!els.length) return;

    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    els.forEach(function (el) { io.observe(el); });
  }

  // -----------------------------------------------------------
  // 5. Year stamp in footer (small nicety)
  // -----------------------------------------------------------
  function initYear() {
    var el = document.querySelector("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  // -----------------------------------------------------------
  // Boot
  // -----------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initVideoModal();
      initNavToggle();
      initFadeIn();
      initYear();
    });
  } else {
    initVideoModal();
    initNavToggle();
    initFadeIn();
    initYear();
  }
})();
