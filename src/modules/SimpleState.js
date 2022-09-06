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
   * @param {object} initialData Object with keys and values of initial data
   * @param {string} logLevel Set to verbose, warnings, errors, none. Defaults to none
   * @param {string} logPrefix String to prefix log messages with
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
    if (typeof currentValue !== 'undefined') return currentValue;
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

    this._log('log', 'Subscribed', {dataKey, subscriberKey});

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
    const subscriberCallbacks = this.subscribers[dataKey] ? Object.values(this.subscribers[dataKey]) : [];
    if (subscriberCallbacks?.length) {
      subscriberCallbacks.forEach((callback) => {
        if (typeof callback === 'function') {
          this._log('log', `Calling a subscriber callback for "${dataKey}"`, {callback});
          callback(newValue, oldValue);
        }
      });
    }
  }
};

export default simpleState;