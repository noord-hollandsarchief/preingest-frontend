# Build and tag:
#
#   docker build -t noordhollandsarchief/preingest-frontend:development .
#
# Run on port 9000, and proxy /api/* to http://localhost:8000/api/ on your machine:
#
#   docker run -p 9000:80 --rm noordhollandsarchief/preingest-frontend:development
#
# Run on port 9000, and proxy /api/* to http://localhost:55004/api/ on your machine:
#
#   docker run -p 9000:80 --rm \
#     --env PROXY_API_DEST=http://host.docker.internal:55004/api/ \
#     noordhollandsarchief/preingest-frontend:development

# Temporary (partially cached) build image
FROM node:lts-alpine as build
WORKDIR /app
COPY package.json ./
COPY yarn.lock ./
RUN yarn install

# To take advantage of caching until package.json or yarn.lock changes: only now copy
# all else into the build image, and build.
# See http://bitjudo.com/blog/2014/03/13/building-efficient-dockerfiles-node-dot-js/
COPY . .
RUN yarn build

# Final target image
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Each time Nginx is started it will perform variable substition in all template
# files found in `/etc/nginx/templates/*.template`, and copy the results (without
# the `.template` suffix) into `/etc/nginx/conf.d/`. Below, this will replace the
# original `/etc/nginx/conf.d/default.conf`; see https://hub.docker.com/_/nginx
COPY docker-nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-defaults.sh /
# Just in case the file mode was not properly set in Git
RUN chmod +x /docker-defaults.sh

EXPOSE 80
# This will delegate to the original Nginx `docker-entrypoint.sh`
ENTRYPOINT ["/docker-defaults.sh"]
# The default parameters to ENTRYPOINT (unless overruled on the command line)
CMD ["nginx", "-g", "daemon off;"]
