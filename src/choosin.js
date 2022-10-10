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
      'setupTrigger',
      'showAllOptions',
      'searchCallback',
      'addSearch',
      'navigateOptions',
      'keyboardHandler',
      'processSelectChildren',
      'createChoosinFromSelect',
      'documentClick'
    ];
    // Make sure this always points to the instance of the class
    methodsToBind.forEach((method) => this[method] = this[method].bind(this));

    const $choosin = this.createChoosinFromSelect($select);

    if (!window.choosin) {
      // On document clicks, close any choosins that aren't in the click's path
      document.addEventListener('click', this.documentClick);
    }

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
    const optionsListBoundingClientRect = this.elements.optionsList.getBoundingClientRect();
    let dropdownDirection;
    let dropdownHeight;

    // See if dropdown would go off of the page
    if (optionsListBoundingClientRect.top + optionsListBoundingClientRect.height > window.innerHeight) {
      // Set direction of dropdown based on it's position
      if (optionsListBoundingClientRect.top > window.innerHeight / 2) {
        dropdownDirection = 'up';
        // Getting distance from the top of the choosin wrapper to the top of optionList
        let offsetFromElements = $choosin.offsetHeight;
        const $searchWrapper = this.elements?.search?.wrapper;
        if ($searchWrapper && $searchWrapper.offsetHeight) {
          // Count the search offset twice
          // The first time is because everything's rendered downward, and we're getting the location of the top of the choosin wrapper
          // A second time to get the right height for the optionList, the search will be inbetween the top of the choosin wrapper, and the optionlist
          offsetFromElements += $searchWrapper.offsetHeight * 2;
        }
        dropdownHeight = Math.floor(optionsListBoundingClientRect.top - offsetFromElements) - 20;
      }
      else {
        dropdownDirection = 'down';
        dropdownHeight = Math.floor(window.innerHeight - optionsListBoundingClientRect.top) - 20;
      }

      // Set dropdownDirection state
      this.state.set('dropdownDirection', dropdownDirection);
      $choosin.style.setProperty('--js-choosin__optionList__maxHeight', `${dropdownHeight}px`);
    }
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

      // Open the dropdown
      $choosin.setAttribute('open', '');
      // Accessibility feature
      this.elements.trigger.setAttribute('aria-expanded', 'true');

      const $optionSelected = this.state.get('optionSelected');
      // Highlight an option on open
      if ($optionSelected) {
        // Choose the selected option, if there is one
        this.state.set('optionHighlighted', $optionSelected);
        this.makeSureOptionIsVisible($optionSelected, false);
      }
      else {
        this.log('error', 'There isn\'t a selected option, which shouldn\'t happen.');
        // // Otherwise get the first visible option
        // const visibleOptionHashes = this.state.get('visibleOptionHashes');
        // const optionsMap = this.state.get('optionsMap');
        // const $firstVisibleOption = optionsMap[visibleOptionHashes[0]].choosinOption;
        // this.state.set('optionHighlighted', $firstVisibleOption);
      }

      // Focus on text field if we have search
      if (this.state.get('hasSearch')) {
        const $searchText = $choosin.querySelector('.csn-search__textField');
        if ($searchText) {
          $searchText.focus();
        }
      }
    }

    /**
     * Close this choosin
     * Private utility function because it shouldn't be called directly
     */
    const _close = () => {
      $choosin.removeAttribute('open');
      // Remove state that doesn't apply when closed
      this.state.set('optionHighlighted', null);
      this.state.set('dropdownDirection', 'none');
      // Reset scroll position of choosin
      this.elements.optionsList.scrollTo({'top': 0});
      // Focus the trigger per a11y best practices, assuming something else hasn't been focused
      if (document.activeElement.closest('.choosin')) {
        this.elements.trigger.focus();
      }
      this.elements.trigger.setAttribute('aria-expanded', 'false');
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
   * @param {HTMLElement} $optionSelected A .csn-optionList__option element
   * @param {HTMLElement} $optionWasSelected A .csn-optionList__option element
   */
  optionSelectedCallback($optionSelected, $optionWasSelected) {
    const value = $optionSelected.dataset.value;
    const hash = $optionSelected.dataset.csnHash;
    const $choosin = this.elements.choosinWrapper;
    if (!value) {
      this.log('error', 'Option selected, but it is missing a value', $optionSelected);
      return;
    }
    const $trigger = this.elements.trigger;
    if (value && $optionSelected !== $optionWasSelected) {
      if ($optionWasSelected) $optionWasSelected.removeAttribute('aria-selected');
      $optionSelected.setAttribute('aria-selected', 'true');
      $choosin.dataset.value = value;
      $trigger.innerText = $optionSelected.innerText;
    }
    const optionsMap = this.state.get('optionsMap');
    if (optionsMap[hash] && optionsMap[hash].selectOption) optionsMap[hash].selectOption.setAttribute('selected', '');
    this.state.set('isOpen', false);
  };

  /**
   * Makes sure given option is in view of scrolling options
   * @param {HTMLElement} $option A .csn-optionList__option element
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
   * @param {HTMLElement} $optionToHighlight A .csn-optionList__option element
   * @param {HTMLElement} $optionWasHighlighted A .csn-optionList__option element
   */
  optionHighlightedCallback($optionToHighlight, $optionWasHighlighted) {
    const highlightClass = 'csn-optionList__option--highlight';
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
  setupTrigger() {
    const $choosin = this.elements.choosinWrapper;
    const $trigger = this.elements.trigger;
    if (!$trigger) {
      this.log('error', 'Couldn\'t get $trigger element from the $choosin element', $choosin);
    }

    $trigger.addEventListener('click', (event) => {
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
   * Searches options for textField.value
   */
  searchCallback() {
    const $textField = this.elements.search.text;
    const optionHashesInOrder = this.state.get('optionHashesInOrder');
    const optionsMap = this.state.get('optionsMap');
    const previousSearch = this.state.get('previousSearch');
    let searchString = $textField.value;

    if (typeof searchString === 'string') {
      searchString = searchString.trim().toLowerCase();
    }

    // Don't run search if the query hasn't changed
    if (previousSearch === searchString) {
      this.log('log', 'Search aborted, the search value hasn\'t changed', {previousSearch, searchString});
      return;
    }

    // Show everything if search is blank
    if (!searchString) {
      this.log('log', 'Search empty, showing all options.');
      this.showAllOptions();
      return;
    }
    this.log('log', 'Starting search', {previousSearch, searchString});
    this.state.set('previousSearch', searchString);
    // If we have a string show matches and hide misses
    const visibleOptionHashes = [];
    let isFirstMatch = true;
    for (let i = 0; i < optionHashesInOrder.length; i++) {
      const hash = optionHashesInOrder[i];
      const optionData = optionsMap[hash];
      const searchString = optionData.searchString;
      const $option = optionData.choosinOption;
      const isMatch = searchString.indexOf($textField.value) >= 0;
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
  };

  /**
   * Adds and sets up options search
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  addSearch() {
    if (this.state.get('hasSearch') === true) return;

    const $searchWrapper = this.elements.search.wrapper;

    const hash = generateRandomHash();
    const textFieldId = `csn-searchText-${hash}`;

    // Create textfield
    const $textField = document.createElement('input');
    $textField.setAttribute('type', 'text');
    $textField.classList.add('csn-search__textField');
    $textField.id = textFieldId;
    // Accessibility features
    // $textField.setAttribute('value', 'United States')
    // $textField.setAttribute('role', 'combobox');
    // $textField.setAttribute('aria-autocomplete', 'list');
    // $textField.setAttribute('aria-controls', '');

    // Create clear button
    const $clearSearch = document.createElement('button');
    $clearSearch.classList.add('csn-search__clear');
    // Accessibility features
    $clearSearch.setAttribute('tabindex', '-1');
    // @todo: translate?
    $clearSearch.setAttribute('aria-label', 'Clear search');
    // $clearSearch.setAttribute('aria-expanded', 'false');
    // @todo Translate?
    //@todo: change from using .innerHTMl since it adds security issues
    $clearSearch.innerHTML = '<span class="visually-hidden">Clear search</span>';
    $clearSearch.addEventListener('click', () => {
      $textField.value = '';
      this.showAllOptions();
    });

    // Default visible options to all options
    this.state.set('visibleOptionHashes', this.state.get('optionHashesInOrder'));

    /**
     * Make sure search can't be called too often
     */
    const debouncedSearch = debounce(
      () => this.searchCallback($textField),
      250
    );
    // Trigger search if the value changes and as the user types
    $textField.addEventListener('change', () => debouncedSearch());
    $textField.addEventListener('keydown', () => debouncedSearch());

    // Create label
    const $textLabel = document.createElement('label');
    $textLabel.classList.add('csn-search__textLabel', 'visually-hidden');
    $textLabel.setAttribute('for', textFieldId);
    // @todo Translate?
    $textLabel.innerText = 'Search the options in the dropdown';

    // Add them to the DOM
    $searchWrapper.append($textLabel, $textField, $clearSearch);

    this.elements.search.text = $textField;
    this.elements.search.clear = $clearSearch;

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
      this.state.set('optionHighlighted', $choosin.querySelector('.csn-optionList__option'));
      return;
    }

    // Get current location in the options
    const optionHashesInOrder = this.state.get('optionHashesInOrder');
    const highlightedHash = $optionHighlighted.dataset.csnHash;
    const visibleOptionsInOrder = this.state.get('visibleOptionHashes');
    const highlightedIndex = optionHashesInOrder.indexOf(highlightedHash);
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

    switch (event.key) {
      case 'Escape':
        this.state.set('isOpen', false);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.navigateOptions(-1, $choosin);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.navigateOptions(1, $choosin);
        break;
      case 'Enter':
        event.preventDefault();
        const $optionHighlighted = this.state.get('optionHighlighted');
        if ($optionHighlighted) {
          this.state.set('optionSelected', $optionHighlighted);
        }
        break;
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
    const $choosinOption = document.createElement('option');
    $choosinOption.dataset.csnHash = hash;
    $choosinOption.classList.add('csn-optionList__option');
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
        const $liWrapper = document.createElement('li');
        $liWrapper.classList.add('csn-optionList__item-wrapper');

        // Add data to our data arrays and objects
        optionsMap[hash] = {
          'value': value,
          'searchString': value.toLowerCase(),
          'choosinOption': $choosinOption,
          'selectOption': $element,
        }

        // Add the choosin option to the $choosin element
        $liWrapper.append($choosinOption);
        $optionsList.append($liWrapper);
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

    // Get a selected element
    let $optionSelected = $select.querySelector('option[selected]');
    // Create the markup for the new element
    const $choosin = document.createElement('div');
    const $trigger = document.createElement('input');
    const $uiWrapper = document.createElement('div');
    const $searchWrapper = document.createElement('div');
    const $optionsList = document.createElement('ul');

    $choosin.dataset.csnHash = generateRandomHash();
    $select.dataset.csnHash = $choosin.dataset.csnHash;

    // If there isn't a selected element, default to the first option
    if (!$optionSelected) {
      $select.querySelector('option');
    }

    $choosin.classList.add('choosin');
    $choosin.dataset.value = $optionSelected.value;

    $trigger.classList.add('choosin__trigger');
    $trigger.innerText = $optionSelected.innerText.trim();
    // Accessibility features
    // @todo: to translate?
    $trigger.setAttribute('value', 'United States')
    $trigger.setAttribute('role', 'combobox');
    $trigger.setAttribute('aria-autocomplete', 'list');
    $trigger.setAttribute('aria-controls', 'uiWrapper');
    $trigger.setAttribute('aria-expanded', 'false');

    $uiWrapper.classList.add('choosin__uiWrapper');
    // Accessibility feature
    $uiWrapper.setAttribute('id', 'uiWrapper');
    $searchWrapper.classList.add('choosin__searchWrapper', 'csn-search');
    $optionsList.classList.add('choosin__optionsList', 'csn-optionList');

    $uiWrapper.append($searchWrapper, $optionsList);
    $choosin.append($trigger, $uiWrapper);

    /**
     * Elements reference
     * @property optionsList {HTMLElement} Choosin's ul wrapper for the the options
     * @property trigger {HTMLElement} The main choosin button that expands/collapses the options
     * @property searchWrapper {HTMLElement} The wrapper around the search form
     * @property originalSelect {HTMLElement} Select element choosin was generated from
     */
    this.elements = {
      'choosinWrapper': $choosin,
      'optionsList': $optionsList,
      'trigger': $trigger,
      'originalSelect': $select,
      'search': {
        'wrapper': $searchWrapper,
      },
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
    this.state.subscribe('isOpen',
      (newValue, oldValue) => this.isOpenCallback(newValue, oldValue, $choosin)
    );

    // Connect option highlighting to state
    this.state.subscribe(
      'optionHighlighted',
      (newValue, oldValue) => this.optionHighlightedCallback(newValue, oldValue, $choosin)
    );

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
    this.setupTrigger($choosin);
    this.addSearch($choosin);

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
