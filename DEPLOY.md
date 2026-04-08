# 🏥 VIEWMED OHIF Viewer - Docker Deployment

## 📁 Estructura de Archivos

```
.
├── docker-compose.yml          # Orquestación de servicios
├── build-docker.sh             # Script de build y push
├── Dockerfile                  # Build de OHIF (existente)
├── proxy/
│   ├── Dockerfile             # Build del proxy Nginx
│   └── nginx.conf             # Configuración del proxy
└── platform/app/public/config/
    └── viewmed.js             # ⚡ Configuración única y estable
```

## 🚀 Quick Start

### 1. Construir imágenes

```bash
./build-docker.sh
```

### 2. Ejecutar localmente

```bash
docker-compose up -d
```

### 3. Acceder

- **OHIF Viewer**: http://localhost:3000
- **Proxy Health**: http://localhost:8080/health

## 📤 Push a Google Artifact Registry

```bash
# Autenticar (una sola vez)
gcloud auth configure-docker us-east1-docker.pkg.dev

# Push imágenes
docker push us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/ohif-viewer:latest
docker push us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/nginx-pacs-proxy:latest
```

## 🔄 Actualizar código y redeploy

```bash
# 1. Hacer cambios en el código
# 2. Reconstruir
./build-docker.sh

# 3. Push a registry (si es para producción)
docker push us-east1-docker.pkg.dev/viewmed-web/viewmed-local-services/ohif-viewer:latest

# 4. Reiniciar contenedores
docker-compose down
docker-compose up -d
```

## ⚙️ Configuración

### Variables de entorno del build

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| `APP_CONFIG` | `config/viewmed.js` | Configuración a usar |
| `PUBLIC_URL` | `/` | URL base de la app |

### Puertos expuestos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| OHIF Viewer | `3000` | Aplicación principal |
| Nginx Proxy | `8080` | Proxy con cache al PACS |

## 🗄️ Volumen de Cache

El proxy usa un volumen Docker `nginx-cache` para persistir el cache de DICOM entre reinicios.

```bash
# Ver uso del cache
docker exec nginx-proxy du -sh /var/cache/nginx/dicom

# Limpiar cache si es necesario
docker-compose down -v  # Elimina también los volúmenes
```

## 🏥 Conexión al PACS

El sistema está configurado para conectarse a:

- **PACS**: `developer.viewmedonline.com/dcm4chee-arc`
- **AE Title**: `VIEWMED`

La conexión pasa por el proxy Nginx con:
- Cache de 5GB máximo
- TTL de 1 día para datos DICOM
- Compresión gzip para metadatos JSON

## 🐛 Troubleshooting

### Ver logs

```bash
# OHIF
docker logs -f ohif-viewer

# Proxy
docker logs -f nginx-proxy
```

### Rebuild completo

```bash
docker-compose down -v
docker-compose build --no-cache
./build-docker.sh
```

### Verificar conectividad al PACS

```bash
curl http://localhost:8080/pacs/aets/VIEWMED/rs/studies?limit=1
```

## 📋 Comandos útiles

```bash
# Estado de contenedores
docker-compose ps

# Recursos usados
docker stats

# Shell en el contenedor
docker exec -it ohif-viewer /bin/sh
docker exec -it nginx-proxy /bin/sh
```
