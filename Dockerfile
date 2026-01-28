FROM node:18-bullseye

# Instala dependências necessárias pro Chromium rodar em ambiente headless
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
    lsb-release \
    fonts-liberation \
    ffmpeg \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (cache de build)
COPY package*.json ./

ENV HUSKY=0
RUN npm install

# Copia o restante do projeto
COPY . .

# Build do projeto (se usar TypeScript ou bundler)
RUN npm run build

# 🔥 Caminho do Chromium para o Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 🔥 Pasta onde a sessão do WhatsApp será salva
RUN mkdir -p /app/.wwebjs_auth

# Porta padrão (Railway define automaticamente, mas não atrapalha)
EXPOSE 3000

CMD ["npm", "start"]
