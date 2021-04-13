# Pre-ingest frontend

A Vue.js and PrimeVue frontend towards the API that runs the
[the pre-ingest tooling](https://github.com/noord-hollandsarchief/preingest).

[![Overview page of available tar archives](./docs/overview.gif)](./docs/overview.gif)

[![Processing of single tar archive](./docs/processing.gif)](./docs/processing.gif)

## Development

### Init

This uses Vue 3 preview, PrimeVue, PrimeIcons and PrimeFlex with TypeScript.

<details>
<summary>Details</summary>

This project was bootstrapped with Vue CLI v4.5.9. Initial `vue create` options:

- Please pick a preset: Manually select features
- Check the features needed for your project: Choose Vue version, Babel, TS, Router, Vuex, CSS
  Pre-processors, Linter, Unit
- Choose a version of Vue.js that you want to start the project with: 3.x (Preview)
- Use class-style component syntax? No
- Use Babel alongside TypeScript (required for modern mode, auto-detected polyfills, transpiling
  JSX)? Yes
- Use history mode for router? (Requires proper server setup for index fallback in production) Yes
- Pick a CSS pre-processor (PostCSS, Autoprefixer and CSS Modules are supported by default):
  Sass/SCSS (with dart-sass)
- Pick a linter / formatter config: Prettier
- Pick additional lint features: Lint on save, Lint and fix on commit
- Pick a unit testing solution: Jest
- Where do you prefer placing config for Babel, ESLint, etc.? In dedicated config files
- Pick the package manager to use when installing dependencies: Yarn

Next, upgraded Prettier to fix errors in the generated code, configured `.editorconfig` and Prettier
rules, added `vue.config.js` to set the app's title, and added PrimeVue, PrimeIcons and PrimeFlex.
</details>

### Configuration

The configuration is kept in [.env](./.env) files.

### SCSS

The free PrimeVue templates [are pure CSS](https://www.primefaces.org/designer/primevue) and do not
expose any SASS variables:

> PrimeVue only ships the generated CSS of Material, Bootstrap, Saga, Vela, Arya, Soho, Fluent UI
> and legacy themes whereas Designer provides full access to the whole SASS structure and the
> variables of these pre-built themes for easier customization.
 
To reuse a style from an imported theme, add it to [_variables.scss](./src/scss/_variables.scss),
but note that changing those will not affect the theme itself. Webpack [has been set up to include
this file](./vue.config.js) in the SCSS of all custom components.

### Yarn

- Download project dependencies: `yarn install`

- Compile and hot-reload for development: `yarn serve`

  This runs on <http://localhost:8081> (or 8082 and up if ports are already in use) and
  [uses a proxy](./vue.config.js) for the API, to avoid CORS limitations. The default configuration
  expects the API to be running on <http://localhost:8000/api/>.

- Compile and minify for production: `yarn build`

- Lint, Prettify and fix files: `yarn lint`

  Unlike the pre-commit hook (see below), this is not limited to staged files.

### Docker

The [Dockerfile](./Dockerfile) creates a temporary (partially cached) build image, builds the
project, and creates a final image that serves the static result using Nginx. To avoid CORS issues,
this also [proxies](./docker-nginx.conf) `/api/*` and `/preingestEventHub/*` to whatever is set in
the environment variables `PROXY_API_DEST` and `PROXY_EVENTHUB_DEST`. These settings default to
`http://host.docker.internal:8000/api/` and `http://host.docker.internal:8000/preingestEventHub/`
to delegate to port 8000 running on your local machine.

To build and tag:

```text
docker build -t noordhollandsarchief/preingest-frontend:development .
```

To run on <http://localhost:9000>, proxy requests for `/api/*` to <http://localhost:8000/api/> and
proxy requests for `/preingestEventHub/*` to <http://localhost:8000/preingestEventHub/>:

```text
docker run -it -p 9000:80 --rm noordhollandsarchief/preingest-frontend:development
```

To proxy to different ports or locations, set `PROXY_API_DEST` and `PROXY_EVENTHUB_DEST`:

```text
docker run -it -p 9000:80 --rm \
  --env PROXY_API_DEST=http://host.docker.internal:55004/api/ \
  --env PROXY_EVENTHUB_DEST=http://host.docker.internal:55004/preingestEventHub/ \
  noordhollandsarchief/preingest-frontend:development
```

[For Linux](https://stackoverflow.com/a/43541732) set `--add-host=host.docker.internal:host-gateway`
or use `172.17.0.1` instead of `host.docker.internal`:

```text
docker run -it -p 9000:80 --rm \
  --env PROXY_API_DEST=http://172.17.0.1:8000/api/ \
  --env PROXY_EVENTHUB_DEST=http://172.17.0.1:8000/preingestEventHub/ \
  noordhollandsarchief/preingest-frontend:development
```

### Linting and Prettier

A pre-commit hook ensures that linting errors and formatting errors cannot be committed. Note that
the hook uses [lint-staged](https://github.com/okonet/lint-staged), which temporarily hides unstaged
changes of partially staged files. This may make your IDE show warnings about files that were
changed outside of the IDE.

Beware that Sourcetree may [silently skip](https://jira.atlassian.com/browse/SRCTREE-7184) the
pre-commit hook.
