// As per https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-plugin
module.exports = {
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => {
      args[0].title = 'Pre-ingest';
      return args;
    });
  },

  css: {
    loaderOptions: {
      // See https://webpack.js.org/loaders/sass-loader/
      sass: {
        // Make sure that the files imported here only contain SASS code that doesn't get rendered,
        // such as variables, mixins and functions. Otherwise, that code will end up repeated for
        // each component in the final post-processed CSS file.
        prependData: `
          @import "@/scss/_variables.scss";
        `,
      },
    },
  },

  // Proxy the API requests to avoid CORS issues; for production the API should support CORS or
  // should be hosted on the same protocol, domain and port.
  configureWebpack: {
    devServer: {
      // This will use port 8082 and up if already in use
      port: 8081,
      proxy: {
        '^/api': {
          // The matched `/api` part is also copied into the target URL; to change that, see
          // https://webpack.js.org/configuration/dev-server/
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '^/preingestEventHub': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  },
};
