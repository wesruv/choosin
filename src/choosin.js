"use strict";

// @todo Disabled state
// @todo handle options group, or other possible select children
// @todo Translations
// @todo Accessibility
// @todo Watch for updates on select element and update choosin
// @todo Ability to turn change debug logging after init

import simpleState from "./modules/SimpleState.js";
import { debounce, generateRandomHash } from "./modules/utilty.js";

/**
 * A no-dependency HTML select UI replacement
 * @class
 * @constructor
 * @public
 * @param {object} $select HTML select element
 * @param {object} options Options object
 * @param {boolean} options.logLevel Set to verbose, warnings, errors, none. Defaults to error
 * @param {boolean} options.logPrefix String to prefix log messages with
 * @link https://codepen.io/wesruv/pen/abYgJVX?editors=0010
 */
class Choosin {
  constructor($select, options) {
    this.logLevel = options && options.logLevel ? logLevel : 'errors';
    this.logPrefix = options && options.logPrefix ? logPrefix : 'Choosin: ';
    this.elements = {};

    const methodsToBind = [
      'log',
      'setDropdownHeightAndDirection',
      'isOpenCallback',
      'optionSelectedCallback',
      'makeSureOptionIsVisible',
      'optionHighlightedCallback',
      'setupDropdownToggle',
      'showAllOptions',
      'checkForValidValue',
      'hasValidValueCallback',
      'searchCallback',
      'setupSearch',
      'navigateOptions',
      'keyboardHandler',
      'processSelectChildren',
      'createChoosinFromSelect',
      'documentClick'
    ];
    // Make sure this always points to the instance of the class
    methodsToBind.forEach((method) => this[method] = this[method].bind(this));

    const $choosin = this.createChoosinFromSelect($select);

    window.choosin = window.choosin || {};
    window.choosin.elements = window.choosin.elements || {};
    window.choosin.elements[$choosin.dataset.csnHash] = $choosin;
  }

  /**
   * Log function that respects logging level
   * @param {string} type Message type, set to log, warn, or error
   * @param {...any} args What to send to console[type]()
   */
  log(type, ...args) {
    if (this.logPrefix) {
      args.unshift(this.logPrefix);
    }
    switch (this.logLevel) {
      case 'verbose':
        if (type === 'log') console.log(...args);
      case 'warnings':
        if (type === 'warn') console.warn(...args);
      case 'errors':
        if (type === 'error') console.error(...args);
    }
  }

  /**
   * Checks the choosin's location on the page and dropdown contents and sets the dropdown height and direction (up or down)
   */
  setDropdownHeightAndDirection() {
    const $choosin = this.elements.choosinWrapper;

    // Set dropdown direction and dropdown height depending on page position and size
    const choosinBoundingClientRect = $choosin.getBoundingClientRect();
    let dropdownDirection;
    let dropdownHeight;

    // See if dropdown would go off of the page
    // Set direction of dropdown based on it's position
    if (choosinBoundingClientRect.top > window.innerHeight / 2) {
      dropdownDirection = 'up';
      // Getting distance from the top of the choosin wrapper to the top of optionList
      dropdownHeight = Math.floor(choosinBoundingClientRect.top - choosinBoundingClientRect.height) - 20;
    }
    else {
      dropdownDirection = 'down';
      dropdownHeight = Math.floor(window.innerHeight - choosinBoundingClientRect.top - choosinBoundingClientRect.height) - 20;
    }

    // Set dropdownDirection state
    this.state.set('dropdownDirection', dropdownDirection);
    $choosin.style.setProperty('--js-choosin__optionList__maxHeight', `${dropdownHeight}px`);
  }

  /**
   * Callback for state change in isOpen
   * @param {boolean} setToOpen New value of isOpen
   * @param {boolean} previousState Old value of isOpen
   */
  isOpenCallback(setToOpen, previousState) {
    const $choosin = this.elements.choosinWrapper;
    // If nothing has changed, no need to do anything
    if (setToOpen === previousState) {
      return;
    }

    /**
     * Open this choosin
     * Private utility function because it shouldn't be called directly
     */
    const _open = () => {
      this.setDropdownHeightAndDirection($choosin);
      // Immediately search options for the current value in the search box
      this.searchCallback();

      document.addEventListener('click', this.documentClick);

      // Open the dropdown
      $choosin.setAttribute('open', '');
      // Accessibility feature
      this.elements.search.setAttribute('aria-expanded', 'true');
      this.elements.dropdownToggle.setAttribute('aria-expanded', 'true');
      // Has to be focusable so keyboard users can scroll
      this.elements.optionsList.setAttribute('tabindex', '0');
      this.elements.optionsList.setAttribute('aria-hidden', 'false');

      const $optionSelected = this.state.get('optionSelected');
      // Highlight an option on open
      if ($optionSelected) {
        // Show the selected option, if there is one
        this.state.set('optionHighlighted', $optionSelected);
        this.makeSureOptionIsVisible($optionSelected, false);
        $optionSelected.setAttribute('aria-selected', 'true'); // Accessibility feature
      }
      else {
        this.log('error', 'There isn\'t a selected option, which shouldn\'t happen.');
        $optionSelected.removeAttribute('aria-selected'); // Accessibility feature
        // Otherwise get the first visible option
        // const visibleOptionHashes = this.state.get('visibleOptionHashes');
        // const optionsMap = this.state.get('optionsMap');
        // const $firstVisibleOption = optionsMap[visibleOptionHashes[0]].choosinOption;
        // this.state.set('optionHighlighted', $firstVisibleOption);
      }

      // Focus on text field if we have search
      // if (this.state.get('hasSearch')) {
      //   const $searchText = $choosin.querySelector('.csn-search__textField');
      //   if ($searchText) {
      //     $searchText.focus();
      //   }
      // }
    }

    /**
     * Close this choosin
     * Private utility function because it shouldn't be called directly
     */
    const _close = () => {
      $choosin.removeAttribute('open');
      document.removeEventListener('click', this.documentClick);
      // Remove state that doesn't apply when closed
      this.state.set('optionHighlighted', null);
      this.state.set('dropdownDirection', 'none');
      // Reset scroll position of choosin
      this.elements.optionsList.scrollTo({'top': 0});
      // Focus the an open/close toggle per a11y best practices, assuming something else hasn't been focused
      if (document.activeElement.closest('.choosin')) {
        this.elements.dropdownToggle.focus();
      }
      // Accessibility features
      this.elements.search.setAttribute('aria-expanded', 'false');
      this.elements.dropdownToggle.setAttribute('aria-expanded', 'false');
      this.elements.optionsList.setAttribute('tabindex', '-1');
      this.elements.optionsList.setAttribute('aria-hidden', 'true');
    };

    // Do the thing!
    if (setToOpen) {
      _open();
    }
    else {
      _close();
    }
  }

  /**
   * Handler for an option being selected
   * @param {HTMLElement} $optionSelected A .csn-optionsList__option element
   * @param {HTMLElement} $optionWasSelected A .csn-optionsList__option element
   */
  optionSelectedCallback($optionSelected, $optionWasSelected) {
    const value = $optionSelected.dataset.value;
    const hash = $optionSelected.dataset.csnHash;
    const $choosin = this.elements.choosinWrapper;
    const $search = this.elements.search;

    // Validate
    if (!value) {
      this.log('warn', 'Option was selected, but it is missing or empty value', $optionSelected);
      this.state.set('hasValidValue', false);
      return;
    }
    if (value && $optionSelected !== $optionWasSelected) {
      if ($optionWasSelected) $optionWasSelected.removeAttribute('aria-selected');
      $optionSelected.setAttribute('aria-selected', 'true');
      $choosin.dataset.value = value;
      if (document.activeElement === this.elements.search) {
        this.elements.search.blur();
      }
      $search.value = $optionSelected.innerText.trim();
      this.elements.dropdownToggle.focus();
    }
    const optionsMap = this.state.get('optionsMap');
    if (optionsMap[hash] && optionsMap[hash].selectOption) optionsMap[hash].selectOption.setAttribute('selected', '') && optionsMap[hash].selectOption.setAttribute('aria-selected', '');// added aria-selected, required for screen readers to work properly
    this.checkForValidValue();
    this.state.set('isOpen', false);
  };

  /**
   * Makes sure given option is in view of scrolling options
   * @param {HTMLElement} $option A .csn-optionsList__option element
   * @param {boolean} smoothScroll Set to true to smooth scroll
   */
  makeSureOptionIsVisible($option, smoothScroll) {
    if (smoothScroll === undefined) smoothScroll = true;
    // Get DOMRects from viewport
    const optionBoundingRect = $option.getBoundingClientRect();
    const $scrollingParent = this.elements.optionsList;
    // Retrieve cached bounding rect for optionsList
    const scrollingParentBoundingRect = $scrollingParent.getBoundingClientRect();


    const scrollingParentTopfromDocumentTop = window.scrollY + scrollingParentBoundingRect.top; // Distance from top of the page
    const optionTopFromDocumentTop = optionBoundingRect.top + window.scrollY + $scrollingParent.scrollTop;
    const optionTopFromScrollingParentTop = optionTopFromDocumentTop - scrollingParentTopfromDocumentTop;

    const optionListVisibleBoundaryTop = $scrollingParent.scrollTop;
    const optionListVisibleBoundaryBottom = optionListVisibleBoundaryTop + $scrollingParent.offsetHeight;

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
   * @param {HTMLElement} $optionToHighlight A .csn-optionsList__option element
   * @param {HTMLElement} $optionWasHighlighted A .csn-optionsList__option element
   */
  optionHighlightedCallback($optionToHighlight, $optionWasHighlighted) {
    const highlightClass = 'csn-optionsList__option--highlight';
    if ($optionToHighlight !== $optionWasHighlighted) {
      if ($optionWasHighlighted) {
        $optionWasHighlighted.classList.remove(highlightClass);
      }
      if ($optionToHighlight) {
        $optionToHighlight.classList.add(highlightClass);
      }
    }
  }

  /**
   * Validates and sets up trigger (the always visible dropdown UI)
   */
  setupDropdownToggle() {
    const $choosin = this.elements.choosinWrapper;
    const $dropdownToggle = this.elements.dropdownToggle;

    $dropdownToggle.id = `csn-dropdownToggle--${$choosin.dataset.csnHash}`;
    $dropdownToggle.setAttribute('aria-controls', this.elements.optionsList.id);
    $dropdownToggle.setAttribute('aria-expanded', false);
    $dropdownToggle.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = this.state.get('isOpen');
      this.state.set('isOpen', !isOpen);
    });
  };

  /**
   * Show all options that may have been hidden by search
   */
  showAllOptions() {
    const optionHashesInOrder = this.state.get('optionHashesInOrder');
    const optionsMap = this.state.get('optionsMap');
    const $optionSelected = this.state.get('optionSelected');
    for (let i = 0; i < optionHashesInOrder.length; i++) {
      const hash = optionHashesInOrder[i];
      const optionData = optionsMap[hash];
      const $option = optionData.choosinOption;
      if ($option.hidden) $option.hidden = false;
    }
    // Set all options as visible in state
    this.state.set('visibleOptionHashes', this.state.get('optionHashesInOrder'));
    this.state.set('optionHighlighted', $optionSelected);
    this.makeSureOptionIsVisible($optionSelected, false);
  }

  /**
   * Checks to see if a valid value is set and there aren't errors in state
   * @returns {boolean} True if choosin, the selected Choosin option and the select element agree on the value
   */
  checkForValidValue() {
    const $choosin = this.elements.choosinWrapper;
    const $optionSelected = this.state.get('optionSelected');
    const $select = this.elements.originalSelect;

    let hasValidValue;

    if (!$optionSelected) {
      this.log('warn', 'No option selected');
      hasValidValue = false;
    }
    if (!$choosin.dataset.value) {
      this.log('warn',
        'Choosin doesn\'t have a value set',
        `$choosin.dataset.value = ${$choosin.dataset.value}`
      );
      // Make sure $select element also has no value
      if ($select.value) {
        $select.selectedInex = -1;
      }
      hasValidValue = false;
    }
    if ($choosin.dataset.value !== $optionSelected.dataset.value) {
      this.log('error',
        'Choosin value doesn\'t match selectedOptions value',
        `$choosin.dataset.value = ${$choosin.dataset.value}`,
        `$optionSelected.dataset.value = ${$optionSelected.dataset.value}`
      );
      hasValidValue = false;
    }
    if (this.elements.search.value.trim() !== $optionSelected.innerText.trim()) {
      this.log('warn',
        'Choosin search box text doesn\'t match the selected option\'s text',
        `this.elements.search.value.trim() = ${this.elements.search.value.trim()}`,
        `$optionSelected.innerText.trim() = ${$optionSelected.innerText.trim()}`
      );
      hasValidValue = false;
    }
    if ($select.value !== $choosin.dataset.value) {
      this.log('error',
        'Choosin value is set and does not match the select element\'s value.',
        `$choosin.dataset.value = ${$choosin.dataset.value}`,
        `$select.value = ${$select.value}`
      );
      hasValidValue = false;
    }
    else if (typeof hasValidValue === 'undefined') {
      hasValidValue = true;
    }

    // Force hasValidValue to a boolean
    hasValidValue = !!hasValidValue;

    this.state.set('hasValidValue', hasValidValue);
    return hasValidValue;
  }

  /**
   * Callback for state changes to isValid
   * @param {boolean} isValid Value of choosin passed validation and matches state and select
   * @param {boolean} previousState The previous value
   */
  hasValidValueCallback(isValid, previousState) {
    // If nothing has changed, don't do anything
    if (isValid === previousState) return;

    if (isValid) {
      this.elements.choosinWrapper.classList.add('choosin--hasValidValue');
      // @todo Set accessible feedback
      this.elements.status.innerText = '✓';
    }
    else {
      this.elements.choosinWrapper.classList.remove('choosin--hasValidValue');
      // @todo Set accessible feedback
      this.elements.status.innerText = 'x';
    }
  }

  /**
   * Searches options for textField.value
   */
  searchCallback() {
    const $search = this.elements.search;
    const optionHashesInOrder = this.state.get('optionHashesInOrder');
    const optionsMap = this.state.get('optionsMap');
    const previousSearch = this.state.get('previousSearch');
    let searchQuery = $search.value;

    if (typeof searchQuery === 'string') {
      searchQuery = searchQuery.trim().toLowerCase();
    }

    // Don't run search if the query hasn't changed
    if (previousSearch === searchQuery) {
      this.log('log', 'Search aborted, the search value hasn\'t changed', {previousSearch, searchQuery});
      return;
    }

    this.state.set('previousSearch', searchQuery);

    // Show everything if search is blank
    if (!searchQuery) {
      this.log('log', 'Search empty, showing all options.');
      this.showAllOptions();
      this.state.set('hasValidValue', false);
      return;
    }
    this.log('log', 'Starting search', {previousSearch, searchQuery});
    // If we have a string show matches and hide misses
    const visibleOptionHashes = [];
    let isFirstMatch = true;
    for (let i = 0; i < optionHashesInOrder.length; i++) {
      const hash = optionHashesInOrder[i];
      const optionData = optionsMap[hash];
      const searchString = optionData.searchString;
      const $option = optionData.choosinOption;
      const isMatch = searchString.indexOf(searchQuery) >= 0;
      if (isMatch) {
        // Make sure it's visible
        if ($option.hidden) $option.hidden = false;
        // Build array of visible values
        visibleOptionHashes.push(hash);
        // Highlight the first visible option after a search
        if (isFirstMatch) {
          this.state.set('optionHighlighted', $option);
          isFirstMatch = false;
        }
      }
      else {
        // Hide a non-match option
        if (!$option.hidden) $option.hidden = true;
      }
    }
    this.state.set('visibleOptionHashes', visibleOptionHashes);
    this.checkForValidValue();
  };

  /**
   * Adds and sets up options search
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  setupSearch() {
    if (this.state.get('hasSearch') === true) return;

    const $search = this.elements.search;
    const $optionSelected = this.state.get('optionSelected');
    if (!$search) {
      this.log('error', 'Couldn\'t get $search element from the $choosin element', $choosin);
    }

    // Hash to create ID for HTML ID's in form
    // const hash = generateRandomHash();

    $search.addEventListener('click', (event) => {
      event.preventDefault();
      // const isOpen = this.state.get('isOpen');
      // this.state.set('isOpen', !isOpen);
      // @todo Think a click in the search box should always open the dropdown now
      this.state.set('isOpen', true);
    });

    $search.classList.add('choosin__searchBox');
    $search.value = $optionSelected.innerText.trim();
    // Accessibility features
    $search.setAttribute('role', 'combobox');
    $search.setAttribute('aria-autocomplete', 'list');
    $search.setAttribute('aria-controls', this.elements.optionsList.id);
    $search.setAttribute('aria-expanded', 'false');
    $search.setAttribute('aria-label', this.elements.selectLabel.textContent.trim());

    // Create clear button
    // const $clearSearch = document.createElement('button');
    // $clearSearch.classList.add('csn-search__clear');
    // $clearSearch.setAttribute('tabindex', '-1'); // Accessibility features
    // // @todo: translate?
    // $clearSearch.setAttribute('aria-label', 'Clear search');
    // // @todo Translate?
    // //@todo: KS - suggest to change from using .innerHTMl since it adds security issues
    // $clearSearch.innerHTML = '<span class="visually-hidden">Clear search</span>';
    // $clearSearch.addEventListener('click', () => {
    //   $textField.value = '';
    //   this.showAllOptions();
    // });

    // Default visible options to all options
    this.state.set('visibleOptionHashes', this.state.get('optionHashesInOrder'));

    /**
     * Make sure search can't be called too often
     */
    this.debouncedSearch = debounce(
      () => this.searchCallback(),
      250
    );
    // Trigger search if the value changes and as the user types
    $search.addEventListener('change', () => this.debouncedSearch());
    $search.addEventListener('keydown', () => this.debouncedSearch());

    // this.elements.search.clear = $clearSearch;

    this.state.set('hasSearch', true);
  }

  /**
   * Utility function to navigate the list of options
   * @param {Number} offset Number of elements to increment, positive is next, negative is previous
   * // @todo Should be able to navigate when choosin is closed, like select does
   */
  navigateOptions(offset) {
    const $choosin = this.elements.choosinWrapper;
    const $optionHighlighted = this.state.get('optionHighlighted');
    if (!$optionHighlighted) {
      this.log('warn', 'Couldn\'t determine what element was highlighted', {$choosin, $optionHighlighted});
      // Highlight the first option
      this.state.set('optionHighlighted', $choosin.querySelector('.csn-optionsList__option'));
      return;
    }

    // Get current location in the options
    const highlightedHash = $optionHighlighted.dataset.csnHash;
    const visibleOptionsInOrder = this.state.get('visibleOptionHashes');
    const highlightedIndex = visibleOptionsInOrder.indexOf(highlightedHash);
    // Get the list of options
    const optionsMap = this.state.get('optionsMap');

    if (highlightedIndex < 0) {
      this.log('error', 'Couldn\'t find highlighted option in state data');
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

    const newOptionHash = visibleOptionsInOrder[newOffset];
    const $optionToHighlight = optionsMap[newOptionHash].choosinOption;
    this.state.set('optionHighlighted', $optionToHighlight);
    $optionToHighlight.focus();
  }

  /**
   * Keydown callback for $choosin wrapper
   * @param {KeyboardEvent} event
   */
  keyboardHandler(event) {
    const $choosin = this.elements.choosinWrapper;

    // @todo: KS - need to add the proper arrow key functionality
    // https://codepen.io/kelsS/pen/wvXvEKW/8dd3aed6aebf70992f27f916715c5bf3
    // https://www.w3.org/WAI/ARIA/apg/example-index/combobox/combobox-autocomplete-list.html
    // https://www.w3.org/WAI/ARIA/apg/patterns/combobox/#keyboard-interaction-6
    switch (event.key) {
      case 'Escape':
        this.state.set('isOpen', false);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.navigateOptions(-1, $choosin);
        // this.document.activeElement.focus()
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.navigateOptions(1, $choosin);

        // this.document.activeElement.focus()
        break;
      case 'Enter':
        const $optionHighlighted = this.state.get('optionHighlighted');
        if (this.state.get('isOpen') && $optionHighlighted) {
          event.preventDefault();
          this.elements.search.value = $optionHighlighted.innerText.trim();
          this.state.set('optionSelected', $optionHighlighted);
        }
    }
  }

  /**
   * Creates a choosin option based on a select option
   * @param {HTMLElement} $option option tag to create a choosin option from
   * @returns {HTMLElement} Choosin option
   */
  processOption($option) {
    const hash = generateRandomHash();
    const value = $option.value;

    // Add a hash to the select option to tie it to the choosin option
    $option.dataset.csnHash = hash;

    // Build & populate the choosin option element
    const $choosinOption = document.createElement('li');
    // Accessibility feature - role: option
    $choosinOption.setAttribute('role', 'option');
    $choosinOption.dataset.csnHash = hash;
    $choosinOption.classList.add('csn-optionsList__option');
    $choosinOption.dataset.value = value;
    $choosinOption.innerText = $option.innerText.trim();

    // If it's a selected element, update state so it knows that
    if ($option.hasAttribute('selected')) {
      this.state.set('optionSelected', $choosinOption);
    }

    // Add event listeners
    // Change the form value when an option is clicked
    $choosinOption.addEventListener('click', (event) => {
      event.preventDefault();
      this.state.set('optionSelected', $choosinOption);
    });

    // Update highlighted option on hover
    $choosinOption.addEventListener('mouseover', () => {
      this.state.set('optionHighlighted', $choosinOption);
    });

    $choosinOption.addEventListener('focus', () => {
      this.state.set('optionHighlighted', $choosinOption);
    });

    return $choosinOption;
  }

  /**
   * Build out $choosin options from the select element
   * @param {HTMLElement} $select Select element $choosin is based on
   */
  processSelectChildren($select) {
    const $optionsList = this.elements.optionsList;

    const optionsMap = {};
    // An array of hashes in DOM order, for when that's needed.
    const optionHashesInOrder = [];

    // Iterate over select's children to build out choosin
    for (let index = 0; index < $select.children.length; index++) {
      const $element = $select.children[index];

      if ($element.tagName.toLowerCase() === 'option') {
        const value = $element.value;
        // Make sure we have a value
        if (!value) {
          this.log('warn', 'Found option in select that is missing a value, skipping it.', $element);
          continue;
        }

        const $choosinOption = this.processOption($element);
        const hash = $choosinOption.dataset.csnHash;
        optionHashesInOrder.push(hash);

        // Add data to our data arrays and objects
        optionsMap[hash] = {
          'value': value,
          'searchString': value.toLowerCase(),
          'choosinOption': $choosinOption,
          'selectOption': $element,
        }

        // Add the choosin option to the $choosin element
        $optionsList.append($choosinOption);
      }
    }

    // Update state
    this.state.set('optionsMap', optionsMap);
    this.state.set('optionHashesInOrder', optionHashesInOrder);
  }

  /**
   * Build out $choosin options from the select element
   * @param {HTMLElement} $select Select element $choosin is based on
   * @returns {Array} Array of [$choosin, $select]
   */
  createChoosinFromSelect($select) {
    if ($select.classList.contains('choosin--hide')) return;

    // Check for required HTML elements
    if (!$select.id) {
      this.log('error', 'Select element requires an id and a label element with the for attribute pointed at the select\'s id.', $select);
      return;
    }
    const $selectLabel = document.querySelector(`label[for='${$select.id}']`);
    if (!$selectLabel) {
      this.log('error', 'Couldn\'t find label pointed at select\'s ID. Select element requires an id and a label element with the for attribute pointed at the select\'s id.', $select);
      return;
    }

    // Get a selected element
    let $optionSelected = $select.querySelector('option[selected]');

    // Create the markup for the new element
    const $choosin = document.createElement('div');
    const $search = document.createElement('input');
    const $dropdownToggle = document.createElement('button');
    const $optionsList = document.createElement('ul');
    const $status = document.createElement('div');

    $status.classList.add('choosin__status');

    // Accessibility features
    $optionsList.setAttribute('tabindex', '-1');
    $optionsList.setAttribute('aria-hidden', 'true');
    $optionsList.setAttribute('role', 'listbox');

    $dropdownToggle.classList.add('choosin__dropdownToggle');
    // @todo Translate
    $dropdownToggle.innerHTML =
      `<span class="choosin__toggle-text choosin__toggle-text--is-closed">Show options</span>
      <span class="choosin__toggle-text choosin__toggle-text--is-open">Hide options</span>`;

    $choosin.dataset.csnHash = generateRandomHash();
    $select.dataset.csnHash = $choosin.dataset.csnHash;

    // If there isn't a selected element, default to the first option
    if (!$optionSelected) {
      $select.querySelector('option');
    }

    $choosin.classList.add('choosin');
    $choosin.dataset.value = $optionSelected.value;
    $choosin.dataset.selectId = $select.id;

    $optionsList.id = `csn-optionsList--${$choosin.dataset.csnHash}`;
    $optionsList.classList.add('choosin__optionsList', 'csn-optionsList');

    // Append everything to the choosin
    $choosin.append($search, $dropdownToggle, $status, $optionsList);

    $selectLabel.setAttribute('for', $optionsList.id);

    $selectLabel.addEventListener('click', (event) => {
      event.preventDefault();
      this.elements.search.focus();
      this.elements.search.select();
      this.state.set('isOpen', true);
    });

    /**
     * Elements reference
     * @property choosinWrapper {HTMLElement} Choosin's main wrapper
     * @property optionsList {HTMLElement} Choosin's ul wrapper for the the options
     * @property dropdownToggle {HTMLElement} The main choosin button that expands/collapses the options
     * @property search {HTMLElement} The text field that reflects the current value/searches the list
     * @property originalSelect {HTMLElement} Select element choosin was generated from
     */
    this.elements = {
      'choosinWrapper': $choosin,
      'optionsList': $optionsList,
      'dropdownToggle': $dropdownToggle,
      'search': $search,
      'status': $status,
      'originalSelect': $select,
      'selectLabel': $selectLabel,
    };

    /**
     * Initialize choosin state
     *
     * @property optionsMap {object}
     * @property optionsMap.choosinOption {HTMLElement} Reference to choosin option element
     * @property optionsMap.selectoption {HTMLElement} Reference to original option in select element
     * @property optionsMap.value {string} Form value of option
     * @property optionsMap.searchString {string} String to use in search function based on innerText of option
     *
     * @property optionsHashesInOrder {array} List of hashes in DOM order
     * @property visibleOptionHashes {Array} An array of non-hidden option values in the order that the options appear
     * @property optionSelected {HTMLElement|null} Currently selected option element that has the value the form element is set to
     * @property optionHighlighted {HTMLElement|null} Currently highlighted option element, highlighting is for UI state for hover and keyboard navigation
     * @property isOpen {boolean} Whether or not the choosin is open
     * @property dropdownDirection {String} 'up', 'down', or 'none'
     * @property hasSearch {boolean} If search has been initialized
     * @property previousSearch {String} Search field value on last search
     * @property isRequired {boolean} Whether or not this form element is required
     */
    const defaultState = {
      'optionsMap': {},
      'optionsHashesInOrder': [],
      'visibleOptionHashes': [],
      'optionSelected': null,
      'optionHighlighted': null,
      'isOpen': false,
      'dropdownDirection': 'none',
      'hasSearch': false,
      'previousSearch': '',
      'hasValidValue': false,
      // @todo Handle required behavior
      'isRequired': $select.hasAttribute('required'),
    };
    this.state = new simpleState(defaultState, 'verbose');

    /**
     * Setup basic state subscribers and event handlers
     */
    // Setup callback for when an option is selected
    this.state.subscribe('optionSelected',
      (newValue, oldValue) => this.optionSelectedCallback(newValue, oldValue)
    );

    // Set class for CSS if the dropdown direction is up
    this.state.subscribe('dropdownDirection', (newValue, oldValue) => {
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
    this.state.subscribe('isOpen', this.isOpenCallback);

    // Connect option highlighting to state
    this.state.subscribe('optionHighlighted', this.optionHighlightedCallback);

    // Connect value checking to state
    this.state.subscribe('hasValidValue', this.hasValidValueCallback);

    $choosin.addEventListener('keydown', (event) => this.keyboardHandler(event, $choosin));

    /**
     * Add helper methods to DOM element
     * @property open {function} Opens the choosin element
     * @property close {function} Closes the choosin element
     */
    $choosin.choosin = {
      'open': () => this.state.set('isOpen', true),
      'close': () => this.state.set('isOpen', false),
      'selectElement': $select,
    };

    // Make the elements and wire them in
    this.processSelectChildren($select, $choosin);
    this.setupDropdownToggle($choosin);
    this.setupSearch($choosin);

    // Update elements with classes that show we've processed the elements
    $choosin.classList.add('choosin--processed');
    $select.classList.add('choosin--hide');

    // Append the choosin element to the DOM
    $select.after($choosin);
    return $choosin;
  }

  /**
   * Click event handler that closes open choosin for clicks outside of it
   * @param {Object} event Event from click event
   */
  documentClick(event) {
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
      else if ($element === this.elements.selectLabel) {
        $choosinInPath = this.elements.choosinWrapper;
      }
    }

    this.log('log', 'Close choosins not in path', {$choosinInPath}, clickPath);
    // Iterate over all $choosins and close any that aren't in the path
    for (let index = 0; index < $choosinsOnPage.length; index++) {
      const $choosin = $choosinsOnPage[index];
      const isOpen = this.state.get('isOpen');
      if (isOpen && $choosin !== $choosinInPath) {
        this.state.set('isOpen', false);
      }
    }
  }
}

export default Choosin;
