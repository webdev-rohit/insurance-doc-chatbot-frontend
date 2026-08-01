# ---- Build the static SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# vite build defaults to mode=production, which loads .env.production —
# that's where the two Cloud Run backend URLs are baked into the bundle.
RUN npm run build

# ---- Serve it ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Cloud Run injects PORT at runtime; nginx's entrypoint envsubst's ${PORT}
# into the generated server block (see nginx.conf.template).
ENV PORT=8080
EXPOSE 8080
