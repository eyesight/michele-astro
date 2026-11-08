class ToTop {
  constructor() {
    this.totopButton = document.querySelector('.totop');

    if(this.totopButton){
      this.bindEvents();
    }
  }
  
  bindEvents() {
    this.totopButton.addEventListener('click', e => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

export default ToTop;
