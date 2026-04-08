# OHIF + Proxy Nginx Optimizado para VIEWMED

Esta configuración implementa las 3 prioridades de optimización:
1. **Proxy Nginx** con cache y gzip
2. **Compresión JPEG-LS/HTJ2K** (transfer syntax)
3. **Prefetch limitado** (2 imágenes adelante)

## 📁 Archivos Creados

```
.
├── nginx.conf                          # Configuración del proxy
├── docker-compose.yml                  # Stack completo (OHIF + Proxy)
├── platform/app/public/config/
│   ├── viewmed.js                      # Config directa (original)
│   └── viewmed_proxy.js                # Config con proxy optimizado ⭐
└── INSTRUCCIONES_PROXY.md             # Este archivo
```

## 🚀 Uso

### Opción 1: Docker Compose (Recomendada)

Levanta todo el stack con un comando:

```bash
cd /home/fescalona/proyectos/ohif_custom_vm
docker-compose up -d
```

Accede al viewer en: **http://localhost**

El flujo es:
```
Usuario → Nginx Proxy (localhost) → DCM4CHEE (developer.viewmedonline.com)
              ↓
         [Cache 500MB]
```

### Opción 2: Desarrollo Local (sin Docker)

Si quieres hacer cambios al código y verlos en tiempo real:

```bash
# Terminal 1: Iniciar Nginx proxy standalone
cd /home/fescalona/proyectos/ohif_custom_vm
docker run -d \
  --name nginx_proxy \
  -p 8080:80 \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v nginx_cache:/var/cache/nginx \
  nginx:alpine

# Terminal 2: Iniciar OHIF en modo dev
APP_CONFIG=config/viewmed_proxy.js yarn dev
```

Accede al proxy en: **http://localhost:8080** (apunta al PACS real)
Accede al dev en: **http://localhost:3000** (para desarrollo)

### Opción 3: Build de Producción

```bash
# Usar la configuración del proxy
APP_CONFIG=config/viewmed_proxy.js yarn build

# Servir con Nginx
sudo cp -r platform/app/dist/* /var/www/html/
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo systemctl restart nginx
```

## ⚙️ Optimizaciones Implementadas

### 1. Nginx Proxy (Infraestructura)

**Cache Configurado:**
- 500MB de RAM para cache keys
- 10GB máximo de disco
- TTL: 1 día para imágenes
- Cache por URL + Accept-Encoding (soporta múltiples formatos)

**Compresión:**
- Gzip nivel 6 para metadatos JSON
- Tipos: `application/dicom+json`, `application/json`, etc.
- Ahorro típico: 60-80% en metadatos

**Conexiones:**
- Keepalive: 32 conexiones persistentes
- HTTP/1.1 al backend
- Buffers optimizados para archivos DICOM grandes

### 2. Transfer Syntax (Formato)

En `viewmed_proxy.js`:
```javascript
requestTransferSyntaxUID: '1.2.840.10008.1.2.4.201'  // HTJ2K
```

**Opciones disponibles:**
- `1.2.840.10008.1.2.4.201` - **HTJ2K** (recomendado, más rápido)
- `1.2.840.10008.1.2.4.80` - JPEG-LS Lossless
- `1.2.840.10008.1.2.4.81` - JPEG-LS Near-Lossless
- `1.2.840.10008.1.2.4.90` - JPEG2000 Lossless

**Nota:** Si DCM4CHEE no soporta HTJ2K, OHIF automáticamente cae al formato original.

### 3. Study Prefetcher (UX)

Configuración conservadora:
```javascript
studyPrefetcher: {
  enabled: true,
  displaySetsCount: 2,        // Solo 2 series adelante
  maxNumPrefetchRequests: 10,  // Máximo 10 concurrentes
  order: 'closest',           // Más cercanas primero
}
```

Esto carga anticipadamente solo las imágenes necesarias sin saturar la red.

## 📊 Monitoreo

### Verificar que el cache funciona:

```bash
# Ver headers de respuesta
curl -I http://localhost/dcm4chee-arc/aets/VIEWMED/rs/studies

# Buscar: X-Cache-Status: HIT (desde cache) o MISS (primera vez)
```

### Estadísticas de cache:

```bash
# Dentro del contenedor nginx
docker exec ohif_proxy nginx -s reload

# Ver tamaño del cache
docker exec ohif_proxy du -sh /var/cache/nginx/dicom
```

### Logs en tiempo real:

```bash
# Ver logs del proxy (con cache status)
docker-compose logs -f proxy

# Buscar: "cache:HIT" o "cache:MISS"
```

## 🔧 Personalización

### Cambiar el AET (si no es VIEWMED):

Editar `platform/app/public/config/viewmed_proxy.js`:
```javascript
wadoUriRoot: '/dcm4chee-arc/aets/TU_AET/wado',
qidoRoot: '/dcm4chee-arc/aets/TU_AET/rs',
wadoRoot: '/dcm4chee-arc/aets/TU_AET/rs',
```

### Cambiar URL del PACS:

Editar `nginx.conf`, línea 50:
```nginx
upstream dcm4chee_backend {
    server tu-pacs.com:80;  # Cambiar aquí
    keepalive 32;
}
```

### Ajustar tamaño de cache:

En `nginx.conf`, línea 41:
```nginx
proxy_cache_path /var/cache/nginx/dicom
    levels=1:2
    keys_zone=dicom:1000m      # Aumentar a 1GB
    max_size=50g               # Aumentar a 50GB
    inactive=7d;               # 7 días de TTL
```

### Cambiar compresión:

En `viewmed_proxy.js`:
```javascript
// Para HTJ2K (más rápido)
requestTransferSyntaxUID: '1.2.840.10008.1.2.4.201'

// Para JPEG-LS lossless (mejor calidad)
requestTransferSyntaxUID: '1.2.840.10008.1.2.4.80'

// Sin compresión (si hay problemas)
// requestTransferSyntaxUID: undefined
```

## 🐛 Troubleshooting

### Problema: Las imágenes no cargan

```bash
# Verificar conectividad al PACS desde el contenedor
docker exec ohif_proxy wget -O- http://developer.viewmedonline.com/dcm4chee-arc/aets/VIEWMED/rs/studies?limit=1

# Ver logs del proxy
docker-compose logs proxy | tail -50
```

### Problema: CORS errors en el navegador

El proxy ya maneja CORS. Si ves errores:
1. Verifica que accedes por `http://localhost` (no por IP)
2. Limpia cache del navegador
3. Verifica que `viewmed_proxy.js` usa rutas relativas (`/dcm4chee-arc/`)

### Problema: Cache no funciona

```bash
# Reiniciar nginx con reload
docker exec ohif_proxy nginx -s reload

# Limpiar cache
docker-compose down
docker volume rm ohif_custom_vm_nginx_cache
docker-compose up -d
```

### Problema: DCM4CHEE no soporta HTJ2K

Si el PACS devuelve error 406 (Not Acceptable):
```javascript
// En viewmed_proxy.js, cambiar a JPEG-LS
requestTransferSyntaxUID: '1.2.840.10008.1.2.4.80'
```

O desactivar compresión solicitada:
```javascript
// Comenta o elimina esta línea
// requestTransferSyntaxUID: '1.2.840.10008.1.2.4.201',
```

## 🎯 Benchmarks Esperados

Con esta configuración:

| Métrica | Sin Proxy | Con Proxy | Mejora |
|---------|-----------|-----------|---------|
| **Primera carga** | 100% | 100% | Base |
| **Segunda carga** | 100% | 5-20% | **5-20x** |
| **Metadatos** | ~500KB | ~100KB | **5x** (gzip) |
| **Imágenes** | Transcodificación PACS | Cache + HTTP | **2-3x** |
| **Latency** | 200-500ms | 20-50ms (cache) | **10x** |

## 📝 Notas

- El cache se limpia automáticamente después de 1 día de inactividad
- Las imágenes comprimidas (HTJ2K) son ~50% más pequeñas que JPEG tradicional
- El prefetcher solo carga cuando el usuario está viendo una serie (no en background)
- Para producción, considera añadir SSL (Let's Encrypt) al Nginx

## 🚀 Próximos Pasos (Opcional)

1. **SSL/HTTPS**: Añadir certificado SSL para producción
2. **CDN**: Usar CloudFront/CloudFlare delante del proxy
3. **Static WADO**: Pre-exportar estudios frecuentes a S3
4. **Monitoreo**: Añadir Prometheus/Grafana para métricas

---

**¿Preguntas?** Revisa los logs con `docker-compose logs -f`
