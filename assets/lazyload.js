// Universal Lazy Loading Script by ElliotSop
// Works for images, videos, and background images
// Drop into both static and Node.js sites — no per-file edits required

document.addEventListener("DOMContentLoaded", () => {
  const lazyElements = document.querySelectorAll(
    'img[data-src], video[data-src], [data-bg]'
  );

  // Optional: fade-in effect
  const fadeIn = (el) => {
    el.style.transition = "opacity 0.6s ease";
    el.style.opacity = 1;
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;

        // Handle <img>
        if (el.tagName === "IMG" && el.dataset.src) {
          el.src = el.dataset.src;
          el.onload = () => fadeIn(el);
          obs.unobserve(el);
        }

        // Handle <video>
        else if (el.tagName === "VIDEO" && el.dataset.src) {
          el.src = el.dataset.src;
          el.load();
          fadeIn(el);
          obs.unobserve(el);
        }

        // Handle background elements
        else if (el.dataset.bg) {
          el.style.backgroundImage = `url('${el.dataset.bg}')`;
          fadeIn(el);
          obs.unobserve(el);
        }
      }
    });
  }, {
    rootMargin: "200px 0px", // preload just before visible
    threshold: 0.01
  });

  lazyElements.forEach(el => {
    el.style.opacity = 0;
    observer.observe(el);
  });
});
