# ─────────────────────────────────────────────
# Stage 1 – Builder: install all deps and compile TS
# ─────────────────────────────────────────────
FROM node:18-bullseye AS builder

WORKDIR /app

COPY package*.json ./

ENV HUSKY=0
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Use npm ci for reproducible installs (faster than npm install in CI)
RUN npm ci

COPY . .

RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 – Production: lean image with only what's needed at runtime
# ─────────────────────────────────────────────
FROM node:18-bullseye-slim AS production

# Install only Chromium runtime deps (bullseye-slim is much smaller than bullseye)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libx11-xcb1 \
    libxtst6 \
    libdrm2 \
    libxkbcommon0 \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only package files and install production deps only
COPY package*.json ./

ENV HUSKY=0
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

RUN npm ci --omit=dev

# Copy compiled output from the builder stage
COPY --from=builder /app/dist ./dist

# Persistence folder for WhatsApp session
RUN mkdir -p /app/.wwebjs_auth

EXPOSE 3000

CMD ["npm", "start"]
