String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};


class Helper {
  static toggleClass(el, className) {
    if (!el || !className) {
      return;
    }

    var classString = el.className,
      nameIndex = classString.indexOf(className);
    if (nameIndex == -1) {
      classString += " " + className;
    } else {
      classString =
        classString.substr(0, nameIndex) +
        classString.substr(nameIndex + className.length);
    }
    el.className = classString;
  }

  static removeFromDom(elem){
    elem.parentNode.removeChild(elem);
  }

  static replaceInDom(toReplace, replacement){
    if(replacement){
      let replacementObj = new DOMParser().parseFromString(replacement, 'text/html').body.childNodes;
      replacementObj = replacementObj.item(0);
      replacementObj.classList.add("teaser-fade-in");
      replacementObj.classList.add("teaser-animation");
      toReplace.parentNode.replaceChild(replacementObj, toReplace);
      setTimeout(function(){
        replacementObj.classList.remove("teaser-fade-in");
      }, 200);
    }
  }


  static appendInDom(toAppend, appendent){
    if(appendent){
      let appendObj = new DOMParser().parseFromString(appendent, 'text/html').body.childNodes;
      appendObj = appendObj.item(0);
      appendObj.classList.add("teaser-fade-in");
      appendObj.classList.add("teaser-animation");
      toAppend.parentNode.appendChild(appendObj);
      setTimeout(function(){
        appendObj.classList.remove("teaser-fade-in");
      }, 200);
    }
  }

	static camelCase(str) {
		return str.replace(/^([A-Z])|[\s-_](\w)/g, function(match, p1, p2, offset) {
			if (p2) return p2.toUpperCase();
			return p1.toLowerCase();
		});
	}

	static wrap(el, wrapper) {
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
	}

	static unwrap(el) {
		const parent = el.parentElement;
		while (el.firstChild) parent.insertBefore(el.firstChild, el);
		parent.removeChild(el);
	}

  static hasClass(el, className) {
    if (el.classList) return el.classList.contains(className);
    return !!el.className.match(new RegExp("(\\s|^)" + className + "(\\s|$)"));
  }

  static addClass(el, className) {
    if (el.classList) el.classList.add(className);
    else if (!hasClass(el, className)) el.className += " " + className;
  }

  static removeClass(el, className) {
    if (el.classList) el.classList.remove(className);
    else if (hasClass(el, className)) {
      var reg = new RegExp("(\\s|^)" + className + "(\\s|$)");
      el.className = el.className.replace(reg, " ");
    }
  }

  static getClosest(elem, selector) {
    // Element.matches() polyfill
    if (!Element.prototype.matches) {
      Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(s) {
          var matches = (this.document || this.ownerDocument).querySelectorAll(
              s
            ),
            i = matches.length;
          while (--i >= 0 && matches.item(i) !== this) {}
          return i > -1;
        };
    }

    // Get the closest matching element
    for (; elem && elem !== document; elem = elem.parentNode) {
      if (elem.matches(selector)) return elem;
    }
    return null;
  }


    /**
    * SlideUp
    *
    * @param {HTMLElement} element
    * @param {Number} duration
    * @returns {Promise<boolean>}
    */
    static slideUp(element, duration = 500) {

        return new Promise(function (resolve, reject) {
            element.style.height = element.offsetHeight + 'px';
            element.style.transitionProperty = `height, margin, padding`;
            element.style.transitionDuration = duration + 'ms';
            element.offsetHeight;
            element.style.overflow = 'hidden';
            element.style.height = 0;
            element.style.paddingTop = 0;
            element.style.paddingBottom = 0;
            element.style.marginTop = 0;
            element.style.marginBottom = 0;
            window.setTimeout(function () {
                element.style.display = 'none';
                element.style.removeProperty('height');
                element.style.removeProperty('padding-top');
                element.style.removeProperty('padding-bottom');
                element.style.removeProperty('margin-top');
                element.style.removeProperty('margin-bottom');
                element.style.removeProperty('overflow');
                element.style.removeProperty('transition-duration');
                element.style.removeProperty('transition-property');
                resolve(false);
            }, duration)
        })
    }

    /**
    * SlideDown
    *
    * @param {HTMLElement} element
    * @param {Number} duration
    * @returns {Promise<boolean>}
    */
    static slideDown(element, duration = 500) {

        return new Promise(function (resolve, reject) {

            element.style.removeProperty('display');
            let display = window.getComputedStyle(element).display;

            if (display === 'none')
                display = 'block';

            element.style.display = display;
            let height = element.offsetHeight;
            element.style.overflow = 'hidden';
            element.style.height = 0;
            element.style.paddingTop = 0;
            element.style.paddingBottom = 0;
            element.style.marginTop = 0;
            element.style.marginBottom = 0;
            element.offsetHeight;
            element.style.transitionProperty = `height, margin, padding`;
            element.style.transitionDuration = duration + 'ms';
            element.style.height = height + 'px';
            element.style.removeProperty('padding-top');
            element.style.removeProperty('padding-bottom');
            element.style.removeProperty('margin-top');
            element.style.removeProperty('margin-bottom');
            window.setTimeout(function () {
                element.style.removeProperty('height');
                element.style.removeProperty('overflow');
                element.style.removeProperty('transition-duration');
                element.style.removeProperty('transition-property');
            }, duration)
        })
    }

    /**
    * SlideToggle
    *
    * @param {HTMLElement} element
    * @param {Number} duration
    * @returns {Promise<boolean>}
    */
    static slideToggle(element, duration = 500) {
      // console.log(element);
      // console.log(window.getComputedStyle(element).display);

        if (window.getComputedStyle(element).display === 'none') {

            return this.slideDown(element, duration);

        } else {

            return this.slideUp(element, duration);
        }
		}

    static slideClose(elem) {
      let height = elem.clientHeight + 'px';
      elem.animate([
        // keyframes
        {
          height: height
        },
        {
          height: '0px'
        }
      ], {
        // timing options
        duration: 200,
        iterations: 1
      });
      elem.style.height = 0;
    }
  
    static slideOpen(elem, auto = false) {
      let height = this.getHeight(elem);
      elem.animate([
        // keyframes
        {
          height: '0px'
        },
        {
          height: height
        }
      ], {
        // timing options
        duration: 200,
        iterations: 1
      });
      if(auto){
        elem.style.height = 'auto';
      } else{
        elem.style.height = height;
      }
    }

    static getHeight(elem) {
      elem.style.display = 'block'; // Make it visible
      var height = elem.scrollHeight + 'px'; // Get it's height
      elem.style.display = ''; //  Hide it again
      return height;
    }


		static setCookie(name,value,days) {
			if (days) {
				var date = new Date();
				date.setTime(date.getTime()+(days*24*60*60*1000));
				var expires = "; expires="+date.toGMTString();
			}
			else var expires = "";
			document.cookie = name+"="+value+expires+"; path=/";
		}

		static getCookie(cname) {
			var name = cname + "=";
			var ca = document.cookie.split(';');
			for(var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) == ' ') {
					c = c.substring(1);
				}
				if (c.indexOf(name) == 0) {
					return c.substring(name.length, c.length);
				}
			}
			return "";
		}

		static removeCookie(name) {
			this.setCookie(name,"",-1);
    }
}

export default Helper;
