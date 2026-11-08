import Helper from './Helper';

class Accordion {
  constructor(config = {}) {
    const {
      accordions,
    } = config;
    this.accordions = Array.prototype.slice.call(document.querySelectorAll(accordions));
    this.currentEl = null;
    if(this.accordions && this.accordions.length !== 0){
      this.bindEvents();
    }
  }

  bindEvents() {
    this.accordions.forEach(el => {
      el.addEventListener('click', (e) => {
        // If it's already active, close it
        if (el.classList.contains('active')) {
          Helper.slideClose(el.nextElementSibling);
          el.classList.remove('active');
        } else {
          // Close all other accordions
          this.accordions.forEach(otherEl => {
            if (otherEl !== el && otherEl.classList.contains('active')) {
              Helper.slideClose(otherEl.nextElementSibling);
              otherEl.classList.remove('active');
            }
          });
  
          // Open the clicked one
          el.classList.add('active');
          Helper.slideOpen(el.nextElementSibling, true);
        }
      });
    });
  }  
}

export default Accordion;
