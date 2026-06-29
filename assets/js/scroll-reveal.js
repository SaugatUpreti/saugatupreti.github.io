(function () {
  'use strict';

  // ── Initialize AOS ───────────────────────────────────
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 700,
      easing: 'ease-out-quart',
      once: true,
      offset: 60,
    });
  }

  // ── Timeline line draw ───────────────────────────────
  const timelineLine = document.getElementById('timelineLine');
  if (timelineLine) {
    const tlObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            timelineLine.classList.add('animated');
            tlObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    tlObserver.observe(timelineLine.parentElement);
  }

  // ── Course border draw ───────────────────────────────
  const courseItems = document.querySelectorAll('.course-item[data-reveal]');
  if (courseItems.length) {
    const courseObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            courseObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    courseItems.forEach((item) => courseObserver.observe(item));
  }

})();
