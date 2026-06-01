const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.serializer = {
  ...config.serializer,
  getPolyfills: () => [
    path.resolve(__dirname, "src/polyfills.js"),
    path.resolve(__dirname, "node_modules/@react-native/js-polyfills/error-guard.js"),
  ],
};

module.exports = config;
