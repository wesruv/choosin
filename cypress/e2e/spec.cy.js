describe('Choosin Tests', () => {
  beforeEach(() => {
    cy.visit('src/index.html');
    // Creates @choosin alias for tests
    cy.get('div.choosin')
      .as('choosin');
  });

  context('Initialization Tests', () => {
    it('should have ties to the select element', () => {
      cy.get('@choosin')
        .then(($choosins) => {
          // cy.get returns a jQuery selector that can have multiple elements
          const $choosin = $choosins[0];
          const hash = $choosin.dataset.csnHash;

          expect($choosin.choosin).to.not.be.empty;
          // Make sure the pointer to the select element exists
          expect($choosin.choosin.selectElement).to.not.be.empty;
          // Make sure select element and choosin have the same hash
          expect(hash).to.equal($choosin.choosin.selectElement.dataset.csnHash);

          // Ensure that the pointer is pointing to the correct seleect element
          cy.get(`select[data-csn-hash="${hash}"]`).then(($selects) => {
            const $select = $selects[0];
            $select.setAttribute('test', '');
            expect($select.hasAttribute('test')).to.be.true;
            cy.get('@choosin').should('not.have.attr', 'open');
            // cy.get('@choosin').should('have.attr', 'wakka');
          });
      });
    });

    it('should get open attribute when clicked', () => {
      cy.get('@choosin')
        .click()
        .should('have.attr', 'open');
      cy.get('@choosin')
        .click()
        .should('not.have.attr', 'open');
    });
  });

});