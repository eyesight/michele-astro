import CategoryLoader from './Classes/CategoryLoader';
import ToTop from './Classes/ToTop';
import OpenBurgerNav from './Classes/OpenBurgerNav';
import Accordion from './Classes/Accordion';
import Sticky from 'sticky-js';

let sticky = null;

document.addEventListener('DOMContentLoaded', function () {
  new CategoryLoader();
  new ToTop();
  new OpenBurgerNav();

  sticky = new Sticky('.sticky');

  new Accordion({ accordions: '.js-toggle-accordion' });

  // --- Video overlay logic ---
  const videoOverlay = document.querySelector('.hero-image--placeholder');
  const videoIframe = document.querySelector('.hero-video iframe');

  if (videoOverlay && videoIframe) {
    const originalSrc = videoIframe.getAttribute('src') || '';

    videoOverlay.addEventListener('click', function () {
      try {
        const url = new URL(videoIframe.src || originalSrc, window.location.href);
        const params = url.searchParams;
        if (params.get('autoplay') === '1') {
          params.delete('autoplay');
        } else {
          params.set('autoplay', '1');
        }
        videoIframe.setAttribute('src', url.toString());
      } catch (e) {
        let currentSrc = videoIframe.getAttribute('src') || originalSrc;
        if (currentSrc.includes('autoplay=1')) {
          currentSrc = currentSrc.replace('&autoplay=1', '').replace('?autoplay=1', '');
        } else {
          currentSrc = currentSrc.includes('?') ? currentSrc + '&autoplay=1' : currentSrc + '?autoplay=1';
        }
        videoIframe.setAttribute('src', currentSrc);
      }
    });
  }

  // --- Image blur + footer fade logic ---
  const imageWrappers = document.querySelectorAll('.hero-image__image');
  const footer = document.querySelector('footer');

  if (imageWrappers.length > 0 && footer) {
    let footerVisible = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          footerVisible = entry.isIntersecting;
        });
      },
      { root: null, threshold: 0 },
    );

    observer.observe(footer);

    const maxBlur = 10;
    let ticking = false;

    function updateOnScroll() {
      const scrollTop = window.scrollY || 0;

      imageWrappers.forEach((imageWrapper) => {
        const blurValue = Math.min(scrollTop / 85, maxBlur);
        imageWrapper.style.filter = `blur(${blurValue}px)`;

        if (footerVisible) {
          const footerRect = footer.getBoundingClientRect();
          const fadeRange = 200;
          const footerOffset = window.innerHeight - footerRect.top;
          const fadeProgress = Math.min(Math.max(footerOffset / fadeRange, 0), 1);
          imageWrapper.style.opacity = 1 - fadeProgress;
        } else {
          imageWrapper.style.opacity = 1;
        }
      });

      ticking = false;
    }

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          window.requestAnimationFrame(updateOnScroll);
          ticking = true;
        }
      },
      { passive: true },
    );
  }
});

window.addEventListener('load', () => {
  if (sticky && typeof sticky.update === 'function') sticky.update();
});

window.addEventListener(
  'resize',
  () => {
    if (sticky && typeof sticky.update === 'function') sticky.update();
  },
  { passive: true },
);
