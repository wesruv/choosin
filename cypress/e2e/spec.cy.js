describe('Choosin Tests', () => {
  beforeEach(() => {
    cy.visit('/index.html');
  });

  context('Initialization Tests', () => {
    it ('should get open attribute when clicked', () => {
      cy.get('div.choosin')
        .should('not.have.attr', 'open');
      cy.get('div.choosin')
        .click()
        .should('have.attr', 'open');
      cy.get('div.choosin')
        .click()
        .should('not.have.attr', 'open');
    });
  });


});