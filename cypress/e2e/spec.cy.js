describe('Choosin Tests', () => {
  beforeEach(() => {
    cy.visit('src/index.html')
      // Creates @choosin alias for tests
      .get('div.choosin')
        .as('choosin')
      // Get that choosin's trigger and alias it
      .get('.choosin__trigger')
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
          const $choosinOptionsList = $choosin.querySelector('.choosin__optionsList');
          const $select = $choosin.choosin.selectElement;
          const hash = $choosin.dataset.csnHash;

          expect($choosin.choosin).to.not.be.empty;
          expect($choosinOptionsList).to.not.be.empty;

          expect($choosin.classList.contains('choosin--processed')).to.be.true;
          expect($select.classList.contains('choosin--hide')).to.be.true;

          expect($select).to.not.be.empty;
          expect(hash).to.equal($select.dataset.csnHash);
          expect($select.children.length).to.equal($choosinOptionsList.children.length);
          expect($select.value).to.equal($choosin.dataset.value);

      });
    });

    it('Should be toggled open and closed by the trigger', () => {
      cy.get('@choosin')
        .click()
        .should('have.attr', 'open');
      cy.get('@choosin')
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
          const scrollY = $choosin.getBoundingClientRect().top - 20;
          cy.window().then((win) => {
            cy.scrollTo(win.scrollX, scrollY)
              .get('@trigger').click(clickOptions)
              .then(() => {
                cy.get('@choosin').should('have.attr', 'open');
                expect($choosin.classList.contains('choosin--dropUp')).to.not.be.true;
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
            cy.log('vars', choosinCoords.top, win.innerHeight, win.scrollY, choosinCoords.height, 20)
            const scrollY = (choosinCoords.top - win.innerHeight + win.scrollY + choosinCoords.height + 20);
            cy.scrollTo(window.scrollX, scrollY)
              .then(() => {
                cy.get('@trigger')
                  .click(clickOptions)
                  .then(() => {
                    cy.get('@choosin').should('have.attr', 'open');
                    expect($choosin.classList.contains('choosin--dropUp')).to.be.true;
                  });
              });
          });
        });
    });
  });

});