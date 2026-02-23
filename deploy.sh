#!/bin/bash
set -e

# ==================================================
# StockSystem - Deploy Script
# Usage: ./deploy.sh [local|remote]
# ==================================================

MODE=${1:-local}
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="stocksystem"

echo "🚀 StockSystem Deploy — Mode: $MODE"
echo "=================================================="

# ---- LOCAL DEPLOY (default) ----
if [ "$MODE" = "local" ]; then
    echo "📦 Step 1/3: Building images..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache

    echo "🔄 Step 2/3: Restarting services..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d

    echo "⏳ Step 3/3: Waiting for health checks..."
    sleep 10

    echo ""
    echo "📊 Service Status:"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps

    echo ""
    echo "📏 Image Sizes:"
    docker images --filter "reference=${PROJECT_NAME}*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

    echo ""
    echo "✅ Deploy complete!"
    echo "   Frontend: http://localhost:8080"
    echo "   Backend:  http://localhost:3001/health"

# ---- REMOTE DEPLOY (via SSH) ----
elif [ "$MODE" = "remote" ]; then
    REMOTE_HOST=${REMOTE_HOST:-"user@your-server.com"}
    REMOTE_DIR=${REMOTE_DIR:-"/opt/stocksystem"}

    echo "📤 Step 1/4: Building images locally..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build

    echo "💾 Step 2/4: Saving images..."
    docker save ${PROJECT_NAME}-backend ${PROJECT_NAME}-frontend | gzip > /tmp/stock-images.tar.gz
    echo "   Size: $(du -h /tmp/stock-images.tar.gz | cut -f1)"

    echo "🚚 Step 3/4: Uploading to $REMOTE_HOST..."
    scp /tmp/stock-images.tar.gz "$REMOTE_HOST:/tmp/"
    scp $COMPOSE_FILE "$REMOTE_HOST:$REMOTE_DIR/"
    scp .env "$REMOTE_HOST:$REMOTE_DIR/"

    echo "🔄 Step 4/4: Starting on remote..."
    ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker load < /tmp/stock-images.tar.gz && docker-compose up -d"

    echo "✅ Remote deploy complete!"

else
    echo "❌ Unknown mode: $MODE"
    echo "Usage: ./deploy.sh [local|remote]"
    exit 1
fi
