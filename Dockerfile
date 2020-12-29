# build:
#   docker build -t noordhollandsarchief/preingest-frontend:development .
#
# run, expose on port 9000:
#   docker run -it -p 9000:80 noordhollandsarchief/preingest-frontend:development

# Temporary (cached) build image
FROM node:lts-alpine as build
WORKDIR /app
COPY package.json ./
COPY yarn.lock ./
RUN yarn install

# To take advantage of caching until package.json or yarn.lock changes: only now copy all else into the build image.
# See also http://bitjudo.com/blog/2014/03/13/building-efficient-dockerfiles-node-dot-js/
COPY . .
RUN yarn build

# Final target image
FROM nginx:stable-alpine as production-stage
COPY --from=build /app/dist /usr/share/nginx/html

# Boldly overwite whatever default is in the base image
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
