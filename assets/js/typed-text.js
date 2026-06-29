(function () {
  'use strict';

  const el = document.getElementById('typed-output');
  if (!el || typeof Typed === 'undefined') return;

  new Typed('#typed-output', {
    strings: [
      'Doctoral Candidate in Mechanical Engineering',
      'Scientific Machine Learning Researcher',
      'Physics-Informed Neural Network Developer',
      'vWF Polymer Dynamics Researcher',
    ],
    typeSpeed: 42,
    backSpeed: 28,
    backDelay: 2200,
    startDelay: 600,
    loop: true,
    smartBackspace: true,
    cursorChar: '|',
  });

})();
