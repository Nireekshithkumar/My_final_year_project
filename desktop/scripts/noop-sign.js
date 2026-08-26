/**
 * No-op sign script for unsigned Windows installer builds.
 * Allows electron-builder to build NSIS and portable targets without requiring
 * code signing certificates or winCodeSign binary extraction.
 */
exports.default = async function sign(configuration) {
  // Return without signing — produces a valid unsigned installer
  return true;
};
