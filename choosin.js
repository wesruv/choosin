"use strict";

(() => {
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
     * Subscribe to a key in state data
     * @param {string} dataKey Key in data that callback should be fired for
     * @param {function} callback Callback function when data[dataKey] is updated,
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
        console.warn('Subscribing to data key that doesn\'t exist yet.');
      }

      // Create array of subscribers, using an object so keys don't change if one is removed
      if (!this.subscribers[dataKey]) this.subscribers[dataKey] = {lastSubscriberIndex: -1};
      // Get the key for our new subscriber
      const nextSubscriberKey = this.subscribers[dataKey].lastSubscriberIndex++;
      // Update the key in the subscribers data so we don't dupe
      this.subscribers[dataKey].lastSubscriberIndex = nextSubscriberKey;
      // Add our subscriber
      this.subscribers[dataKey][nextSubscriberKey] = callback;
      // Add the callback and return the id
      return nextSubscriberKey;
    }

    /**
     *
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
        const subscriberKeys = Object.keys(this.subscribers);
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
      if (!dataKey || typeof data === 'undefined') {
        console.error('Wasn\'t able to set with dataKey & data provided', {dataKey, data});
        return;
      }
      this.data[dataKey] = data;
      // Run callbacks of subscribers to that key
      if (this.subscribers[dataKey]?.length) {
        for (let index = 0; index < this.subscribers[dataKey].length; index++) {
          const callback = this.subscribers[dataKey][index];
          callback(data);
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
    !$choosin || !$choosin.classList.contains('choosin');

   /**
    * Open a choosin element
    * @param {HTMLElement} $choosin The outer wrapper of a choosin element
    */
   const openChoosin = ($choosin) => {
     if (isChoosinElement($choosin)) {
       console.error('openChoosins: Sent a bad element', $choosin);
     }
     $choosin.setAttribute('open', '');
   };

   /**
    * Close a choosin element
    * @param {HTMLElement} $choosin The outer wrapper of a choosin element
    */
   const closeChoosin = ($choosin) => {
     if (isChoosinElement($choosin)) {
       console.error('openChoosins: Sent a bad element', $choosin);
       return;
     }
     $choosin.removeAttribute('open');
   };

   /**
    * Highlight a value for hover/focus/etc
    * @param $dropdownValue {}
    */
   const highlightValue = ($dropdownValue) => {

   };

  const init = () => {
  const $choosins = document.querySelectorAll('.choosin');

  /**
   * Initialize a choosin element
   * @param {HTMLElement} $choosin The outer wrapper of a choosin element
   */
  const processChoosin = ($choosin) => {
    // Initialize state
    if ($choosin.dataset.value) {
      // We have a default value, initialize state with the default value setup
      const defaultValue = $choosin.dataset.value;
      const $itemWithValue = $choosin.querySelector(`.csn-dropdown__option[data-value="${defaultValue}"]`);
      if ($itemWithValue) {
        $choosin.state = new pubSubState({
          'currentValue': {
            'value': defaultValue,
            'option': $itemWithValue,
          }
        });
        console.log($choosin.state.get('currentValue'));
      }
      else {
        console.error(`choosin init: Didn\'t find "${defaultValue}" in options`);
      }
    }
    else {
      // No default value, initialize empty state
      $choosin.state = new pubSubState();
    }

    const $trigger = $choosin.querySelector('.choosin__trigger');

    $trigger.addEventListener('click', (e) => {
      e.preventDefault();
      $choosin.hasAttribute('open') ? closeChoosin($choosin) : openChoosin($choosin);
    });
  };

  for (let index = 0; index < $choosins.length; index++) {
    processChoosin($choosins[index]);
  }
}

window.addEventListener('DOMContentLoaded', init);

})();