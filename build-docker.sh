#!/bin/bash
set -e

echo "🚀 Construyendo imágenes Docker para VIEWMED..."
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: No se encontró docker-compose.yml"
    echo "Por favor ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

echo -e "${BLUE}📦 Paso 1: Construyendo imágenes...${NC}"
docker-compose build --no-cache

echo ""
echo -e "${BLUE}🏷️  Paso 2: Taggeando imágenes para el registro...${NC}"

# Tags para OHIF
docker tag ohif-viewer:latest us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/ohif-viewer:latest
docker tag ohif-viewer:latest us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/ohif-viewer:$(date +%Y%m%d-%H%M%S)

# Tags para Nginx Proxy  
docker tag nginx-proxy:latest us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/nginx-pacs-proxy:latest
docker tag nginx-proxy:latest us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/nginx-pacs-proxy:$(date +%Y%m%d-%H%M%S)

echo ""
echo -e "${YELLOW}⚠️  Para subir las imágenes al registro, ejecuta:${NC}"
echo ""
echo -e "${GREEN}    # Autenticar con Google Cloud${NC}"
echo -e "    gcloud auth configure-docker us-east1-docker.pkg.dev"
echo ""
echo -e "${GREEN}    # Subir imágenes${NC}"
echo -e "    docker push us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/ohif-viewer:latest"
echo -e "    docker push us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/nginx-pacs-proxy:latest"
echo ""
echo -e "${BLUE}✅ Build completado!${NC}"
echo ""
echo -e "${BLUE}🚀 Para ejecutar localmente:${NC}"
echo -e "    docker-compose up -d"
echo ""
echo -e "${BLUE}🌐 URLs:${NC}"
echo -e "    OHIF Viewer: http://localhost:3000"
echo -e "    Nginx Proxy: http://localhost:8080"
echo -e "    Proxy Health: http://localhost:8080/health"
