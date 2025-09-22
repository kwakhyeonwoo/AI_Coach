# Node.js 20 기반 이미지
FROM node:20-slim

# Puppeteer 실행을 위한 패키지 설치
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# package.json & lock 복사
COPY package*.json ./

RUN npm install --omit=dev

# 코드 복사
COPY . .

# 빌드
RUN npm run build

# Cloud Run은 PORT 환경변수 사용
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
