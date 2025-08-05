// src/config/bugsnag.js

import Bugsnag from '@bugsnag/js';
import BugsnagPluginExpress from '@bugsnag/plugin-express';
import os from 'os';

const bugsnagClient = Bugsnag.start({
  // Get your API key from your Bugsnag dashboard
  apiKey: process.env.BUGSNAG_API_KEY,

  // Configure plugins
  plugins: [BugsnagPluginExpress],

  // Track the release stage and app version
  releaseStage: process.env.NODE_ENV || 'development',
  appVersion: process.env.APP_VERSION || '1.0.0',

  // Only send reports from these stages
  enabledReleaseStages: ['production', 'staging'],

  // Add useful diagnostic data
  addMetadata: {
    server: {
      hostname: os.hostname(),
      os: `${os.type()} ${os.release()}`,
    },
  },
});

export default bugsnagClient;