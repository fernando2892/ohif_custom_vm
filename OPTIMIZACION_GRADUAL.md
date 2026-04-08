# Plan de Optimización Gradual - OHIF + Proxy

## ✅ ESTADO ACTUAL (Base)
- Proxy nginx funcionando con cache básico
- OHIF conectado via proxy
- Config conservadora (sin optimizaciones agresivas)

---

## 🎯 FASE 1: Optimizar OHIF - Nivel 1 (Conservador)

### Cambios propuestos:
```javascript
// Añadir a la config:
maxNumberOfWebWorkers: 6        // Era: default (3)
maxNumRequests: {
  interaction: 50,              // Era: default (20)
  thumbnail: 30,                // Era: default
  prefetch: 20,                 // Era: default
}
```

### Test:
1. Abrir estudio grande (CT con 300+ slices)
2. Medir tiempo de carga inicial
3. Verificar que no hay errores de cache

### Checkpoint:
- [ ] ¿Carga sin errores?
- [ ] ¿No hay `CACHE_SIZE_EXCEEDED`?
- [ ] ¿Tiempo de carga aceptable?

---

## 🎯 FASE 2: Optimizar OHIF - Nivel 2 (Moderado)

### Cambios propuestos:
```javascript
// Añadir:
studyPrefetcher: {
  enabled: true,
  displaySetsCount: 2,          // Precargar 2 series
  maxNumPrefetchRequests: 10,
  order: 'closest',
}
enableStudyLazyLoad: true       // Carga lazy de estudios
```

### Test:
1. Navegar entre series
2. Verificar prefetch carga siguiente serie

### Checkpoint:
- [ ] ¿Prefetch funciona sin saturar?
- [ ] ¿Navegación fluida entre series?

---

## 🎯 FASE 3: Optimizar OHIF - Nivel 3 (Agresivo)

### Cambios propuestos:
```javascript
// Solo si Fase 1 y 2 funcionan bien:
maxNumberOfWebWorkers: 8
maxNumRequests: {
  interaction: 100,
  thumbnail: 75,
  prefetch: 50,
}
studyPrefetcher: {
  displaySetsCount: 3,          // Aumentar a 3 series
  maxNumPrefetchRequests: 20,
}
```

### Test:
1. Carga máxima: estudio grande + navegación rápida
2. Verificar memory usage

---

## 🎯 FASE 4: Cache de OHIF (Opcional)

### Cambios propuestos:
```javascript
// Solo si hay RAM suficiente:
maxCacheSize: 512              // 512MB (default es ~256MB)
```

### Test:
1. Revisitar mismo estudio
2. Verificar carga desde cache

---

## 🔧 Verificación del Proxy

En cada fase, verificar que el proxy cache funciona:

```bash
# Ver hit rate del cache
curl -I http://localhost:80/dcm4chee-arc/aets/VIEWMED/rs/studies?limit=1

# Buscar header: X-Cache-Status: HIT (cache) o MISS (PACS)
```

En navegador (F12 → Network):
- Respuestas con `X-Cache-Status: HIT` = Viene del cache (rápido)
- Respuestas con `X-Cache-Status: MISS` = Viene del PACS (lento primera vez)

---

## ⚠️ Reglas de Oro

1. **Si hay `CACHE_SIZE_EXCEEDED`**: Bajar `maxNumberOfWebWorkers` y `maxNumRequests`
2. **Si el navegador se congela**: Bajar workers o desactivar prefetch
3. **Si el proxy falla**: Verificar con `docker logs ohif_proxy`
4. **Siempre probar en modo incógnito** para evitar cache del browser

---

## 🚀 Comandos Útiles

```bash
# Ver estado del proxy
docker logs ohif_proxy --tail 20

# Ver cache hit/miss
docker logs ohif_proxy | grep "cache:"

# Reiniciar proxy
docker restart ohif_proxy

# Probar endpoint del PACS via proxy
curl -I http://localhost:80/dcm4chee-arc/aets/VIEWMED/rs/studies?limit=1
```

---

## 📊 Métricas a Medir

| Métrica | Base (Ahora) | Fase 1 | Fase 2 | Fase 3 |
|---------|--------------|--------|--------|--------|
| Tiempo carga CT 500 slices | ? | ? | ? | ? |
| Tiempo primera imagen visible | ? | ? | ? | ? |
| Cache hit rate | 0% | ? | ? | ? |
| Navegación MPR fluida | ? | ? | ? | ? |
| Errores de cache | 0 | 0 | 0 | 0 |

---

## ¿Listo para empezar?

1. Primero probamos la Fase 1 (config nivel 1)
2. Si funciona, pasamos a Fase 2
3. Si todo bien, Fase 3
4. Fase 4 solo si hay RAM suficiente

**¿Empezamos con Fase 1?**
