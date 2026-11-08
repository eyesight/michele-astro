import Helper from './Helper';

class CategoryLoader {
  constructor() {
    this.buttonClicked = document.querySelectorAll('button.filter__button');
    this.buttonClickedSmall = document.querySelectorAll('.tiles__cat-filter');
    this.buttonClickedArray = Array.prototype.slice.call(this.buttonClicked);
    this.buttonClickedSmallArray = Array.prototype.slice.call(this.buttonClickedSmall);

    this.categorylistSubpage = document.querySelectorAll('.title-lead__categories');
    this.categorylistSubpageArray = Array.prototype.slice.call(this.categorylistSubpage); // Fixed this line to use correct array

    this.anchorsCategorySubpage = document.querySelectorAll('a.filter__button');
    this.anchorsCategorySubpageArray = Array.prototype.slice.call(this.anchorsCategorySubpage);

    // Combine the arrays
    this.combinedButtonArray = this.buttonClickedArray.concat(this.buttonClickedSmallArray);

    this.bodyEl = document.querySelector('body');
    
    this.categoryPage = document.querySelector('.category');

    this.filteredItems = document.querySelectorAll('.tiles__item');
    this.filteredItemsArray = Array.prototype.slice.call(this.filteredItems);

    this.setActiveButton = this.setActiveButton.bind(this);
    
    this.filterArr = [];
    this.timeOutTime = 300;

    this.categoryPartOfTheTeam = 'part-of-the-team';

    this.handleScroll = this.handleScroll.bind(this);
    this.hideItemWithSpecificCategory = this.hideItemWithSpecificCategory.bind(this);
    
    if (this.buttonClicked && this.buttonClicked.length > 0) {
      this.bindEvents();
    }

    // Apply filter based on the hash in the URL
    this.applyFilterFromHash();

    // Set active filter based on categorylistSubpageArray
    this.applyFilterFromCategoryListSubpage();
  }

  bindEvents() {
    // If user is on category-page, show only the elements of the category in the beginning
    if (this.categoryPage) {
      const cat = this.getCurrentCategory(this.buttonClickedArray);
      this.togglePresent(this.filterArr, cat);
      this.hideItems(this.filteredItemsArray, this.filterArr);

      for (let i = 0; i < this.buttonClickedSmallArray.length; i++) {
        if (cat === this.buttonClickedSmallArray[i].getAttribute('data-filter-target')) {
          Helper.addClass(this.buttonClickedSmallArray[i], 'active');
        }
      }
    }
    
    this.showAllitems();
    
    // Initially hide items in the "part-of-the-team" category
    this.filteredItemsArray.forEach(item => {
      this.hideItemWithSpecificCategory(item, this.categoryPartOfTheTeam);
    });
    
    // Add click event listeners to all filter buttons
    this.combinedButtonArray.forEach(button => {
      button.addEventListener('click', e => {
        e.preventDefault();
        
        const clickedButton = e.currentTarget;
        const currentCategory = clickedButton.getAttribute('data-filter-target');
        
        this.togglePresent(this.filterArr, currentCategory);
        this.setActiveButton(clickedButton, this.combinedButtonArray); 
        this.animateFilteredItems(this.filterArr);
        
        // Remove hash from the URL when a button is clicked
        this.removeHashFromUrl();

        setTimeout(() => {
          this.hideItems(this.filteredItemsArray, this.filterArr);
          this.handleScroll();
        }, this.timeOutTime);
      });
    });
    
    this.handleScroll();

    // Add scroll event listener to trigger animation
    window.addEventListener('scroll', this.handleScroll);
  }

  animateFilteredItems(arr) {
    Helper.addClass(this.bodyEl, 'filter-hidden');
    setTimeout(() => {
      Helper.addClass(this.bodyEl, 'filter-active');
      Helper.removeClass(this.bodyEl, 'filter-hidden');
      if (arr.length === 0) {
        Helper.removeClass(this.bodyEl, 'filter-active');
      }
    }, this.timeOutTime);
  }

  showAllitems() {
    this.filteredItemsArray.forEach((item) => {
      Helper.addClass(item, 'show');
      setTimeout(() => {
        Helper.addClass(item, 'fade-in');
      }, this.timeOutTime);
    });
  }

  setActiveButton(clickedButton, allButtons) { 
    const categoryOfClickedBtn = clickedButton.getAttribute('data-filter-target');
    
    if (clickedButton.classList.contains('active')) {
      for (let i = 0; i < allButtons.length; i++) {
        Helper.removeClass(allButtons[i], 'active');
      }
    } else {
      for (let i = 0; i < allButtons.length; i++) {
        Helper.removeClass(allButtons[i], 'active');

        if (categoryOfClickedBtn === allButtons[i].getAttribute('data-filter-target')) {
          Helper.addClass(allButtons[i], 'active');
        }
      }
    }
  }
  
  hideItems(filteredItems, filteredCategories) {
    filteredItems.forEach(item => {
      Helper.removeClass(item, 'fade-in-scroll');

      if (filteredCategories.length === 0) {
        Helper.removeClass(item, 'hidden');
        this.hideItemWithSpecificCategory(item, this.categoryPartOfTheTeam);
      } else {
        Helper.addClass(item, 'hidden');
      }

      filteredCategories.forEach(filter => {
        let filterName = `tiles__filter--${filter}`;
        if (item.classList.contains(filterName)) {
          Helper.removeClass(item, 'hidden');
        }
      });
    });
  }

  togglePresent(arr, el) {
    const idx = arr.indexOf(el);

    if (idx === -1) {
      arr.shift();
      arr.push(el);
    } else {
      arr.splice(idx, 1);
    }
  }

  getCurrentCategory(buttons) {
    let categoryName = '';
    buttons.forEach((name) => {
      if (name.classList.contains('active')) {
        categoryName = name.getAttribute('data-filter-target');
      }
    });
    return categoryName;
  }

  isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top + 50 <= (window.innerHeight || document.documentElement.clientHeight)
    );
  }

  handleScroll() {
    const boxes = document.querySelectorAll('.tiles__item');
    boxes.forEach(function(box) {
      if (this.isInViewport(box)) {
        Helper.addClass(box, 'fade-in-scroll');
      }
    }, this);
  }

  hideItemWithSpecificCategory(item, categoryname) {
    if (item.classList.contains(`tiles__filter--${categoryname}`)) {
      Helper.addClass(item, 'hidden');
    }
  }

  // New method to apply filter from URL hash
  applyFilterFromHash() {
    const hash = window.location.hash.replace('#', ''); // Get the hash, remove the '#'

    if (hash) {
      // Find the button with the matching data-filter-target
      const matchingButton = this.combinedButtonArray.find(button => 
        button.getAttribute('data-filter-target') === hash
      );

      if (matchingButton) {
        // Simulate button click to apply the filter
        this.togglePresent(this.filterArr, hash);
        this.setActiveButton(matchingButton, this.combinedButtonArray);
        this.animateFilteredItems(this.filterArr);
        setTimeout(() => {
          this.hideItems(this.filteredItemsArray, this.filterArr);
          this.handleScroll();
        }, this.timeOutTime);
      }
    }
  }

  // New method to remove hash from the URL
  removeHashFromUrl() {
    if (window.history && window.history.replaceState) {
      // Remove the hash by updating the URL
      window.history.replaceState(null, null, window.location.pathname + window.location.search);
    }
  }

  // apply filter based on categorylistSubpageArray
  applyFilterFromCategoryListSubpage() {
    if (this.categorylistSubpageArray && this.categorylistSubpageArray.length > 0) {
      // Clear active state for all buttons before applying the new one
      this.anchorsCategorySubpageArray.forEach(button => {
        Helper.removeClass(button, 'active');
      });
  
      this.categorylistSubpageArray.forEach(subpageCategory => {
        const subpageCategoryName = subpageCategory.getAttribute('data-filter-target');
        
        const matchingButton = this.anchorsCategorySubpageArray.find(button =>
          button.getAttribute('data-filter-target') === subpageCategoryName
        );
  
        if (matchingButton) {
          // Set the matching button as active
          Helper.addClass(matchingButton, 'active'); // Mark this button as active
          this.togglePresent(this.filterArr, subpageCategoryName);
          this.animateFilteredItems(this.filterArr);
          
          setTimeout(() => {
            this.hideItems(this.filteredItemsArray, this.filterArr);
            this.handleScroll();
          }, this.timeOutTime);
        }
      });
    }
  }  
}

export default CategoryLoader;
