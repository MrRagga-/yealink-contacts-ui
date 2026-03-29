FROM node:25-alpine AS build

ARG APP_VERSION=0.1.0
WORKDIR /srv/app

COPY app/frontend/package.json app/frontend/package-lock.json ./
RUN npm ci

COPY app/frontend ./
RUN npm run build

FROM nginx:1.27-alpine

ARG APP_VERSION=0.1.0

LABEL org.opencontainers.image.title="Yealink Contacts Sync Frontend" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.licenses="Apache-2.0"

COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/app/dist /usr/share/nginx/html

EXPOSE 80
