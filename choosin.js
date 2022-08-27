"use strict";

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
   * @param {object} initialData Object with keys and values of initial data
   */
  class pubSubState {
    /**
     * Constructor.
     * @param {object} initialData Starting data
     */
    constructor(initialData) {
      this.subscribers = {};
      this.data = initialData && typeof initialData === 'object' ? initialData : {};
    }

    /**
     * Get current value of state data
     * @param {string} dataKey Key in state data
     * @return {any} Value of the key from state data
     */
    get = (dataKey) => {
      const currentValue = this.data[dataKey];
      if (currentValue) return currentValue;
      console.warn('Requested get for data that isn\'t set', {dataKey});
    }

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
      if (!dataKey) {
        console.error('Subscribe failed, invalid key', {dataKey});
        return;
      }
      if (typeof callback !== 'function') {
        console.error('Subscribe failed, callback is not a function');
        return;
      }
      if (!currentValue) {
        console.warn('Subscribing to data key that doesn\'t exist yet.', dataKey);
      }

      // Create array of subscribers, using an object so keys don't change if one is removed
      if (!this.subscribers[dataKey]) this.subscribers[dataKey] = {
        'lastSubscriberIndex': -1
      };
      // Get the key for our new subscriber
      const subscriberKey = this.subscribers[dataKey].lastSubscriberIndex + 1;
      // Update the key in the subscribers data so we don't dupe
      this.subscribers[dataKey].lastSubscriberIndex = subscriberKey;
      // Add our subscriber
      this.subscribers[dataKey][subscriberKey] = callback;

      debugLog('subscribe: subscribed', subscriberKey, this.subscribers);

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
      if (!dataKey) {
        console.error('Unsubscribe failed, invalid dataKey', {dataKey});
        return;
      }
      if (!this.subscribers[dataKey]) {
        const subscriberKeys = Object.keys(this.subscribers[dataKey]);
        console.error('Unsubscribe failed, key does not exist', {dataKey, subscriberKeys});
        return;
      }
      if (!subscriberId) {
        console.error('Unsubscribe failed, invalid subscriberId', {subscriberId});
        return;
      }
      if (!this.subscribers[dataKey][subscriberId]) {
        console.error('Couldn\'t find subscriberId for the given key', {dataKey, subscriberId});
      }

      // Do eet already
      delete this.subscribers[dataKey][subscriberId];
    }

    /**
     * Set a value and run subscriber callbacks
     * @param {string} dataKey The key in the data
     * @param {any} data Value to be set for that data
     */
    set = (dataKey, data) => {
      debugLog('set: start', dataKey, data);
      if (!dataKey || typeof data === 'undefined') {
        console.error('Wasn\'t able to set with dataKey & data provided', {dataKey, data});
        return;
      }
      // Store the old value
      const oldValue = this.data[dataKey];
      this.data[dataKey] = data;

      // Run callbacks of subscribers to that key
      const subscribersKeys = this.subscribers[dataKey] ? Object.keys(this.subscribers[dataKey]) : [];
      if (subscribersKeys?.length) {
        for (let index = 0; index < subscribersKeys.length; index++) {
          const subscriberKey = subscribersKeys[index];
          if (subscriberKey !== 'lastSubscriberIndex') {
            const callback = this.subscribers[dataKey][subscriberKey];

            if (callback && typeof callback === 'function') {
              callback(data, oldValue);
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
    $choosin.state.set('activeOption', $option);
    closeChoosin($choosin);
  };

  /**
   * Validates and sets up options under the given choosin
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const processOptions = ($choosin) => {
    const $options = $choosin.querySelectorAll('.csn-dropdown__option');
    for (let index = 0; index < $options.length; index++) {
      const $option = $options[index];
      if ($option.dataset.value) {
        $option.addEventListener('click', (event) => optionSelect(event, $option, $choosin));
      }
      else {
        $option.hidden = true;
        console.warn('Choosin: Option doesn\'t have a value and was hidden', $option);
      }
    }
  }

  /**
   * Highlight a value for hover/focus/etc
   * @param {HTMLElement} $option The element for a choosin option
   */
  const highlightOption = ($option) => {
    // @todo
  };

  /**
   *
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
    $choosin.state.subscribe('activeOption', ($option) => {
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
    if ($choosin.state.get('hasSearch') === true) return;

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

    $choosin.state.set('hasSearch', true);
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

      ///
      // Initialize state
      ///
      if ($choosin.dataset.value) {
        // We have a default value, initialize state with the default value setup
        const defaultValue = $choosin.dataset.value;
        const $itemWithValue = $choosin.querySelector(`.csn-dropdown__option[data-value="${defaultValue}"]`);
        if ($itemWithValue) {
          $choosin.state = new pubSubState({
            'activeOption': $itemWithValue,
          });
        }
        else {
          console.error(`choosin init: Didn\'t find "${defaultValue}" in options`);
        }
      }
      else {
        // No default value, initialize empty state
        $choosin.state = new pubSubState();
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