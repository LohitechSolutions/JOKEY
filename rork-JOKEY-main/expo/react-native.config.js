/** @type {import('@react-native-community/cli-types').Config} */
module.exports = {
  dependencies: {
    // Pulled in by @rork-ai/toolkit-sdk for web maps only — not used natively.
    'react-native-maps': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
