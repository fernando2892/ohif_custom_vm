#!/bin/bash
# Script para iniciar OHIF con proxy nginx en modo desarrollo

echo "Iniciando OHIF Viewer con proxy nginx..."
echo ""
echo "Configuración:"
echo "  - OHIF UI: http://localhost:3000"
echo "  - Proxy: http://localhost:80 → http://developer.viewmedonline.com"
echo "  - PACS: VIEWMED DCM4CHEE"
echo ""

# Verificar que nginx proxy está corriendo
if ! curl -s http://localhost/health > /dev/null 2>&1; then
    echo "⚠️  ADVERTENCIA: Nginx proxy no está corriendo en el puerto 80"
    echo "   Iniciando nginx proxy..."
    docker compose up -d proxy
    sleep 2
fi

# Iniciar OHIF con proxy configurado
export APP_CONFIG=config/viewmed_fast.js
export PROXY_TARGET=/dcm4chee-arc
export PROXY_DOMAIN=http://localhost:80
export PROXY_PATH_REWRITE_FROM=/dcm4chee-arc
export PROXY_PATH_REWRITE_TO=/dcm4chee-arc

echo "✅ Iniciando servidor de desarrollo..."
yarn dev
