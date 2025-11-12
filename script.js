```javascript
/* ======================================================================
   Interaction: delayed hover to reveal the current card’s caption while
   dimming all other cards. Delay set via --hover-delay (CSS var).
   ====================================================================== */
(function () {
  const HOVER_DELAY =
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hover-delay"
      )
    ) || 3400;
  let timer = null;
  const body = document.body;
  const cards = Array.from(document.querySelectorAll(".card"));

  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      timer = setTimeout(() => {
        body.classList.add("dim-mode");
        cards.forEach((c) => c.classList.remove("active", "show-caption"));
        card.classList.add("active", "show-caption");
      }, HOVER_DELAY);
    });

    const reset = () => {
      clearTimeout(timer);
      timer = null;
      card.classList.remove("active", "show-caption");
      body.classList.remove("dim-mode");
    };

    card.addEventListener("mouseleave", reset);
    card.addEventListener("click", reset); // click cancels focus as well
    card.addEventListener("touchend", reset, { passive: true });
    card.addEventListener("touchcancel", reset, { passive: true });
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        cards.forEach((c) => c.classList.remove("active", "show-caption"));
        body.classList.remove("dim-mode");
      }
    },
    { passive: true }
  );
})();

/* ======================================================================
   Equalizer: make each module’s two columns share the same OUTER height
   without cropping any image.

   Strategy
   - For each .module:
     * data-equalize="right" -> measure the right column and apply min-height to left stack
     * data-equalize="left" -> measure the left column and apply min-height to right stack
   - We call this after all images load and on resize.
   On narrow viewports where modules collapse to a single column, min-height is removed.
   - This maintains the “invisible square” outer rectangle while allowing internal slack
     inside the stacked column (via align-content: space-between).
   ====================================================================== */
(function () {
  const modules = Array.from(document.querySelectorAll(".module"));

  function columnHeight(col) {
    // Use the column’s bounding box height (includes its children).
    // No borders exist, so we get a clean outer edge with no hairlines.
    const rect = col.getBoundingClientRect();
    return Math.round(rect.height);
  }

  function clearHeights(mod) {
    mod.querySelectorAll(".col").forEach((c) => (c.style.minHeight = ""));
  }

  function equalizeModule(mod) {
    const mode = (mod.getAttribute("data-equalize") || "right").toLowerCase();
    const left = mod.querySelector(".col.left");
    const right = mod.querySelector(".col.right");

    // On small screens we’re single column. Remove min-heights to avoid giant blanks.
    const singleColumn =
      getComputedStyle(mod).gridTemplateColumns.split(" ").length === 1;
    if (singleColumn) {
      clearHeights(mod);
      return;
    }

    // Decide which column we measure and which one we stretch.
    let measure, stretch;
    if (mode === "left") {
      measure = left;
      stretch = right;
    } else {
      measure = right;
      stretch = left;
    }

    // Reset before measuring to avoid compounding.
    clearHeights(mod);

    // Measure and apply as min-height for the opposite column.
    const h = columnHeight(measure);
    if (h > 0) stretch.style.minHeight = h + "px";
  }

  // Equalize all modules
  function equalizeAll() {
    modules.forEach(equalizeModule);
  }

  // Debounce for resize
  let resizeTimer = null;
  function debouncedEqualize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(equalizeAll, 120);
  }

  // Wait for images (all of them) then equalize.
  // If some images are cached, they may already be complete.
  const imgs = Array.from(document.images || []);
  let remaining = imgs.length;

  if (remaining === 0) {
    equalizeAll();
  } else {
    imgs.forEach((img) => {
      if (img.complete) {
        if (--remaining === 0) equalizeAll();
      } else {
        img.addEventListener(
          "load",
          () => {
            if (--remaining === 0) equalizeAll();
          },
          { once: true }
        );
        img.addEventListener(
          "error",
          () => {
            if (--remaining === 0) equalizeAll();
          },
          { once: true }
        );
      }
    });
  }

  // Recompute on resize and orientation changes
  window.addEventListener("resize", debouncedEqualize, { passive: true });
  window.addEventListener("orientationchange", debouncedEqualize);
  // Safety: re-run after fonts/layout settle
  window.addEventListener("load", debouncedEqualize);
})();

/* ======================================================================
   Extra: Accessibility focus handling.
   When tabbing through, caption should appear instantly for focused cards.
   ====================================================================== */
(function () {
  const cards = Array.from(document.querySelectorAll(".card"));
  cards.forEach((card) => {
    card.addEventListener("focusin", () => {
      card.classList.add("active", "show-caption");
      document.body.classList.add("dim-mode");
    });
    card.addEventListener("focusout", () => {
      card.classList.remove("active", "show-caption");
      document.body.classList.remove("dim-mode");
    });
  });
})();

/* ======================================================================
   Extra: Lazy loading observer.
   Ensures heavy images load only when visible, preventing flicker in equalizer.
   ====================================================================== */
(function () {
  const lazyImages = document.querySelectorAll("img[data-src]");
  if (!("IntersectionObserver" in window)) {
    lazyImages.forEach((img) => (img.src = img.dataset.src));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
        obs.unobserve(img);
      }
    });
  });
  lazyImages.forEach((img) => observer.observe(img));
})();

/* =============== Theme toggle (light/dark) ===============
   Placement: paste this whole block in script.js
   AFTER the "Lazy loading observer" block and BEFORE
   the "Performance timing" block.
========================================================== */
(function () {
  const STORAGE_KEY = 'site:theme';
  const root = document.documentElement;
  const body = document.body;
  const btn  = document.getElementById('themeSwitch');
  if (!btn || !root) return;

  // System preference listener
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  // Determine starting theme: saved → system
  function getInitialTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return mql.matches ? 'dark' : 'light';
  }

  // Apply theme to DOM and control
  function applyTheme(mode, { save = false } = {}) {
    const isDark = mode === 'dark';
    root.setAttribute('data-theme', mode);
    body.classList.toggle('is-dark', isDark);
    btn.setAttribute('aria-pressed', String(isDark));
    btn.classList.toggle('is-on', isDark);
    if (save) localStorage.setItem(STORAGE_KEY, mode);
  }

  // Init
  applyTheme(getInitialTheme());

  // Toggle on click (keyboard activation works because it's a <button>)
  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, { save: true });
  });

  // If user hasn't chosen explicitly, follow system changes
  mql.addEventListener?.('change', (e) => {
    if (localStorage.getItem(STORAGE_KEY) == null) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Optional helper: double-tap the button to clear saved choice and
  // revert to following system preference.
  let lastTap = 0;
  btn.addEventListener('touchend', () => {
    const now = Date.now();
    if (now - lastTap < 350) {
      localStorage.removeItem(STORAGE_KEY);
      applyTheme(mql.matches ? 'dark' : 'light');
    }
    lastTap = now;
  }, { passive: true });
})();

/* ======================================================================
   Extra: Performance timing for debug (optional logging)
   ====================================================================== */
(function () {
  if (!window.performance) return;
  window.addEventListener("load", () => {
    const t = performance.timing;
    const loadTime = t.loadEventEnd - t.navigationStart;
    console.debug("Page load time (ms):", loadTime);
  });
})();

//complete
```
