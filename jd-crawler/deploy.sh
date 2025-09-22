#!/bin/bash
# ===============================
# Cloud Run 배포 스크립트
# ===============================

PROJECT_ID="ai-interview-coach-196ec"
SERVICE_NAME="jd-crawler"
REGION="asia-northeast3"

echo "🚀 Cloud Run 배포 시작: $SERVICE_NAME (프로젝트: $PROJECT_ID, 리전: $REGION)"

# Docker 이미지 빌드 & 업로드
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Cloud Run 서비스 배포
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "✅ 배포 완료! Cloud Run URL 확인:"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format 'value(status.url)'
