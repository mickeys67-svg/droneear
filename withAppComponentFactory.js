const { withAndroidManifest } = require('@expo/config-plugins');

const withAppComponentFactory = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Make sure xmlns:tools exists
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    if (androidManifest.application && androidManifest.application[0]) {
      const app = androidManifest.application[0];
      app.$['tools:replace'] = app.$['tools:replace'] 
        ? `${app.$['tools:replace']},android:appComponentFactory`
        : 'android:appComponentFactory';
        
      // Also ensure we have the correct appComponentFactory
      app.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    }

    return config;
  });
};

module.exports = withAppComponentFactory;
