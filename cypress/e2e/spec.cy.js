const selectors = {
  'choosin': {
    'default': 'div.choosin',
    'processed': '.choosin--processed',
    'dropUp': '.choosin--dropUp',
  },
  'trigger': '.choosin__dropdownToggle',
  'optionList': '.choosin__optionsList',
  'choosinOption': {
    'default': '.csn-optionsList__option',
    'highlighted': '.csn-optionsList__option--highlight',
    'selected': '[aria-selected]',
  },
  'search': {
    'text': '.choosin__searchBox',
  },
  'select': {
    'processed': '.choosin--hide',
  },
};

/**
 * Get the highlighted choosin option HTML element
 * @param {HTML Element} $choosin Choosin wrapper
 * @returns {HTMLElement} The highlighted option
 */
const getHighlightedOption = ($choosin) => $choosin.querySelector(selectors.choosinOption.highlighted);

/**
 * Make sure a hash is valid
 * @param {string} hash Value of a choosin hash (e.g. dataset.csnHash or the data-csn-hash attribute)
 */
const validateCsnHash = (hash) => {
  expect(typeof hash === 'string').to.be.true;
  expect(hash).to.have.length(8);
};

/**
 * Gets the hash
 * @param {HTMLElement} $choosin Choosin wrapper
 * @returns {string} Choosin Hash
 */
const getHighlightedHash = ($choosin) => {
  const $optionHighlighted = getHighlightedOption($choosin);
  if ($optionHighlighted?.dataset?.csnHash) {
    const csnHash = $optionHighlighted.dataset.csnHash;
    validateCsnHash(csnHash);
    return csnHash;
  }
  else {
    console.error('Couldn\'t get highlighted option.');
  }
};


describe('Choosin Tests', () => {
  beforeEach(() => {
    cy.visit('src/index.html')
      // Creates @choosin alias for tests
      .get(selectors.choosin.default)
        .as('choosin')
      // Get that choosin's trigger and alias it
      .get(selectors.trigger)
        .as('trigger');
  });

  context('Initialization Tests', () => {
    it('Choosin should be tied to select and have similar content', () => {
      cy.get('@choosin')
        /**
         * Test first $choosin element
         */
        .then(($choosins) => {
          // cy.get returns a jQuery selector that can have multiple elements
          const $choosin = $choosins[0];
          const $choosinOptionsList = $choosin.querySelector(selectors.optionList);
          const $choosinOptionsSelected = $choosin.querySelectorAll(selectors.choosinOption.selected);
          const hash = $choosin.dataset.csnHash;

          const $select = $choosin.choosin.selectElement;
          const $selectOptionSelected = $select.querySelector('[selected]');

          expect($choosin.choosin).to.not.be.empty;
          expect($choosinOptionsList).to.not.be.empty;

          // Make sure the processed classes have been added
          expect($choosin.classList.contains(selectors.choosin.processed.substring(1))).to.be.true;
          expect($select.classList.contains(selectors.select.processed.substring(1))).to.be.true;

          // Make sure basic info of choosin and select match
          expect($select).to.not.be.empty;
          expect(hash).to.equal($select.dataset.csnHash);
          expect($select.children.length).to.equal($choosinOptionsList.children.length);
          expect($select.value).to.equal($choosin.dataset.value);

          // Make sure selected option matches between select and choosin
          expect($choosinOptionsSelected.length).to.equal(1);
          expect($choosinOptionsSelected[0].dataset.csnHash).to.equal($selectOptionSelected.dataset.csnHash);
        });
    });

    it('Should be toggled open and closed by the trigger, and default highlighted item should be the selected value', () => {
      cy.get('@trigger')
        .click()
        .get('@choosin')
        .then(($choosins) => {
          const $choosin = $choosins[0];
          cy.get('@choosin').should('have.attr', 'open')
            .wait(10) // Was erroring out without wait
            .then(() => {
              const $optionHighlighted = $choosin.querySelector(selectors.choosinOption.highlighted);
              expect($optionHighlighted.dataset.value).to.equal($choosin.dataset.value);
            });
        });
      cy.get('@trigger')
        .click()
        .should('not.have.attr', 'open');
    });

    it('Should have functioning open and close methods', () => {
      cy.get('@choosin')
        .then(($choosins) => {
          const $choosin = $choosins[0];
          expect($choosin.hasAttribute('open')).to.not.be.true;
          $choosin.choosin.open();
          expect($choosin.hasAttribute('open')).to.be.true;
          $choosin.choosin.close();
          expect($choosin.hasAttribute('open')).to.not.be.true;
        });
    });
  });

  context('Open and Close Behavior tests', () => {
    it('Should close if a click happens outside of it', () => {
      cy.get('@trigger').click();
      cy.get('@choosin').should('have.attr', 'open');
      cy.get('body').click();
      cy.get('@choosin').should('not.have.attr', 'open');
    });

    it('Should open down if there\'s more room below', () => {
      // Since we're testing behavior effected by scroll position
      // Disable scrolling on click
      const clickOptions = {'scrollBehavior': false};
      cy.get('@choosin')
        .then(($choosins) => {
          const $choosin = $choosins[0];
          // Scrolls to a point where choosin is at the top of the screen
          const scrollY = $choosin.getBoundingClientRect().top - 20;
          cy.window().then((win) => {
            cy.scrollTo(win.scrollX, scrollY)
              .get('@trigger').click(clickOptions)
              .then(() => {
                cy.get('@choosin').should('have.attr', 'open');
                expect($choosin.classList.contains(selectors.choosin.dropUp.substring(1))).to.not.be.true;
              });
          });
        });
    });

    it('Should open up if there\'s more room above', () => {
      // Since we're testing behavior effected by scroll position
      // Disable scrolling on click
      const clickOptions = {'scrollBehavior': false};
      cy.get('@choosin')
        .then(($choosins) => {
          const $choosin = $choosins[0];
          cy.window().then((win) => {
            const choosinCoords = $choosin.getBoundingClientRect();
            // Scrolls to a point where choosin is at the bottom of the screen
            const scrollY = (choosinCoords.top - win.innerHeight + win.scrollY + choosinCoords.height + 20);
            cy.scrollTo(window.scrollX, scrollY)
              .then(() => {
                cy.get('@trigger')
                  .click(clickOptions)
                  .then(() => {
                    cy.get('@choosin').should('have.attr', 'open');
                    expect($choosin.classList.contains(selectors.choosin.dropUp.substring(1))).to.be.true;
                  });
              });
          });
        });
    });

    it('Should show the correct behaviors when a new options is selected', ()=> {
      cy.get(selectors.search.text)
        .as('searchText')
        .clear()
        .wait(200)
      cy.get('@trigger')
        // .click()
        .then(($triggers) => {
          const $trigger = $triggers[0];
          cy.get('@choosin').then(($choosins) => {
            const $choosin = $choosins[0];
            // Get the 20th option in the list and click it
            cy.get(`${selectors.choosinOption.default}:nth-child(20)`, {'withinSubject': $choosin})
              .click()
              .then(($choosinOptions) => {
                const $choosinOption = $choosinOptions[0];
                const $select = $choosin.choosin.selectElement;
                const $choosinOptionsSelected = $choosin.querySelectorAll('[aria-selected]');

                // Make sure only one choosin option element has aria-selected
                expect($choosinOptionsSelected.length).to.equal(1);
                // Value matches selected option
                expect($choosin.dataset.value).to.equal($choosinOption.dataset.value);
                // Visible UI text matches the selected option
                expect($choosinOption.innerHtml).to.equal($trigger.innerHtml);
                // Make sure $choosin's value and the select element's value match
                expect($choosin.dataset.value).to.equal($select.value);
              });
          });
        });
    });

  });

  context('Search tests', () => {
    it('Should show 5 options when "sw" is in search field, then clear button should reset', () => {
      cy.get('@trigger').click();
      cy.get('@choosin').then(($choosins) => {
        const $choosin = $choosins[0];
        cy.get(selectors.search.text, {'withinSubject': $choosin})
          .as('searchText')
          .clear()
          .wait(200)
          // Search for 'united'
          .type('sw')
          // Give the component time to search due to debounce
          .wait(500)
          .then(() => {
            const $visibleOptions = $choosin.querySelectorAll('.csn-optionsList__option:not([hidden])');
            // Should see 4 results with the current content
            expect($visibleOptions.length).to.equal(4);
            // First option should have a highlight
            expect($visibleOptions[0].classList.contains(selectors.choosinOption.highlighted.substring(1))).to.be.true;
          })
      });
    });
  });


  context('Keyboard Navigation Tests', () => {
    it('Should highlight a different option when arrow keys are pressed', ()=> {
      cy.get(selectors.search.text)
        .as('searchText')
        .clear()
        .wait(200)
      cy.get('@choosin')
        .then(($choosins) => {
          const $choosin = $choosins[0];
          const firstHash = getHighlightedHash($choosin);
          cy.get('@searchText')
            .type('{downArrow}')
            .then(() => {
              // Going down one should show we have a different highlighted option
              const secondHash = getHighlightedHash($choosin);
              expect(firstHash).to.not.equal(secondHash);
            })
            .then(() => {
              cy.get('@searchText')
                .type('{upArrow}')
                .then(() => {
                  // Going back up should show we have the same hash
                  const thirdHash = getHighlightedHash($choosin);
                  expect(thirdHash).to.equal(firstHash);
                });
            });
        });
    });
    it('Navigating to new option with keyboard and pressing enter should select highlighted option', ()=> {
      cy.get(selectors.search.text)
        .as('searchText')
        .clear()
        .wait(200)
        .then(() => {
        cy.get('@choosin')
          .then(($choosins) => {
            const $choosin = $choosins[0];
            const firstHash = getHighlightedHash($choosin);

            cy.get('@searchText')
              .type('{downArrow}')
              .then(() => {
                cy.get('@searchText')
                  .type('{downArrow}')
                  .then(() => {
                    cy.get('@searchText')
                      .type('{downArrow}')
                      .then(() => {
                        cy.get('@searchText')
                          .type('{downArrow}')
                          .then(() => {
                            const $highlightedOption = getHighlightedOption($choosin);
                            const secondHash = $highlightedOption.dataset.csnHash;
                            validateCsnHash(secondHash);
                            expect(firstHash).to.not.equal(secondHash);
                            cy.get('@searchText')
                              .type('{enter}')
                              .then(() => {
                                const $selectedOption = $highlightedOption;
                                cy.get(selectors.select.processed)
                                  .then(($selects) => {
                                    const $select = $selects[0];
                                    expect($selectedOption.dataset.value).to.equal($choosin.dataset.value);
                                    expect($select.value).to.equal($choosin.dataset.value);
                                  })
                              });
                          });
                      });
                  });
              })
          });
        });
    });
  });
});