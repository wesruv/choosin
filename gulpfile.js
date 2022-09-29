/* eslint-env node, es6 */
/* global require */

const {parallel, series, src, dest, watch} = require('gulp');
const browserSync = require('browser-sync').create();

/**********************************************************
 * Browsersync
 */
/**
 * Start preview server for Adoc templates sample files
 */
const startBrowserSync = (done) => {
  browserSync.init({
    'server': './src',
    'ui': false,
    'port': 2099,
  });
  done();
};

/**
 * Reload browser sync manually
 */
const reloadBrowserSync = (done) => {
  browserSync.reload();
  done();
};

const watchSrc = () => {
  watch(['src/*', 'src/**/*'], reloadBrowserSync)
}

exports.start = series(
  startBrowserSync,
  watchSrc
);