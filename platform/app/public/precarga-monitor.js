// Script para monitorear y mostrar progreso de carga de series
// Se ejecuta automáticamente cuando OHIF carga

(function () {
  'use strict';

  // Esperar a que OHIF esté listo
  window.addEventListener('load', function () {
    console.log('[Precarga Monitor] Iniciando monitoreo...');

    // Contador de imágenes cargando
    let loadingCount = 0;
    let loadedCount = 0;
    let totalToLoad = 0;

    // Crear indicador visual
    function createProgressIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'precarga-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: none;
        align-items: center;
        gap: 10px;
        min-width: 200px;
        transition: all 0.3s ease;
      `;

      indicator.innerHTML = `
        <div id="precarga-spinner" style="
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid #fff;
          border-radius: 50%;
          animation: precarga-spin 1s linear infinite;
        "></div>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">Precargando series...</div>
          <div id="precarga-texto" style="font-size: 11px; opacity: 0.9;">Iniciando...</div>
        </div>
        <style>
          @keyframes precarga-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      document.body.appendChild(indicator);
      return indicator;
    }

    const indicator = createProgressIndicator();
    const textoElement = document.getElementById('precarga-texto');

    // Monitorear peticiones XHR
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      let url = '';

      xhr.open = function (method, urlParam) {
        url = urlParam;
        if (url.includes('/dcm4chee-arc/') && url.includes('/instances/')) {
          loadingCount++;
          totalToLoad++;
          updateIndicator();
        }
        return originalOpen.apply(this, arguments);
      };

      xhr.addEventListener('load', function () {
        if (url.includes('/dcm4chee-arc/') && url.includes('/instances/')) {
          loadedCount++;
          loadingCount--;
          updateIndicator();
        }
      });

      xhr.addEventListener('error', function () {
        if (url.includes('/dcm4chee-arc/') && url.includes('/instances/')) {
          loadingCount--;
          updateIndicator();
        }
      });

      return xhr;
    };

    function updateIndicator() {
      if (loadingCount > 0 || totalToLoad > 0) {
        indicator.style.display = 'flex';
        const progress = totalToLoad > 0 ? Math.round((loadedCount / totalToLoad) * 100) : 0;
        textoElement.textContent = `${loadedCount}/${totalToLoad} imágenes (${progress}%)`;

        // Log en consola
        console.log(
          `[Precarga] ${loadedCount}/${totalToLoad} imágenes cargadas (${loadingCount} en progreso)`
        );
      } else if (loadedCount > 0) {
        // Todas cargadas
        textoElement.textContent = '¡Completado!';
        setTimeout(() => {
          indicator.style.opacity = '0';
          setTimeout(() => {
            indicator.style.display = 'none';
            indicator.style.opacity = '1';
          }, 300);
        }, 2000);
      }
    }

    // Reset después de 30 segundos de inactividad
    let inactivityTimer;
    function resetCounter() {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        if (loadingCount === 0) {
          totalToLoad = 0;
          loadedCount = 0;
        }
      }, 30000);
    }

    console.log('[Precarga Monitor] Monitoreo activado');
  });
})();
