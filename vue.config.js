// As per https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-plugin
module.exports = {
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => {
      args[0].title = 'Pre-ingest';
      return args;
    });
  },

  // Proxy the API requests to avoid CORS issues; for production the API should support CORS or
  // should be hosted on the same protocol, domain and port.
  configureWebpack: {
    devServer: {
      // This will use port 9001 and up if already in use
      port: 9000,
      proxy: {
        '^/api': {
          // The matched `/api` part is also copied into the target URL; to change that, see
          // https://webpack.js.org/configuration/dev-server/
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  },
};
