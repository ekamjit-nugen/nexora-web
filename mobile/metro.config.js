const { getDefaultConfig } = require("expo/metro-config");

// Polyfill Array.prototype.toReversed for Node < 20
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return [...this].reverse();
  };
}

const config = getDefaultConfig(__dirname);

module.exports = config;
