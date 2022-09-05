/**
 * Debounce helper function
 * @see https://davidwalsh.name/javascript-debounce-function
 *
 * @param {function} func Function to be debounced
 * @param {number} delay How long until it will be run
 * @param {boolean} immediate Whether it should be run at the start instead of the end of the debounce
 */
export function debounce (func, delay, immediate = false) {
  let timeout;
  return () => {
    const context = this,
      args = arguments;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
    if (callNow) func.apply(context, args);
  };
}

/**
 * Generates a random and unique hash for use in ID's
 * @return {string} String that is guarunteed to start with a letter, since HTML classes and ID's can't start with a number
 */
export const generateRandomHash = () => {
  // Making sure string starts with a letter, since ID's and classes can't start with numbers
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${randomLetter}${Math.random().toString(36).substring(2, 9)}`;
}