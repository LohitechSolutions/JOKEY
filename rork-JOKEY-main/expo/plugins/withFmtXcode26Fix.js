const { withPodfile } = require('@expo/config-plugins');
const {
  mergeContents,
} = require('@expo/config-plugins/build/utils/generateCode');

const FMT_XCODE26_FIX = `
  # Xcode 26 workaround: fmt 11.x consteval fails on Apple Clang 26.x
  fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base)
    content = File.read(fmt_base)
    unless content.include?('Xcode 26 workaround')
      patched = content.gsub(
        /^(#elif defined\\(__cpp_consteval\\)\\n#\\s*define FMT_USE_CONSTEVAL) 1/,
        "\\\\// Xcode 26 workaround: disable consteval\\n\\\\1 0"
      )
      if patched == content
        patched = content.gsub(/#\\s*define FMT_USE_CONSTEVAL 1/, '# define FMT_USE_CONSTEVAL 0')
      end
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
        Pod::UI.puts '[withFmtXcode26Fix] Patched fmt/base.h: disabled FMT_USE_CONSTEVAL'
      end
    end
  end

  installer.pods_project.targets.each do |target|
    next unless target.name == 'fmt'

    target.build_configurations.each do |build_config|
      build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
    end
  end
`.trim();

/**
 * Xcode 26.4+ breaks fmt 11.x consteval checks when building React Native from source.
 * Patches fmt/base.h after pod install and forces the fmt pod to compile as C++17.
 */
function withFmtXcode26Fix(config) {
  return withPodfile(config, (mod) => {
    try {
      const results = mergeContents({
        tag: 'with-fmt-xcode26-fix',
        src: mod.modResults.contents,
        newSrc: FMT_XCODE26_FIX,
        anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
        offset: 2,
        comment: '#',
      });

      if (results.didMerge || results.didClear) {
        mod.modResults.contents = results.contents;
      }
    } catch (error) {
      if (error.code === 'ERR_NO_MATCH') {
        throw new Error(
          "Cannot add fmt Xcode 26 workaround to the project's ios/Podfile because it's malformed."
        );
      }
      throw error;
    }

    return mod;
  });
}

module.exports = withFmtXcode26Fix;
