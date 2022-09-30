const { defineConfig } = require('cypress')

module.exports = defineConfig({
  fixturesFolder: false,
  e2e: {
    // To point at browsersync, uncomment this line
    // otherwise Cypress will use it's own browser
    // baseUrl: 'http://localhost:2099',
    supportFile: false,
  },
});
