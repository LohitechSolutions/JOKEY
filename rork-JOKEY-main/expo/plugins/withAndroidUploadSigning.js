const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Release signing via expo/credentials/keystore.properties + upload keystore.
 * Syncs versionCode / versionName from app.json.
 *
 * Uses `projectRoot` (Expo app dir); Gradle `rootDir` here is android/, not android/app.
 */
function withAndroidUploadSigning(config) {
  const versionName = config.version || '1.0.0';
  const versionCode = config.android?.versionCode ?? 1;

  return withAppBuildGradle(config, (mod) => {
    let c = mod.modResults.contents;

    const keystoreBlock = `def keystorePropertiesFile = new File(projectRoot, "credentials/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}`;

    if (!c.includes('keystorePropertiesFile = new File(projectRoot')) {
      c = c.replace(
        'def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n\n/**',
        `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

${keystoreBlock}

/**`
      );
    }

    c = c.replace(
      /versionCode \d+\s*\n\s*versionName "[^"]+"/,
      `versionCode ${versionCode}\n        versionName "${versionName}"`
    );

    const debugOnlyBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

    const debugAndRelease = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['KEY_ALIAS']
                keyPassword keystoreProperties['KEY_PASSWORD']
                storeFile file(new File(projectRoot, keystoreProperties['KEYSTORE_PATH'] ?: 'credentials/upload-keystore.jks').absolutePath)
                storePassword keystoreProperties['STORE_PASSWORD']
                def st = keystoreProperties['KEYSTORE_TYPE']
                if (st != null && st.trim().length() > 0) {
                    storeType st.trim()
                }
            }
        }
    }`;

    if (c.includes(debugOnlyBlock) && !c.includes("keyAlias keystoreProperties['KEY_ALIAS']")) {
      c = c.replace(debugOnlyBlock, debugAndRelease);
    }

    const failUnlessUpload = `            if (!keystorePropertiesFile.exists()) {
                throw new GradleException(
                    "Release builds require upload signing. Missing:\\n  " + keystorePropertiesFile.absolutePath +
                    "\\nCopy credentials/keystore.properties.example → keystore.properties (see expo/credentials/)." +
                    "\\n(Debug keystore must never be used for Play uploads.)"
                )
            }
            signingConfig signingConfigs.release`;

    const releaseStub =
      '            // Caution! In production, you need to generate your own keystore file.\n            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug';

    if (c.includes(releaseStub)) {
      c = c.replace(releaseStub, failUnlessUpload);
    } else if (
      c.includes('signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug')
    ) {
      c = c.replace(
        '            signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug',
        failUnlessUpload
      );
    } else if (c.includes('        release {') && !c.includes('Debug keystore must never be used')) {
      c = c.replace(
        /(        release \{\s*)\/\/ Caution\.[\s\S]*?signingConfig signingConfigs\.debug/,
        `$1${failUnlessUpload}`
      );
    }

    // Fix legacy mistaken path (…/credentials one level too high)
    c = c.replace(
      /new File\(expoRootDir, keystoreProperties\['KEYSTORE_PATH'\]/g,
      "new File(projectRoot, keystoreProperties['KEYSTORE_PATH']"
    );
    c = c.replace(
      /def keystorePropertiesFile = new File\(expoRootDir, "credentials\/keystore.properties"\)/g,
      'def keystorePropertiesFile = new File(projectRoot, "credentials/keystore.properties")'
    );
    c = c.replace(/\ndef expoRootDir = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getParentFile\(\)\n/g, '\n');

    mod.modResults.contents = c;
    return mod;
  });
}

module.exports = withAndroidUploadSigning;
