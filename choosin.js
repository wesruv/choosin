"use strict";

(() => {
  const debug = false;

  /**
   * Debounce helper function
   * @see https://davidwalsh.name/javascript-debounce-function
   *
   * @param {function} func Function to be debounced
   * @param {number} delay How long until it will be run
   * @param {boolean} immediate Whether it should be run at the start instead of the end of the debounce
   */
  function debounce(func, delay, immediate = false) {
    var timeout;
    return function () {
      var context = this,
        args = arguments;
      var later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, delay);
      if (callNow) func.apply(context, args);
    };
  }

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
   * Generates a random and unique hash for use in ID's
   */
  const generateRandomHash = () => {
    // Making sure string starts with a letter, since ID's and classes can't start with numbers
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
    return `${randomLetter}${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Simple state class with set, get, subscribe and unsubscribe methods
   * @class
   * @constructor
   * @public
   * @param {object} initialData Object with keys and values of initial data
   * @param {string} logLevel Set to verbose, warnings, errors, none. Defaults to none
   * @param {string} logPrefix String to prefix log messages with
   * @link https://codepen.io/wesruv/pen/abYgJVX?editors=0010
   */
  class simpleState {
    /**
     * Constructor.
     * @param {object} initialData Starting data
     */
    constructor(initialData, logLevel, logPrefix) {
      this.logLevel = logLevel ? logLevel : 'errors';
      this.logPrefix = logPrefix ? logPrefix : '';

      /**
       * List of subscribers in objects separated by dataKey
       * @type {object}
       * @private
       */
      this.subscribers = {};
      /**
       * State data as a simple key value store, fires subscriber callbacks on value changing
       * @type {object}
       * @private
       */
      this.data = initialData && typeof initialData === 'object' ? initialData : {};
    }

    /**
     * Log function that respects logging level
     * @param {string} type Message type, set to log, warn, or error
     * @param  {...any} args What to send to console[type]()
     */
    _log(type, ...args) {
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
     * Get current value of state data
     * @param {string} dataKey Key in state data
     * @return {any} Value of the key from state data
     */
    get = (dataKey) => {
      const currentValue = this.data[dataKey];
      if (currentValue) return currentValue;
      this._log('warn', 'Requested get for data that isn\'t set', {dataKey});
      return;
    }

    /**
     * Get a list of the dataKeys in state
     * @returns {array} List of keys
     */
    getKeys = () => Object.keys(this.data);

    /**
     * Subscribe callback
     * @callback subscribeCallback
     * @param {any} newValue
     * @param {any} oldValue
     */
    /**
     * Subscribe to a key in state data
     * @param {string} dataKey Key in data that callback should be fired for
     * @param {subscribeCallback} callback Callback function when data[dataKey] is updated
     * @returns {number} Current value of subscribed key
     */
    subscribe = (dataKey, callback) => {
      const currentValue = this.data[dataKey];
      // Error cases
      if (!dataKey) {
        this._log('error', `Subscribe failed, invalid key, "${dataKey}"`);
        return;
      }
      if (typeof callback !== 'function') {
        this._log('error', 'Subscribe failed, callback is not a function');
        return;
      }

      // Warning if the dataKey doesn't exist yet, that's not really a problem, but may be the result of a typo.
      if (!currentValue) {
        this._log('warn', `Subscribing to a dataKey that doesn\'t exist yet: "${dataKey}"`);
      }

      // Create an object of subscribers that's very array-like
      // Using an object so keys don't change if one is removed
      if (!this.subscribers[dataKey]) this.subscribers[dataKey] = {
        // Used to create new subscriberKeys
        'lastSubscriberIndex': -1
      };
      // Get the key for the new subscriber
      const subscriberKey = this.subscribers[dataKey].lastSubscriberIndex + 1;
      // Update lastSubscriberIndex so we don't dupe on next subscriber
      this.subscribers[dataKey].lastSubscriberIndex = subscriberKey;

      // Add our subscriber
      this.subscribers[dataKey][subscriberKey] = callback;

      this._log('log', `Subscribed, subscriberKey: ${subscriberKey}`);

      // Add the callback and return the id
      return subscriberKey;
    }

    /**
     * Unsubscribe a certain callback from a certain dataKey
     * @param {string} dataKey Key in data to unsubscribe from
     * @param {number} subscriberId Array index of this.subscribers[dataKey][INDEX] to unsubscribe, is returned from subscribe()
     */
    unsubscribe = (dataKey, subscriberId) => {
      // Error cases
      if (typeof subscriberId !== 'number') {
        subscriberId = parseInt(subscriberId);
        this._log('warn', 'Sent a subscriberId that isn\'t a number, it got converted to', subscriberId);
      }
      if (!dataKey) {
        this._log('error', 'Unsubscribe failed, invalid dataKey', {dataKey});
        return;
      }
      if (!this.subscribers[dataKey]) {
        const subscriberKeys = Object.keys(this.subscribers[dataKey]);
        this._log('error', 'Unsubscribe failed, key does not exist', {dataKey, subscriberKeys});
        return;
      }
      if (!this.subscribers[dataKey][subscriberId]) {
        this._log('error', 'Couldn\'t find subscriberId for the given key', {dataKey, subscriberId});
        return;
      }

      // Do eet already
      delete this.subscribers[dataKey][subscriberId];
      this._log('log', `Unsubscribed "${dataKey}" subscriberId ${subscriberId}`);
    }

    /**
     * Set a value and run subscriber callbacks
     * @param {string} dataKey The key in the data
     * @param {any} newValue Value to be set for that data
     */
    set = (dataKey, newValue) => {
      if (!dataKey || typeof newValue === 'undefined') {
        this._log('error', 'Wasn\'t able to set with dataKey & data provided', {dataKey, newValue});
        return;
      }
      // Store the old value
      const oldValue = this.data[dataKey];
      this.data[dataKey] = newValue;
      this._log('log', `Setting "${dataKey}" to:\n`, newValue);

      // Run callbacks of subscribers to that key
      const subscribersKeys = this.subscribers[dataKey] ? Object.keys(this.subscribers[dataKey]) : [];
      if (subscribersKeys?.length) {
        for (let index = 0; index < subscribersKeys.length; index++) {
          const subscriberKey = subscribersKeys[index];
          if (subscriberKey !== 'lastSubscriberIndex') {
            const callback = this.subscribers[dataKey][subscriberKey];

            if (callback && typeof callback === 'function') {
              this._log('log', `Calling subscriber ${subscriberKey} from "${dataKey}" `);
              callback(newValue, oldValue);
            }
          }
        }
      }
    }
  };

  /**
   * Validate that a HTML Element is the outer wrapper of a choosin
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   * @return {boolean}
   */
  const isChoosinElement = ($choosin) =>
    $choosin && $choosin.classList.contains('choosin');

  /**
   * Open a choosin element
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const openChoosin = ($choosin) => {
    if (!isChoosinElement($choosin)) {
      console.error('openChoosin: Sent a bad element', $choosin);
    }
    $choosin.setAttribute('open', '');
    if ($choosin.choosin.state.get('hasSearch')) {
      const $searchText = $choosin.querySelector('.csn-search__textField');
      if ($searchText) {
        $searchText.focus();
      }
    }
  };

  /**
   * Close a choosin element
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const closeChoosin = ($choosin) => {
    if (!isChoosinElement($choosin)) {
      console.error('closeChoosin: Sent a bad $choosin element', $choosin);
      return;
    }
    $choosin.removeAttribute('open');
  };

  /**
   * Handler for an option being selected
   * @param {Event} event
   * @param {HTMLElement} $option A .csn-dropdown__option element
   */
  const optionSelect = (event, $option, $choosin) => {
    const value = $option.dataset.value;
    if (!value) {
      console.error('Choosin option selected, but it is missing a value', $option);
      return;
    }
    $choosin.choosin.state.set('activeOption', $option);
    closeChoosin($choosin);
  };

  /**
   * Validates and sets up options under the given choosin
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const processOptions = ($choosin) => {
    const $options = $choosin.querySelectorAll('.csn-dropdown__option');
    // An object we'll use for search
    const valuesIndex = {};
    for (let index = 0; index < $options.length; index++) {
      const $option = $options[index];
      const value = $option.dataset.value;
      const valueLowerCase = value && typeof value === 'string' ? value.toLowerCase() : '';
      ///
      // Validate $option
      ///
      if (typeof value !== 'string') {
        $option.hidden = true;
        console.warn('Choosin: Option doesn\'t have a value and was hidden', $option);
        continue;
      }
      if (valuesIndex[valueLowerCase]) {
        // Theres another option with the same value when it's converted to lowercase.
        // HTML is case sensitive, but going to make this case insensitive for now.
        $option.hidden = true;
        console.warn(
          'Choosin: Option has a redundant value and was hidden',
          {
            'hiddenOption':$option,
            'previousOption': valuesIndex[valueLowerCase],
          }
        );
        continue;
      }

      // Adding options as lowercase so search is case insensitive
      valuesIndex[valueLowerCase] = $option;
      $option.addEventListener('click', (event) => optionSelect(event, $option, $choosin));
    }

    // Add values index to state for search
    $choosin.choosin.state.set('valuesIndex', valuesIndex);
  }

  /**
   * Validates and sets up trigger (the always visible dropdown UI)
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const setupTrigger = ($choosin) => {
    if (!isChoosinElement($choosin)) {
      console.error('setupTrigger: Sent a bad $choosin element', $choosin);
    }

    const $trigger = $choosin.querySelector('.choosin__trigger');
    if (!$trigger) {
      console.error('setupTrigger: Couldn\'t get $trigger element from the $choosin element', $choosin);
    }
    $trigger.addEventListener('click', (e) => {
      e.preventDefault();
      $choosin.hasAttribute('open') ? closeChoosin($choosin) : openChoosin($choosin);
    });

    /**
     * Update the trigger when the activeOption has changed
     */
    $choosin.choosin.state.subscribe('activeOption', ($option) => {
      debugLog('fired activeOption subscription', $option);
      const value = $option.dataset.value;
      if (value) {
        $trigger.dataset.value = value;
        $trigger.innerText = value;
      }
    });
  };

  /**
   * Adds and sets up options search
   * @param {HTMLElement} $choosin
   */
  const addSearch = ($choosin) => {
    if ($choosin.choosin.state.get('hasSearch') === true) return;

    const $searchWrapper = $choosin.querySelector('.choosin__search-wrapper');

    const hash = generateRandomHash();
    const textFieldId = `csn-searchText-${hash}`;

    // Create textfield
    const $textField = document.createElement('input');
    $textField.setAttribute('type', 'text');
    $textField.classList.add('csn-search__textField');
    $textField.id = textFieldId;

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
   * Initialize all choosins on the page
   */
  const init = () => {
    const $choosins = document.querySelectorAll('.choosin');

    /**
     * Initialize a choosin element
     * @param {HTMLElement} $choosin The outer wrapper of a choosin element
     */
    const processChoosin = ($choosin) => {
      // Overriding debugLog to check for attribute on $choosin element
      debugLog = (...args) => {
        if (debug || $choosin.hasAttribute('debug')) {
          console.log(...args);
        }
      }

      if ($choosin.classList.contains('choosin--processed')) return;

      $choosin.choosin = {
        'open': () => openChoosin($choosin),
        'close': () => closeChoosin($choosin),
      };

      ///
      // Initialize state
      ///
      if ($choosin.dataset.value) {
        // We have a default value, initialize state with the default value setup
        const defaultValue = $choosin.dataset.value;
        const $itemWithValue = $choosin.querySelector(`.csn-dropdown__option[data-value="${defaultValue}"]`);
        if ($itemWithValue) {
          $choosin.choosin.state = new simpleState({
            'activeOption': $itemWithValue,
          },
          'verbose');
        }
        else {
          console.error(`choosin init: Didn\'t find "${defaultValue}" in options`);
        }
      }
      else {
        // No default value, initialize empty state
        $choosin.choosin.state = new simpleState();
      }

      processOptions($choosin);
      setupTrigger($choosin);
      addSearch($choosin);

      $choosin.classList.add('choosin--processed');
    };

    // On document clicks, close any choosins that aren't in the click's path
    document.addEventListener('click', (event) => {
      let $choosinInPath;
      const clickPath = event.path;
      const $choosinsOnPage = document.querySelectorAll('.choosin');
      // Quick exit if there aren't any choosins
      if ($choosinsOnPage.length === 0) return;

      // Review the click path and find $choosin element if there is one
      for (let index = 0; index < clickPath.length; index++) {
        const $element = clickPath[index];
        if ($element && $element.classList && $element.classList.contains('choosin')) {
          $choosinInPath = $element;
        }
      }

      debugLog('Close choosins not in path', {$choosinInPath}, clickPath);
      // Iterate over all $choosins and close any that aren't in the path
      for (let index = 0; index < $choosinsOnPage.length; index++) {
        const $choosin = $choosins[index];
        if ($choosin.hasAttribute('open') && $choosin !== $choosinInPath) {
          closeChoosin($choosin);
        }
      }
    });

    // Iterate over choosins and init them
    for (let index = 0; index < $choosins.length; index++) {
      processChoosin($choosins[index]);
    }
  }

  window.addEventListener('DOMContentLoaded', init);

})();