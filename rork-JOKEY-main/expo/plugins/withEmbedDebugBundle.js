const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Default "debug" variant skips packaging index.android.bundle (expects Metro).
 * Sideloaded / emulator APKs then white-screen after splash. Force bundle embed.
 */
function withEmbedDebugBundle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (contents.includes('debuggableVariants = []')) {
      return mod;
    }
    const marker = '// debuggableVariants = ["liteDebug", "prodDebug"]';
    if (!contents.includes(marker)) {
      console.warn(
        '[withEmbedDebugBundle] Marker not found; skip (custom android/app/build.gradle?).'
      );
      return mod;
    }
    mod.modResults.contents = contents.replace(
      marker,
      `${marker}\n    debuggableVariants = []`
    );
    return mod;
  });
}

module.exports = withEmbedDebugBundle;
