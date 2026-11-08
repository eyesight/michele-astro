import Helper from './Helper';

class OpenBurgerNav {
  constructor() {
    this.burger = document.querySelector('.js-burger');
    this.body = document.querySelector('body');
    this.header = document.querySelector('.header');
    this.headerPlaceholder = document.querySelector('.header-placeholder');

    if (this.burger) {
      this.bindEvents();
    }
    if (this.header && this.headerPlaceholder) {
      this.setCSSHeaderHeightVar(this.header);
      window.addEventListener('resize', () => {
        this.setCSSHeaderHeightVar(this.header);
      });
    }
  }

  bindEvents() {
    Helper.addClass(this.body, 'nav-is-in-dom');
    setTimeout(() => Helper.addClass(this.body, 'nav-is-visible'), 5);
    setTimeout(() => Helper.addClass(this.body, 'nav-is-animated'), 150);
  
    this.burger.addEventListener('click', e => {
      if (this.body.classList.contains('nav-is-open')) {
        Helper.removeClass(this.body, 'nav-is-open');
      } else {
        Helper.addClass(this.body, 'nav-is-open');
      }
    });
  
    this.lastScrollTop = 0;
  
    // Bind with context
    this.handleScrollDirection = this.handleScrollDirection.bind(this);
  
    // Debounce scroll detection to avoid triggering on layout changes
    let scrollTimeout;
    window.addEventListener("scroll", () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(this.handleScrollDirection, 100);
    });
  }  

  handleScrollDirection() {
    const body = document.body;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > this.lastScrollTop) {
      // Scrolling down
      body.classList.remove("scroll-down");
      setTimeout(() => {
        body.classList.remove("nav-is-in-dom");
      }, 750);
      body.classList.add("scroll-up");
    } else if (scrollTop < this.lastScrollTop) {
      // Scrolling up
      body.classList.remove("scroll-up");
      body.classList.add("nav-is-in-dom");
      setTimeout(() => {
        body.classList.add("scroll-down");
      }, 10);
    }

    this.lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // Prevent negative scrolling on mobile
  }

  setCSSHeaderHeightVar(header) {
    const headerHeight = header.offsetHeight;
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
  }
}

export default OpenBurgerNav;
