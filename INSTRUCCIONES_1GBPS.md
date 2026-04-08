# OHIF + Proxy Nginx - OPTIMIZADO para Redes Médicas 1Gbps+

Esta configuración está diseñada específicamente para **redes médicas de alta velocidad** (1Gbps+) donde el ancho de banda no es el cuello de botella.

## 🎯 Filosofía de esta Configuración

En redes lentas: **Comprimir todo, ahorrar bytes**  
En redes 1Gbps médicas: **Maximizar paralelismo, priorizar calidad diagnóstica**

```
┌─────────────────────────────────────────────────────────────┐
│                    RED MÉDICA 1Gbps                          │
│                                                              │
│  OHIF ←── 12 Workers ──→ Nginx ←── 128 conexiones ──→ PACS  │
│         200 req concurrentes          Keepalive            │
│                                                              │
│  • Sin compresión de imágenes (calidad diagnóstica)         │
│  • Prefetch agresivo (5 series adelante)                    │
│  • Cache masivo (4GB RAM + 100GB disco)                     │
│  • HTTP/2 ready                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Comparativa: Config Normal vs 1Gbps

| Parámetro | Config Normal | Config 1Gbps | Razón |
|-----------|---------------|--------------|-------|
| **Web Workers** | 6 | 12 | Más paralelismo CPU |
| **Requests concurrentes** | 100 | 200 | Doble throughput |
| **Prefetch** | 2 series | 5 series | La red soporta carga |
| **Cache** | 500MB | 4GB | Más datos en RAM |
| **Compresión gzip** | Nivel 6 | Nivel 2 | Ahorrar CPU, red sobra |
| **Compresión imágenes** | HTJ2K | Sin comprimir | Calidad diagnóstica 100% |
| **Keepalive** | 32 | 128 | Más reutilización |
| **Timeouts** | 30s | 600s | Estudios grandes sin timeout |

## 🚀 Uso Rápido

### 1. Despliegue completo (Docker)

```bash
cd /home/fescalona/proyectos/ohif_custom_vm

# Levantar stack optimizado para 1Gbps
docker-compose -f docker-compose-fast.yml up -d

# Ver logs de performance
docker-compose -f docker-compose-fast.yml logs -f proxy
```

Accede a: **http://localhost**

### 2. Desarrollo Local (para modificar código)

```bash
# Terminal 1: Proxy Nginx optimizado
docker run -d \
  --name nginx_proxy_fast \
  -p 8080:80 \
  -v $(pwd)/nginx-fast.conf:/etc/nginx/nginx.conf:ro \
  -v nginx_cache:/var/cache/nginx \
  --ulimit nofile=65535:65535 \
  nginx:alpine

# Terminal 2: OHIF en modo desarrollo
APP_CONFIG=config/viewmed_fast.js yarn dev
```

## ⚙️ Archivos de Configuración

### 1. `nginx-fast.conf` - Proxy Optimizado

**Características para 1Gbps:**

```nginx
# Workers y conexiones masivas
worker_connections 4096;           # Era 1024
worker_rlimit_nofile 65535;        # Límites del sistema

# Keepalive agresivo
keepalive 128;                     # Era 32
keepalive_timeout 300s;            # Conexiones persistentes

# Gzip reducido (ahorrar CPU)
gzip_comp_level 2;                 # Era 6 - CPU > ancho de banda

# Cache masivo
proxy_cache_path ... max_size=100g; # Era 10GB
proxy_cache_slice 1m;              # Slicing para range requests

# Timeouts extendidos
proxy_read_timeout 600s;           # Estudios grandes
```

### 2. `viewmed_fast.js` - OHIF Optimizado

**Características para 1Gbps:**

```javascript
// Paralelismo máximo
maxNumberOfWebWorkers: 12;          // Era 6
maxNumRequests: {
  interaction: 200,                 // Era 100
  prefetch: 100,                    // Era 50
}

// Prefetch agresivo (la red soporta)
studyPrefetcher: {
  displaySetsCount: 5,              // Era 2
  maxNumPrefetchRequests: 30,       // Era 10
}

// Calidad diagnóstica sin compromisos
// Sin requestTransferSyntaxUID = usa lo que tiene el PACS
// Esto evita transcodificación y mantiene calidad original

// Cache masivo
maxCacheSize: 4096,                 // 4GB (era 2GB)
```

## 🔬 Detalles Técnicos

### Por qué SIN compresión de transfer syntax?

En redes 1Gbps médicas:

```
CT de 500 slices sin comprimir:  ~250MB
Tiempo en 1Gbps:                  ~2 segundos

CT de 500 slices JPEG-LS:         ~150MB  
Tiempo en 1Gbps:                  ~1.2 segundos
Diferencia:                       0.8 segundos

PERO:
- Calidad: Sin compresión = pixel perfect
- CPU PACS: Sin transcodificación = menos carga
- CPU Cliente: Sin decompresión = render más rápido
```

**Para diagnóstico médico, esos 0.8s de diferencia no justifican pérdida de calidad.**

### Range Requests y Slicing

```nginx
# En nginx-fast.conf
proxy_cache_slice 1m;
```

Esto permite:
1. Usuario solicita frame 100 de un estudio
2. Nginx descarga solo ese 1MB (slice), no el estudio completo
3. Múltiples usuarios pueden compartir slices cacheados
4. Perfecto para MPR y navegación rápida

### Jumbo Frames (MTU 9000)

En `docker-compose-fast.yml`:
```yaml
networks:
  ohif_network:
    driver_opts:
      com.docker.network.driver.mtu: 9000
```

Esto reduce overhead de paquetes en un 85% para payloads grandes (DICOM).

## 📈 Monitoreo de Performance

### Ver métricas del proxy:

```bash
# Estadísticas de Nginx
curl http://localhost/nginx_status

# Active connections: 128
# Accepts/Handled/Requests: métricas de throughput
```

### Ver hit rate del cache:

```bash
# En logs, buscar:
# cache:HIT  - Servido desde cache (rápido)
# cache:MISS - Fetch del PACS (lento)
# cache:BYPASS - No cacheable

docker-compose -f docker-compose-fast.yml logs proxy | grep "cache:"
```

### Benchmark rápido:

```bash
# Test de carga de un estudio completo
time curl -o /dev/null \
  http://localhost/dcm4chee-arc/aets/VIEWMED/rs/studies/1.2.3/series

# Con 1Gbps debería saturar la interfaz de red
```

## 🏥 Escenarios Médicos

### Escenario 1: Radiología de Diagnóstico

```javascript
// viewmed_fast.js
studyPrefetcher: {
  displaySetsCount: 10,   // Precargar todo el estudio
  maxNumPrefetchRequests: 50,
}
maxNumRequests: {
  interaction: 300,       // Máximo paralelismo
}
```

El radiólogo quiere ver todo inmediatamente, la red lo soporta.

### Escenario 2: Sala de Emergencias

```javascript
// Prioridad: Tiempo al primer render
enableStudyLazyLoad: true,
studyPrefetcher: {
  displaySetsCount: 2,    // Solo lo necesario
}
```

Cargar rápido la primera imagen, el resto en background.

### Escenario 3: Telemedicina (múltiples sedes)

```nginx
# nginx-fast.conf
proxy_cache_valid 200 30d;  # Cache por 30 días
max_size=500g;              # 500GB de cache
```

La segunda vez que alguien ve el estudio, viene del cache local.

## 🔧 Personalización

### Si necesitas compresión (almacenamiento limitado en PACS):

```javascript
// viewmed_fast.js
// JPEG-LS Lossless: Calidad perfecta, ~40% menos espacio
requestTransferSyntaxUID: '1.2.840.10008.1.2.4.80'

// O HTJ2K para el mejor balance:
requestTransferSyntaxUID: '1.2.840.10008.1.2.4.201'
```

### Si el PACS es muy lento:

```nginx
# nginx-fast.conf
# Aumentar cache tiempo
proxy_cache_valid 200 30d;

# Cache incluso cuando está actualizando
proxy_cache_use_stale updating;
```

### Para múltiples PACS (load balancing):

```nginx
upstream dcm4chee_backend {
    server pacs-primary:80 weight=3;
    server pacs-secondary:80 weight=1;
    server pacs-tertiary:80 backup;
    keepalive 128;
}
```

## 🐛 Troubleshooting

### "Las imágenes cargan muy rápido pero el browser se congela"

**Solución:** Bajar workers o requests:
```javascript
maxNumberOfWebWorkers: 8;    // Era 12
maxNumRequests: {
  interaction: 100,           // Era 200
}
```

### "El PACS se sobrecarga"

**Solución:** Reducir concurrencia al PACS:
```nginx
# Limitar conexiones por IP
limit_conn_zone $binary_remote_addr zone=perip:10m;
limit_conn perip 50;
```

### "Out of memory en el cliente"

**Solución:** Reducir cache:
```javascript
maxCacheSize: 2048,  // Era 4096 (2GB)
```

## 📊 Benchmarks Esperados en 1Gbps

| Métrica | 100Mbps | 1Gbps (esta config) | Mejora |
|---------|---------|---------------------|--------|
| **CT 500 slices** | 25s | 2.5s | **10x** |
| **Primera imagen** | 500ms | 150ms | **3x** |
| **Prefetch** | 2 series | 5 series | **2.5x** |
| **Cache hit** | 80% | 95% | **+15%** |
| **CPU cliente** | 60% | 40% | **-33%** |
| **Calidad** | Comprimida | Original | **100%** |

## 🚀 Próximos Pasos (Opcional)

1. **HTTP/2 o HTTP/3**: Añadir SSL para habilitar multiplexación
2. **WebSocket**: Para notificaciones push de nuevos estudios
3. **Service Worker**: Cache offline en el browser
4. **WADO-RS Part 3**: Bulkdata para metadatos separados

---

**¿Listo para probar?**
```bash
docker-compose -f docker-compose-fast.yml up -d
```

Monitoriza con: `docker stats` y `docker-compose logs -f proxy`
