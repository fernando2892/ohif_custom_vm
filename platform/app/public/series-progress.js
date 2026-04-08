// Indicador de progreso visual para precarga de series
// Se muestra en la parte superior del Study Browser

(function () {
  'use strict';

  let progressContainer = null;
  let progressBar = null;
  let progressText = null;
  let loadingSeries = new Map();
  let totalSeries = 0;
  let completedSeries = 0;

  // Crear el indicador visual
  function createProgressIndicator() {
    // Buscar el Study Browser
    const studyBrowser = document.querySelector('[data-cy="studyBrowser-panel"]');
    if (!studyBrowser) {
      setTimeout(createProgressIndicator, 500);
      return;
    }

    // Verificar si ya existe
    if (document.getElementById('series-progress-container')) {
      return;
    }

    // Crear contenedor principal
    progressContainer = document.createElement('div');
    progressContainer.id = 'series-progress-container';
    progressContainer.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      margin: 8px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      display: none;
      position: sticky;
      top: 0;
    `;

    // Texto de estado
    progressText = document.createElement('div');
    progressText.id = 'series-progress-text';
    progressText.style.cssText = `
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    progressText.innerHTML = `
      <span>📥 Precargando series...</span>
      <span id="series-progress-count">0/0</span>
    `;

    // Barra de progreso
    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.cssText = `
      width: 100%;
      height: 6px;
      background: rgba(255,255,255,0.3);
      border-radius: 3px;
      overflow: hidden;
    `;

    progressBar = document.createElement('div');
    progressBar.id = 'series-progress-bar';
    progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: #fff;
      border-radius: 3px;
      transition: width 0.3s ease;
      box-shadow: 0 0 10px rgba(255,255,255,0.5);
    `;

    progressBarContainer.appendChild(progressBar);
    progressContainer.appendChild(progressText);
    progressContainer.appendChild(progressBarContainer);

    // Insertar al principio del Study Browser
    const firstChild = studyBrowser.firstChild;
    if (firstChild) {
      studyBrowser.insertBefore(progressContainer, firstChild);
    } else {
      studyBrowser.appendChild(progressContainer);
    }

    console.log('[Series Progress] Indicador creado');
  }

  // Actualizar progreso
  function updateProgress() {
    if (!progressContainer || !progressBar || !progressText) return;

    const total = loadingSeries.size;
    const completed = Array.from(loadingSeries.values()).filter(v => v === 'loaded').length;
    const loading = Array.from(loadingSeries.values()).filter(v => v === 'loading').length;

    if (total === 0) {
      progressContainer.style.display = 'none';
      return;
    }

    progressContainer.style.display = 'block';

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    progressBar.style.width = percentage + '%';

    const countElement = document.getElementById('series-progress-count');
    if (countElement) {
      if (loading > 0) {
        countElement.textContent = `${completed}/${total} (${loading} cargando)`;
      } else {
        countElement.textContent = `${completed}/${total}`;
      }
    }

    // Si todo completado, mostrar mensaje de éxito y ocultar
    if (completed === total && loading === 0) {
      progressText.innerHTML = `
        <span>✅ Series cargadas</span>
        <span>${completed}/${total}</span>
      `;
      setTimeout(() => {
        if (progressContainer) {
          progressContainer.style.opacity = '0';
          progressContainer.style.transition = 'opacity 0.5s ease';
          setTimeout(() => {
            progressContainer.style.display = 'none';
            progressContainer.style.opacity = '1';
            loadingSeries.clear();
          }, 500);
        }
      }, 2000);
    }
  }

  // Monitorear thumbnails
  function monitorThumbnails() {
    const thumbnails = document.querySelectorAll('[data-cy="thumbnail-list"]');

    thumbnails.forEach((thumb, index) => {
      const seriesId = thumb.getAttribute('data-display-set-instance-uid') || `series-${index}`;

      if (!loadingSeries.has(seriesId)) {
        // Verificar si tiene imagen cargada
        const img = thumb.querySelector('img');
        if (img && img.src && !img.src.includes('data:image')) {
          loadingSeries.set(seriesId, 'loaded');
        } else {
          loadingSeries.set(seriesId, 'loading');

          // Observar cuando la imagen cargue
          if (img) {
            img.addEventListener('load', () => {
              loadingSeries.set(seriesId, 'loaded');
              updateProgress();
            });
          }
        }
      }
    });

    if (loadingSeries.size > 0) {
      updateProgress();
    }
  }

  // Iniciar cuando el DOM esté listo
  function init() {
    createProgressIndicator();

    // Monitorear cambios en el DOM
    const observer = new MutationObserver(() => {
      monitorThumbnails();
      if (!document.getElementById('series-progress-container')) {
        createProgressIndicator();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Monitorear cada segundo
    setInterval(() => {
      monitorThumbnails();
    }, 1000);

    console.log('[Series Progress] Monitoreo iniciado');
  }

  // Esperar a que cargue OHIF
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000);
  }
})();
