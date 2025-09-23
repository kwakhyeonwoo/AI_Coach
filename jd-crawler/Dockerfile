# Node.js 20 경량 이미지
FROM node:20-slim

# Puppeteer 실행에 필요한 패키지 최소화 설치
RUN apt-get update && apt-get install -y \
    chromium \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libnss3 \
    libdrm2 \
    libxshmfence1 \
    fonts-liberation \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# package.json만 복사 후 설치
COPY package*.json ./

# devDependencies 포함 (빌드 + 실행 위해)
RUN npm install

# 코드 복사
COPY . .

# 빌드
RUN npm run build

# Cloud Run은 PORT 사용
ENV PORT=8080
EXPOSE 8080

# 실행
CMD ["node", "dist/server.js"]
