# Pre-ingest frontend

A Vue.js and PrimeVue frontend towards the API that runs the
[the pre-ingest tooling](https://github.com/noord-hollandsarchief/preingest).

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

### Yarn

- Download project dependencies: `yarn install`

- Compile and hot-reload for development: `yarn serve`

  This [uses a proxy](./vue.config.js) for the API, to avoid CORS limitations.

- Compile and minify for production: `yarn build`

- Lint, Prettify and fix files: `yarn lint`

  Unlike the pre-commit hook (see below), this is not limited to staged files.

### Docker

The [Dockerfile](./Dockerfile) creates a temporary (cached) build image, builds the project, and
creates a final image that serves the static result using Nginx. To avoid CORS issues, this also
[proxies API requests](./docker-nginx.conf) for <http://localhost:9000/api/> to
<http://localhost:8000/api/>. 

To build:

```text
docker build -t noordhollandsarchief/preingest-frontend:development .
```

To run on <http://localhost:9000>:

```text
docker run -it -p 9000:80 --rm --name my-name noordhollandsarchief/preingest-frontend:development
```

### Linting and Prettier

A pre-commit hook ensures that linting errors and formatting errors cannot be committed. Note that
the hook uses [lint-staged](https://github.com/okonet/lint-staged), which temporarily hides unstaged
changes to partially staged files. This may make your IDE show warnings about files that were
changed outside of the IDE.

Beware that Sourcetree may [silently skip](https://jira.atlassian.com/browse/SRCTREE-7184) the
pre-commit hook.
