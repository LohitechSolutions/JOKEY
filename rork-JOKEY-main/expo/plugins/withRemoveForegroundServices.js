const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds tools:node="remove" service entries to the app manifest so Gradle's
 * manifest merger strips expo-audio's foreground service declarations.
 * This removes FOREGROUND_SERVICE_MEDIA_PLAYBACK and FOREGROUND_SERVICE_MICROPHONE
 * requirements from the Play Store without breaking in-foreground audio.
 */
function withRemoveForegroundServices(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;

    if (!app.service) app.service = [];

    const servicesToRemove = [
      'expo.modules.audio.service.AudioControlsService',
      'expo.modules.audio.service.AudioRecordingService',
    ];

    for (const serviceName of servicesToRemove) {
      const alreadyPresent = app.service.some(
        (s) => s.$?.['android:name'] === serviceName
      );
      if (!alreadyPresent) {
        app.service.push({
          $: {
            'android:name': serviceName,
            'tools:node': 'remove',
          },
        });
      }
    }

    // Ensure tools namespace is declared on the manifest root
    if (!mod.modResults.manifest.$['xmlns:tools']) {
      mod.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return mod;
  });
}

module.exports = withRemoveForegroundServices;
