import Choosin from './choosin.js';

/**
 * Initialize all choosins on the page
 */
window.addEventListener('DOMContentLoaded', () => {
  const $choosins = document.querySelectorAll('.choosin');

  // Iterate over choosins and init them
  for (let index = 0; index < $choosins.length; index++) {
    let $choosin = $choosins[index];
    if ($choosin.tagName.toLowerCase() === 'select') {
      new Choosin($choosin);
    }
    else {
      this.log('warn', 'A non-select element has a choosin class, and cannot be processed', {$choosin});
      $choosin.hidden = true;
    }
  }
});
