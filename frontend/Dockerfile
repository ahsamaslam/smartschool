# ============================================
# Frontend — React / Vite → Nginx
# ============================================

# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# In Docker the API lives at http://backend:8000, not localhost.
# Vite bakes the value of VITE_API_URL into the static bundle.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN rm -rf /app/dist /app/.vite && npm run build

# Stage 2: serve with Nginx
FROM nginx:alpine

# Remove the default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy the Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config — serves the SPA and proxies /api → backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
