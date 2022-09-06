"use strict";

import simpleState from "./modules/SimpleState.js";
import { debounce, generateRandomHash } from "./modules/utilty.js";

(() => {
  const debug = false;

  /**
   * Logs messages if debug conditions are met.
   * Allowing it to be overwritten in other contexts so debug condition can be changed.
   * @param  {...any} args Messages to pass to console.log
   */
  let debugLog = (...args) => {
    if (debug) {
      console.log(...args);
    }
  }

  /**
   * Checks the choosin's location on the page and dropdown contents and sets the dropdown height and direction (up or down)
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const setDropdownHeightAndDirection = ($choosin) => {
    // Set dropdown direction and dropdown height depending on page position and size
    const optionsWrapperBoundingClientRect = $choosin.choosin.elements.optionsWrapper.getBoundingClientRect();
    let dropdownDirection;
    let dropdownHeight;
    // See if dropdown would go off of the page
    if (optionsWrapperBoundingClientRect.top + optionsWrapperBoundingClientRect.height > window.innerHeight) {
      // Set direction of dropdown based on it's position
      if (optionsWrapperBoundingClientRect.top > window.innerHeight / 2) {
        dropdownDirection = 'up';
        // Getting distance from the top of the choosin wrapper to the top of optionList
        let offsetFromElements = $choosin.offsetHeight;
        if ($choosin.choosin.elements.searchWrapper && $choosin.choosin.elements.searchWrapper.offsetHeight) {
          // Count the search offset twice
          // The first time is because everything's rendered downward, and we're getting the location of the top of the chosen wrapper
          // A second time to get the right height for the optionList, the search will be inbetween the top of the chosen wrapper, and the optionlist
          offsetFromElements += $choosin.choosin.elements.searchWrapper.offsetHeight * 2;
        }
        dropdownHeight = Math.floor(optionsWrapperBoundingClientRect.top - offsetFromElements) - 20;
      }
      else {
        dropdownDirection = 'down';
        dropdownHeight = Math.floor(window.innerHeight - optionsWrapperBoundingClientRect.top) - 20;
      }

      // Set dropdownDirection state
      $choosin.choosin.state.set('dropdownDirection', dropdownDirection);
      // Set height as CSS var for styling to pick up
      $choosin.style.setProperty('--js-choosin__optionList__height', `${dropdownHeight}px`);
    }
  }

  /**
   * Callback for state change in isOpen
   * @param {boolean} setToOpen New value of isOpen
   * @param {boolean} previousState Old value of isOpen
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const isOpenCallback = (setToOpen, previousState, $choosin) => {
    // If nothing has changed, no need to do anything
    if (setToOpen === previousState) {
      return;
    }

    /**
     * Open a $choosin element
     */
    const _open = () => {
      setDropdownHeightAndDirection($choosin);

      // Open the dropdown
      $choosin.setAttribute('open', '');
      const $optionSelected = $choosin.choosin.state.get('optionSelected');
      // Highlight an option on open
      if ($optionSelected) {
        // Choose the selected option, if there is one
        $choosin.choosin.state.set('optionHighlighted', $optionSelected);
        makeSureOptionIsVisible($optionSelected, $choosin, false);
      }
      else {
        // Otherwise get the first visible option
        const visibleOptionValues = $choosin.choosin.state.get('visibleOptionValues');
        const valueToOptionMap = $choosin.choosin.state.get('valueToOptionMap');
        const firstVisibleOptionId = visibleOptionValues[0];
        const $firstVisibleOption = valueToOptionMap[firstVisibleOptionId];
        $choosin.choosin.state.set('optionHighlighted', $firstVisibleOption);
      }

      // Focus on text field if we have search
      if ($choosin.choosin.state.get('hasSearch')) {
        const $searchText = $choosin.querySelector('.csn-search__textField');
        if ($searchText) {
          $searchText.focus();
        }
      }
    }

    /**
     * Close a $choosin element
     */
    const _close = () => {
      $choosin.removeAttribute('open');
      // Reset height var
      $choosin.style.removeProperty('--js-choosin__optionList__height');
      // Remove state that doesn't apply when closed
      $choosin.choosin.state.set('optionHighlighted', null);
      $choosin.choosin.state.set('dropdownDirection', 'none');
      // Reset scroll position of choosin
      $choosin.choosin.elements.optionsWrapper.scrollTo({'top': 0});
      // Focus the trigger per a11y best practices, assuming something else hasn't been focused
      if (document.activeElement.closest('.choosin')) {
        $choosin.choosin.elements.trigger.focus();
      }
    };

    if (setToOpen) {
      _open();
    }
    else {
      _close();
    }
  }

  /**
   * Handler for an option being selected
   * @param {HTMLElement} $optionSelected A .csn-optionList__option element
   * @param {HTMLElement} $optionWasSelected A .csn-optionList__option element
   * @param {HTMLElement} $choosin The outer wrapper of this option's choosin element
   */
  const optionSelectedCallback = ($optionSelected, $optionWasSelected, $choosin, smoothScroll) => {
    const value = $optionSelected.dataset.value;
    if (!value) {
      console.error('Choosin option selected, but it is missing a value', $optionSelected);
      return;
    }
    const $trigger = $choosin.choosin.elements.trigger;
    if (value && $optionSelected !== $optionWasSelected) {
      $trigger.dataset.value = value;
      $trigger.innerText = $optionSelected.innerText;
    }
    const valueToSelectOptionMap = $choosin.choosin.state.get('valueToSelectOptionMap');
    if (valueToSelectOptionMap[value]) valueToSelectOptionMap[value].setAttribute('selected', '');
    $choosin.choosin.state.set('isOpen', false);
  };

  /**
   * Makes sure given option is in view of scrolling options
   * @param {HTMLElement} $option A .csn-optionList__option element
   * @param {HTMLElement} $choosin The outer wrapper of this option's choosin element
   * @param {boolean} smoothScroll Set to true to smooth scroll
   */
  const makeSureOptionIsVisible = ($option, $choosin, smoothScroll) => {
    if (smoothScroll === undefined) smoothScroll = true;
    // Get DOMRects from viewport
    const optionBoundingRect = $option.getBoundingClientRect();
    const $scrollingParent = $choosin.choosin.elements.optionsWrapper;
    // Retrieve cached bounding rect for optionsWrapper
    const scrollingParentBoundingRect = $scrollingParent.getBoundingClientRect();


    const scrollingParentTopfromDocumentTop = window.scrollY + scrollingParentBoundingRect.top; // Distance from top of the page
    const optionTopFromDocumentTop = optionBoundingRect.top + window.scrollY + $scrollingParent.scrollTop;
    const optionTopFromScrollingParentTop = optionTopFromDocumentTop - scrollingParentTopfromDocumentTop;

    const optionListVisibleBoundaryTop = $scrollingParent.scrollTop;
    const optionListVisibleBoundaryBottom = optionListVisibleBoundaryTop + $scrollingParent.offsetHeight;

    // $scrollingParent.scrollTo(0, optionTopFromScrollingParentTop);

    console.log(
      {
        scrollingParentTopfromDocumentTop,
        optionTopFromDocumentTop,
        optionTopFromScrollingParentTop,
        optionListVisibleBoundaryTop,
        optionListVisibleBoundaryBottom,
      },
      {
        optionBoundingRect,
        scrollingParentBoundingRect,
      }
    );

    let scrollToY;
    const optionIsAboveTop = optionTopFromScrollingParentTop < optionListVisibleBoundaryTop;
    const optionIsBelowBottom = optionTopFromScrollingParentTop + optionBoundingRect.height > optionListVisibleBoundaryBottom;

    if (optionIsAboveTop) {
      const scrollOffsetByDropdownHeight = scrollingParentBoundingRect.height * 0.25;
      scrollToY = optionTopFromScrollingParentTop - (scrollingParentBoundingRect.height * 0.25);
    }
    else if (optionIsBelowBottom) {
      scrollToY = optionTopFromScrollingParentTop - optionBoundingRect.height - (scrollingParentBoundingRect.height * 0.75);
    }

    if (scrollToY) $scrollingParent.scrollTo({
      'top': scrollToY,
      'behavior': smoothScroll ? 'smooth' : 'auto',
    });
  }

  /**
   * Highlight an option to indicate pointer, touch, or keyboard interaction
   * @param {HTMLElement} $optionToHighlight A .csn-optionList__option element
   * @param {HTMLElement} $optionWasHighlighted A .csn-optionList__option element
   * @param {HTMLElement} $choosin The outer wrapper of this option's choosin element
   */
  const optionHighlightedCallback = ($optionToHighlight, $optionWasHighlighted, $choosin) => {
    const highlightClass = 'csn-optionList__option--highlight';
    if ($optionToHighlight === null) return;
    if ($optionToHighlight !== $optionWasHighlighted) {
      if ($optionWasHighlighted) {
        $optionWasHighlighted.classList.remove(highlightClass);
      }
      $optionToHighlight.classList.add(highlightClass);
    }
  }

  /**
   * Validates and sets up trigger (the always visible dropdown UI)
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const setupTrigger = ($choosin) => {
    const $trigger = $choosin.choosin.elements.trigger;
    if (!$trigger) {
      console.error('setupTrigger: Couldn\'t get $trigger element from the $choosin element', $choosin);
    }
    $trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = $choosin.choosin.state.get('isOpen');
      $choosin.choosin.state.set('isOpen', !isOpen);
    });

    /**
     * Update the trigger when the optionSelected has changed
     */
    $choosin.choosin.state.subscribe('optionSelected', (newValue, oldValue) => optionSelectedCallback(newValue, oldValue, $choosin));
  };

  /**
   * Searches options for textField.value
   * @param {HTMLElement} $textField The search text field
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const searchCallback = ($textField, $choosin) => {
    const valueToOptionMap = $choosin.choosin.state.get('valueToOptionMap');
    const values = $choosin.choosin.state.get('optionValues');
    const valuesLowerCase = $choosin.choosin.state.get('optionValuesLowerCase');
    let searchString = $textField.value;
    const previousSearch = $choosin.choosin.state.get('previousSearch');

    if (typeof searchString === 'string') {
      searchString = searchString.trim();
    }

    // Don't run search if the query hasn't changed
    if (previousSearch === searchString) return;

    // If the search is blank, make sure all options are visible
    if (!searchString) {
      for (let i = 0; i < values.length; i++) {
        const $option = valueToOptionMap[values[i]];
        if ($option.hidden) $option.hidden = false;
      }
      // Set all options as visible in state
      $choosin.choosin.state.set('visibleOptionValues', $choosin.choosin.state.get('optionValues'));
      return;
    }
    $choosin.choosin.state.set('previousSearch', searchString);
    // If we have a string show matches and hide misses
    const visibleOptionValues = [];
    let isFirstMatch = true;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const valueLowerCase = valuesLowerCase[i];
      const $option = valueToOptionMap[value];
      const isMatch = valueLowerCase.indexOf($textField.value) >= 0;

      if (isMatch) {
        // Make sure it's visible
        if ($option.hidden) $option.hidden = false;
        // Build array of visible values
        visibleOptionValues.push($option.dataset.value);
        //
        if (isFirstMatch) {
          $choosin.choosin.state.set('optionHighlighted', $option);
          isFirstMatch = false;
        }
      }
      else {
        // Hide a non-match option
        if (!$option.hidden) $option.hidden = true;
      }
    }
    $choosin.choosin.state.set('visibleOptionValues', visibleOptionValues);
  };

  /**
   * Adds and sets up options search
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const addSearch = ($choosin) => {
    if ($choosin.choosin.state.get('hasSearch') === true) return;

    const $searchWrapper = $choosin.querySelector('.choosin__searchWrapper');
    $choosin.choosin.elements.searchWrapper = $searchWrapper;

    const hash = generateRandomHash();
    const textFieldId = `csn-searchText-${hash}`;

    // Create textfield
    const $textField = document.createElement('input');
    $textField.setAttribute('type', 'text');
    $textField.classList.add('csn-search__textField');
    $textField.id = textFieldId;

    // Default visible options to all options
    $choosin.choosin.state.set('visibleOptionValues', $choosin.choosin.state.get('optionValues'));

    /**
     * Make sure search can't be called too often
     */
    const debouncedSearch = debounce(
      () => searchCallback($textField, $choosin),
      250
    );
    // Trigger search if the value changes and as the user types
    $textField.addEventListener('change', () => debouncedSearch());
    $textField.addEventListener('keydown', () => debouncedSearch());

    // Create label
    const $textLabel = document.createElement('label');
    $textLabel.classList.add('csn-search__textLabel');
    $textLabel.setAttribute('for', textFieldId);

    // Add them to the DOM
    $searchWrapper.append($textLabel);
    $searchWrapper.append($textField);

    $choosin.choosin.state.set('hasSearch', true);
  }

  /**
   * Utility function to navigate the list of options
   * @param {Number} offset Number of elements to increment, positive is next, negative is previous
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   * // @todo Should be able to navigate when choosin is closed, like select does
   */
  const navigateOptions = (offset, $choosin) => {
    const $optionHighlighted = $choosin.choosin.state.get('optionHighlighted');
    if (!$optionHighlighted) {
      console.warn('choosin: Couldn\'t determine what element was highlighted', {$choosin, $optionHighlighted});
      // Highlight the first option
      $choosin.choosin.state.set('optionHighlighted', $choosin.querySelector('.csn-optionList__option'));
      return;
    }

    // Get current location in the options
    const highlightedValue = $optionHighlighted.dataset?.value;
    const visibleOptionsInOrder = $choosin.choosin.state.get('visibleOptionValues');
    const highlightedIndex = visibleOptionsInOrder.indexOf(highlightedValue);
    // Get the list of options
    const optionsMap = $choosin.choosin.state.get('valueToOptionMap');

    if (highlightedIndex < 0) {
      console.error('choosin: Couldn\'t find highlighted option in state data');
      return;
    }

    let newOffset = offset + highlightedIndex;
    if (newOffset < 0) {
      // If we're above the top, highlight the first one
      newOffset = 0;
    }
    else if (newOffset + 1 > visibleOptionsInOrder.length) {
      // If we're past the last one, highlight the last one
      newOffset = visibleOptionsInOrder.length - 1;
    }

    const newOffsetId = visibleOptionsInOrder[newOffset];
    const $optionToHighlight = optionsMap[newOffsetId];
    $choosin.choosin.state.set('optionHighlighted', $optionToHighlight);
    $optionToHighlight.focus();
  }

  /**
   * Keydown callback for $choosin wrapper
   * @param {KeyboardEvent} event
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const keyboardHandler = (event, $choosin) => {
    switch (event.key) {
      case 'Escape':
        $choosin.choosin.state.set('isOpen', false);
        break;
      case 'ArrowUp':
        event.preventDefault();
        navigateOptions(-1, $choosin);
        break;
      case 'ArrowDown':
        event.preventDefault();
        navigateOptions(1, $choosin);
        break;
      case 'Enter':
        event.preventDefault();
        const $optionHighlighted = $choosin.choosin.state.get('optionHighlighted');
        if ($optionHighlighted) {
          $choosin.choosin.state.set('optionSelected', $optionHighlighted);
        }
        break;
    }
  }

  /**
   * Build out $choosin options from the select element
   * @param {HTMLElement} $select Select element $choosin is based on
   * @param {HTMLElement} $choosin The outer wrapper of the choosin element being build
   */
  const processSelectOptions = ($select, $choosin) => {
    const $optionsWrapper = $choosin.choosin.elements.optionsWrapper;

    // Options values array, to be stored in order
    const optionValues = [];
    const optionValuesLowerCase = [];
    // An object we'll use for search
    const valueToOptionMap = {};
    const valueToSelectOptionMap = {};

    // Iterate over select's children to build out choosin
    for (let index = 0; index < $select.children.length; index++) {
      const $element = $select.children[index];

      if ($element.tagName.toLowerCase() === 'option') {
        const value = $element.value;
        // Make sure we have a value
        if (!value) {
          console.warn('Choosin: Found option in select that is missing a value, skipping it.', $element);
          continue;
        }
        // Make sure the value hasn't appeared already
        if (valueToOptionMap[value]) {
          'Choosin: Option has a redundant value and was hidden',
          {
            'hiddenOption': $element,
            'previousOption': valueToOptionMap[value],
          }
        }

        // Build & populate the choosin option element
        const $choosinOption = document.createElement('button');
        $choosinOption.classList.add('csn-optionList__option');
        $choosinOption.dataset.value = value;
        $choosinOption.innerText = $element.innerText.trim();

        // Add data to our data arrays and objects
        optionValues.push(value);
        optionValuesLowerCase.push(value.toLowerCase());
        valueToOptionMap[value] = $choosinOption;
        valueToSelectOptionMap[value] = $element;

        // If it's a selected element, update state so it knows that
        if ($element.hasAttribute('selected')) {
          $choosin.choosin.state.set('optionSelected', $choosinOption);
        }

        // Add the choosin option to the $choosin element
        $optionsWrapper.append($choosinOption);

        // Add event listeners
        // Change the form value when an option is clicked
        $choosinOption.addEventListener('click', (event) => {
          event.preventDefault();
          $choosin.choosin.state.set('optionSelected', $choosinOption);
        });

        // Update highlighted option on hover
        $choosinOption.addEventListener('mouseover', () => {
          $choosin.choosin.state.set('optionHighlighted', $choosinOption);
        });

        $choosinOption.addEventListener('focus', () => {
          $choosin.choosin.state.set('optionHighlighted', $choosinOption);
        });
      }
    }

    // Update state
    $choosin.choosin.state.set('optionValues', optionValues);
    $choosin.choosin.state.set('optionValuesLowerCase', optionValuesLowerCase);
    $choosin.choosin.state.set('valueToOptionMap', valueToOptionMap);
    $choosin.choosin.state.set('valueToSelectOptionMap', valueToSelectOptionMap);
  }

  /**
   * Build out $choosin options from the select element
   * @param {HTMLElement} $select Select element $choosin is based on
   * @returns {Array} Array of [$choosin, $select]
   */
  const createChoosinFromSelect = ($select) => {
    if ($select.classList.contains('choosin--hide')) return;

    // Get a selected element
    let $optionSelected = $select.querySelector('option[selected]');
    // Create the markup for the new element
    const $choosin = document.createElement('div');
    const $trigger = document.createElement('button');
    const $uiWrapper = document.createElement('div');
    const $searchWrapper = document.createElement('div');
    const $optionsWrapper = document.createElement('ul');

    // If there isn't a selected element, default to the first option
    if (!$optionSelected) {
      $select.querySelector('option');
    }

    $choosin.classList.add('choosin');
    $choosin.dataset.value = $optionSelected.value;

    $trigger.classList.add('choosin__trigger');
    $trigger.innerText = $optionSelected.innerText.trim();
    $choosin.append($trigger);

    $uiWrapper.classList.add('choosin__uiWrapper');
    $choosin.append($uiWrapper);

    $searchWrapper.classList.add('choosin__searchWrapper');
    $uiWrapper.append($searchWrapper);

    $optionsWrapper.classList.add('choosin__optionsWrapper', 'csn-optionList');
    $uiWrapper.append($optionsWrapper);

    ///
    // Initialize state
    ///
    $choosin.choosin = {
      'elements': {
        'optionsWrapper': $optionsWrapper,
        'trigger': $trigger,
        'searchWrapper': $searchWrapper,
      }
    };

    /**
     * State keys and docs
     * @property originalSelect {HTMLElement} Select element choosin was generated from
     * @property isOpen {boolean} Whether or not the choosin is open
     * @property hasSearch {boolean} If search has been initialized
     * @property optionSelected {HTMLElement|null} Currently selected option element that has the value the form element is set to
     * @property optionHighlighted {HTMLElement|null} Currently highlighted option element, highlighting is for UI state for hover and keyboard navigation
     * @property optionValues {Array} An array of all option values in the order that the options appear
     * @property optionValuesLowerCase {Array} The same as optionValues, this is kept for search
     * @property visibleOptionValues {Array} An array of non-hidden option values in the order that the options appear
     * @property valueToOptionMap {Object} An object whose keys are option values and point to the choosin's option element
     * @property valueToSelectOptionMap {Object} An object whose keys are option values and point to the select's option element
     * @property previousSearch {String} Search field value on last search
     * @property dropdownDirection {String} 'up', 'down', or 'none'
     */
    const defaultState = {
      'originalSelect': $select,
      'isOpen': false,
      'hasSearch': false,
      'optionSelected': null,
      'optionHighlighted': null,
      'optionValues': [],
      'optionValuesLowerCase': [],
      'visibleOptionValues': [],
      'valueToOptionMap': {},
      'valueToSelectOptionMap': {},
      'previousSearch': '',
      'dropdownDirection': 'none',
    };
    $choosin.choosin.state = new simpleState(defaultState, 'verbose');

    processSelectOptions($select, $choosin);

    /**
     * Setup basic state subscribers and event handlers
     */
    // Set class for CSS if the dropdown direction is up
    $choosin.choosin.state.subscribe('dropdownDirection', (newValue, oldValue) => {
      if (newValue !== oldValue) {
        if (newValue === 'up') {
          $choosin.classList.add('choosin--dropUp');
        }
        else {
          $choosin.classList.remove('choosin--dropUp');
        }
      }
    });

    // Connect open close behavior to state
    $choosin.choosin.state.subscribe(
      'isOpen',
      (newValue, oldValue) => isOpenCallback(newValue, oldValue, $choosin)
    );

    // Connect option highlighting to state
    $choosin.choosin.state.subscribe(
      'optionHighlighted',
      (newValue, oldValue) => optionHighlightedCallback(newValue, oldValue, $choosin)
    );

    $choosin.addEventListener('keydown', (event) => keyboardHandler(event, $choosin));

    // Add helper methods
    $choosin.choosin.open = () => $choosin.choosin.state.set('isOpen', true);
    $choosin.choosin.close = () => $choosin.choosin.state.set('isOpen', false);

    setupTrigger($choosin);
    addSearch($choosin);

    // Update elements with classes that show we've processed the elements
    $choosin.classList.add('choosin--processed');
    $select.classList.add('choosin--hide');

    // Append the choosin element to the DOM
    $select.after($choosin);
    return [$choosin, $select];
  }

  /**
   * Initialize all choosins on the page
   */
  const init = () => {
    const $choosins = document.querySelectorAll('.choosin');
    let $select;

    // Iterate over choosins and init them
    for (let index = 0; index < $choosins.length; index++) {
      let $choosin = $choosins[index];
      if ($choosin.tagName.toLowerCase() === 'select') {
        createChoosinFromSelect($choosin);
      }
      else {
        console.warn('Choosin: A non-select element has a choosin class, and cannot be processed', {$choosin});
        $choosin.hidden = true;
      }
    }
    // On document clicks, close any choosins that aren't in the click's path
    document.addEventListener('click', (event) => {
      let $choosinInPath;
      const clickPath = event.path;
      const $choosinsOnPage = document.querySelectorAll('.choosin--processed');
      // Quick exit if there aren't any choosins
      if ($choosinsOnPage.length === 0) return;

      // Review the click path and find $choosin element if there is one
      for (let index = 0; index < clickPath.length; index++) {
        const $element = clickPath[index];
        if ($element && $element.classList && $element.classList.contains('choosin')) {
          $choosinInPath = $element;
          break;
        }
      }

      debugLog('Close choosins not in path', {$choosinInPath}, clickPath);
      // Iterate over all $choosins and close any that aren't in the path
      for (let index = 0; index < $choosinsOnPage.length; index++) {
        const $choosin = $choosinsOnPage[index];
        const isOpen = $choosin.choosin.state.get('isOpen');
        if (isOpen && $choosin !== $choosinInPath) {
          $choosin.choosin.state.set('isOpen', false);
        }
      }
    });


  }

  window.addEventListener('DOMContentLoaded', init);

})();