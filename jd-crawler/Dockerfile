# Node.js 20 + Puppeteer 실행환경
FROM node:20-slim

# Puppeteer 실행에 필요한 패키지 설치
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

# 작업 디렉토리
WORKDIR /usr/src/app

# package.json & lock 파일 복사
COPY package*.json ./

# ✅ devDependencies 포함 설치 (빌드 + 런타임)
RUN npm install

# 코드 복사
COPY . .

# 빌드
RUN npm run build

# Cloud Run은 PORT 환경변수 사용
ENV PORT=8080
EXPOSE 8080

# 서버 실행
CMD ["node", "dist/server.js"]
