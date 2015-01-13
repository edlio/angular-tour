/**
 * An AngularJS directive for showcasing features of your website
 * @version v0.1.1 - 2015-01-13
 * @link https://github.com/DaftMonk/angular-tour
 * @author Tyler Henkel
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */

(function (window, document, undefined) {
  'use strict';
  angular.module('angular-tour', ['angular-tour.tour']);
  angular.module('angular-tour.tour', []).constant('tourConfig', {
    placement: 'top',
    animation: true,
    nextLabel: 'Next',
    previousLabel: 'Previous',
    finishLabel: 'Finish',
    scrollSpeed: 500,
    offset: 28,
    backdrop: true
  }).controller('TourController', [
    '$scope',
    'orderedList',
    function ($scope, orderedList) {
      var self = this, steps = self.steps = orderedList();
      // we'll pass these in from the directive
      self.postTourCallback = angular.noop;
      self.postStepCallback = angular.noop;
      self.currentStep = 0;
      self.firstStep = 0;
      self.lastStep = 0;
      // if currentStep changes, select the new step
      $scope.$watch(function () {
        return self.currentStep;
      }, function (val) {
        self.select(val);
      });
      self.select = function (nextIndex) {
        if (!angular.isNumber(nextIndex))
          return;
        self.unselectAllSteps();
        var step = steps.get(nextIndex);
        if (step) {
          step.ttOpen = true;
        }
        // update currentStep if we manually selected this index
        if (self.currentStep !== nextIndex) {
          self.currentStep = nextIndex;
        }
        if (nextIndex > self.lastStep) {
          self.postTourCallback();
        }
        self.postStepCallback();
      };
      self.addStep = function (step) {
        if (angular.isNumber(step.index) && !isNaN(step.index)) {
          if (step.index > self.lastStep) {
            self.lastStep = step.index;
          }
          if (self.firstStep === 0 || step.index < self.firstStep) {
            self.firstStep = step.index;
          }
          steps.set(step.index, step);
        } else {
          self.lastStep = steps.getCount();
          steps.push(step);
        }
      };
      self.unselectAllSteps = function () {
        steps.forEach(function (step) {
          step.ttOpen = false;
        });
      };
      self.isFirstStep = function () {
        return self.currentStep === self.firstStep;
      };
      self.isLastStep = function () {
        return self.currentStep === self.lastStep;
      };
      self.cancelTour = function () {
        self.unselectAllSteps();
        self.postTourCallback();
      };
      $scope.openTour = function () {
        // open at first step if we've already finished tour
        var startStep = self.currentStep >= steps.getCount() || self.currentStep < 0 ? 0 : self.currentStep;
        self.select(startStep);
      };
      $scope.closeTour = function () {
        self.cancelTour();
      };
    }
  ]).directive('tour', [
    '$parse',
    'tourConfig',
    function ($parse, tourConfig) {
      return {
        controller: 'TourController',
        restrict: 'EA',
        scope: true,
        link: function (scope, element, attrs, ctrl) {
          if (!angular.isDefined(attrs.step)) {
            throw 'The <tour> directive requires a `step` attribute to bind the current step to.';
          }
          var model = $parse(attrs.step);
          var hasBackdrop = false;
          // for showing backdrop/overlay at the background with inline style
          var backdrop = angular.element('<div class="tourtip-backdrop"></div>');
          // for highlight the target element with background color white and
          // transition in between target elements
          var tourtipHighlight = angular.element('<div class="tourtip-highlight-helper"></div>');
          // Watch current step view model and update locally
          scope.$watch(attrs.step, function (newVal) {
            ctrl.currentStep = newVal;
            // Append backdrop element if not already there
            if (!hasBackdrop && tourConfig.backdrop && newVal > 0) {
              backdrop.css({
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                position: 'fixed',
                opacity: 0.8,
                'background-color': '#000',
                'z-index': '1000',
                'transition': 'all .5s ease-out'
              });
              angular.element('body').append(backdrop);
              angular.element('body').append(tourtipHighlight);
              hasBackdrop = true;
            }
          });
          ctrl.postTourCallback = function () {
            // When the tour is over, remove the backdrop element
            if (hasBackdrop && tourConfig.backdrop) {
              backdrop.remove();
              tourtipHighlight.remove();
            }
            if (angular.isDefined(attrs.postTour)) {
              scope.$parent.$eval(attrs.postTour);
            }
          };
          ctrl.postStepCallback = function () {
            if (angular.isDefined(attrs.postStep)) {
              scope.$parent.$eval(attrs.postStep);
            }
          };
          // update the current step in the view as well as in our controller
          scope.setCurrentStep = function (val) {
            model.assign(scope.$parent, val);
            ctrl.currentStep = val;
          };
          scope.getCurrentStep = function () {
            return ctrl.currentStep;
          };
          scope.isFirstStep = function () {
            return ctrl.isFirstStep();
          };
          scope.isLastStep = function () {
            return ctrl.isLastStep();
          };
        }
      };
    }
  ]).directive('tourtip', [
    '$window',
    '$compile',
    '$interpolate',
    '$timeout',
    'scrollTo',
    'tourConfig',
    function ($window, $compile, $interpolate, $timeout, scrollTo, tourConfig) {
      var startSym = $interpolate.startSymbol(), endSym = $interpolate.endSymbol();
      var template = '<div tour-popup></div>';
      return {
        require: '^tour',
        restrict: 'EA',
        scope: true,
        link: function (scope, element, attrs, tourCtrl) {
          var targetElement;
          attrs.$observe('tourtip', function (val) {
            scope.ttContent = val;
          });
          attrs.$observe('tourtipTitle', function (val) {
            scope.ttTitle = val;
          });
          attrs.$observe('tourtipPlacement', function (val) {
            scope.ttPlacement = val || tourConfig.placement;
          });
          attrs.$observe('tourtipNextLabel', function (val) {
            scope.ttNextLabel = val || tourConfig.nextLabel;
          });
          attrs.$observe('tourtipPreviousLabel', function (val) {
            scope.ttPreviousLabel = val || tourConfig.previousLabel;
          });
          attrs.$observe('tourtipLastLabel', function (val) {
            scope.ttFinishLabel = val || tourConfig.finishLabel;
          });
          attrs.$observe('tourtipOffset', function (val) {
            scope.ttOffset = parseInt(val, 10) || tourConfig.offset;
          });
          scope.ttOpen = false;
          scope.ttAnimation = tourConfig.animation;
          scope.index = parseInt(attrs.tourtipStep, 10);
          var tourtip = $compile(template)(scope);
          // a transparent layer to block user action on target element
          var tourtipHighlightBlockr = angular.element('<div class="tourtip-highlight-blockr"></div>');
          // Try to set target to the first child of our tour directive
          targetElement = element;
          tourCtrl.addStep(scope);
          // wrap this in a time out because the tourtip won't compile right away
          $timeout(function () {
            scope.$watch('ttOpen', function (val) {
              if (val) {
                show();
              } else {
                hide();
              }
            });
          }, 500);
          function show() {
            var position, ttWidth, ttHeight, ttPosition, height, width;
            if (!scope.ttContent) {
              return;
            }
            if (scope.ttAnimation) {
              tourtip.fadeIn();
            } else {
              tourtip.css({ display: 'block' });
            }
            angular.element('body').append(tourtipHighlightBlockr);
            // Append it to the dom
            angular.element('body').append(tourtip);
            var updatePosition = function () {
              // Get the position of the directive element
              position = targetElement[0].getBoundingClientRect();
              ttWidth = tourtip[0].offsetWidth;
              ttHeight = tourtip[0].offsetHeight;
              width = targetElement.width();
              height = targetElement.height();
              targetElement.css({
                'z-index': 1002,
                position: 'relative',
                transition: 'all .05s linear .295s'
              });
              var top = position.top + window.pageYOffset;
              var highlightStyle = {};
              highlightStyle.position = 'absolute';
              highlightStyle.top = top;
              highlightStyle.left = position.left;
              highlightStyle.width = targetElement[0].offsetWidth;
              highlightStyle.height = targetElement[0].offsetHeight;
              var highlightBlockrStyle = angular.copy(highlightStyle);
              highlightBlockrStyle.background = 'transparent';
              highlightBlockrStyle['z-index'] = 1003;
              highlightStyle['z-index'] = 1001;
              highlightStyle['background-color'] = 'rgba(255,255,255,.95)';
              highlightStyle['box-shadow'] = '0 2px 15px rgba(0,0,0,.4)';
              highlightStyle['transition'] = 'all .3s ease-in';
              angular.element('.tourtip-highlight-helper').css(highlightStyle);
              tourtipHighlightBlockr.css(highlightBlockrStyle);
              var arrowTop = parseInt(tourtip.find('.tail').css('top'), 0);
              // Calculate the tourtip's top and left coordinates to center it
              switch (scope.ttPlacement) {
              case 'right':
                ttPosition = {
                  top: top - arrowTop - height / 2,
                  left: position.left + width + scope.ttOffset
                };
                break;
              case 'bottom':
                ttPosition = {
                  top: top + height + scope.ttOffset,
                  left: position.left
                };
                break;
              case 'left':
                ttPosition = {
                  top: top - arrowTop - height / 2,
                  left: position.left - ttWidth - scope.ttOffset
                };
                break;
              default:
                ttPosition = {
                  top: top - ttHeight - scope.ttOffset,
                  left: position.left
                };
                break;
              }
              ttPosition.top += 'px';
              ttPosition.left += 'px';
              // Now set the calculated positioning.
              tourtip.css(ttPosition);
              // Scroll to the tour tip
              scrollTo(tourtip, -200, -300, tourConfig.scrollSpeed);
            };
            angular.element($window).bind('resize.' + scope.$id, function () {
              updatePosition();
            });
            updatePosition();
          }
          function hide() {
            tourtip.detach();
            tourtipHighlightBlockr.detach();
            targetElement.css({
              'z-index': '',
              'position:': '',
              transition: ''
            });
            angular.element($window).unbind('resize.' + scope.$id);
          }
          // Make sure tooltip is destroyed and removed.
          scope.$on('$destroy', function onDestroyTourtip() {
            angular.element($window).unbind('resize.' + scope.$id);
            tourtip.remove();
            tourtip = null;
          });
        }
      };
    }
  ]).directive('tourPopup', function () {
    return {
      replace: true,
      templateUrl: 'tour/tour.tpl.html',
      scope: true,
      restrict: 'EA',
      link: function (scope, element, attrs) {
      }
    };
  }).factory('orderedList', function () {
    var OrderedList = function () {
      this.map = {};
      this._array = [];
    };
    OrderedList.prototype.set = function (key, value) {
      if (!angular.isNumber(key))
        return;
      if (key in this.map) {
        this.map[key] = value;
      } else {
        if (key < this._array.length) {
          var insertIndex = key - 1 > 0 ? key - 1 : 0;
          this._array.splice(insertIndex, 0, key);
        } else {
          this._array.push(key);
        }
        this.map[key] = value;
        this._array.sort(function (a, b) {
          return a - b;
        });
      }
    };
    OrderedList.prototype.indexOf = function (value) {
      for (var prop in this.map) {
        if (this.map.hasOwnProperty(prop)) {
          if (this.map[prop] === value)
            return Number(prop);
        }
      }
    };
    OrderedList.prototype.push = function (value) {
      var key = this._array[this._array.length - 1] + 1 || 0;
      this._array.push(key);
      this.map[key] = value;
      this._array.sort(function (a, b) {
        return a - b;
      });
    };
    OrderedList.prototype.remove = function (key) {
      var index = this._array.indexOf(key);
      if (index === -1) {
        throw new Error('key does not exist');
      }
      this._array.splice(index, 1);
      delete this.map[key];
    };
    OrderedList.prototype.get = function (key) {
      return this.map[key];
    };
    OrderedList.prototype.getCount = function () {
      return this._array.length;
    };
    OrderedList.prototype.forEach = function (f) {
      var key, value;
      for (var i = 0; i < this._array.length; i++) {
        key = this._array[i];
        value = this.map[key];
        f(value, key);
      }
    };
    OrderedList.prototype.first = function () {
      var key, value;
      key = this._array[0];
      value = this.map[key];
      return value;
    };
    var orderedListFactory = function () {
      return new OrderedList();
    };
    return orderedListFactory;
  }).factory('scrollTo', function () {
    return function (target, offsetY, offsetX, speed) {
      if (target) {
        offsetY = offsetY || -100;
        offsetX = offsetX || -100;
        speed = speed || 500;
        $('html,body').stop().animate({
          scrollTop: target.offset().top + offsetY,
          scrollLeft: target.offset().left + offsetX
        }, speed);
      } else {
        $('html,body').stop().animate({ scrollTop: 0 }, speed);
      }
    };
  });
}(window, document));