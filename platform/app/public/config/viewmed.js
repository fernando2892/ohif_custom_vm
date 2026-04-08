/** @type {AppTypes.Config} */
window.config = {
  routerBasename: '/',
  showStudyList: true,
  extensions: [],
  modes: [],
  // Desactivar mensajes de advertencia
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: false,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  // Eliminar mensaje de "investigational use"
  investigationalUseDialog: {
    option: 'never',
  },
  // Optimizaciones de rendimiento
  maxNumberOfWebWorkers: 6,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    prefetch: 50,
  },
  // Configuración de precarga agresiva
  studyPrefetcher: {
    enabled: true,
    displaySetsCount: 20,
    maxNumPrefetchRequests: 30,
    order: 'downward',
  },
  // Handler de errores HTTP para evitar crashes
  httpErrorHandler: error => {
    // El error puede venir con diferentes estructuras
    const status = error?.status || error?.statusCode || error?.status_code;
    const url = error?.url || error?.config?.url || 'unknown';

    // Silenciar errores comunes del PACS que no son críticos
    if (status === 404 || status === 410) {
      // console.warn('[VIEWMED] Recurso no disponible:', url, 'Status:', status);
      return;
    }
    if (status === 403) {
      console.warn('[VIEWMED] Acceso denegado:', url);
      return;
    }
    // Loguear errores HTTP pero no crashear
    console.warn('[VIEWMED] Error HTTP:', status, url);
  },
  defaultDataSourceName: 'viewmed',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'viewmed',
      configuration: {
        friendlyName: 'VIEWMED PACS',
        name: 'VIEWMED',
        // Usar el proxy nginx en localhost:8080
        wadoUriRoot: 'http://localhost:8080/pacs/aets/VIEWMED/wado',
        qidoRoot: 'http://localhost:8080/pacs/aets/VIEWMED/rs',
        wadoRoot: 'http://localhost:8080/pacs/aets/VIEWMED/rs',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        enableStudyLazyLoad: true,
        thumbnailRendering: 'wadors',
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        dicomUploadEnabled: true,
        singlepart: 'pdf,video',
        bulkDataURI: {
          enabled: true,
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  studyListFunctionsEnabled: true,
};

// Filtrar mensajes ERMF ruidosos de Cornerstone3D.
// Bug en @cornerstonejs/core: ERMF=1 es válido (sin magnificación) pero el código
// no maneja el caso 1 > 1 === false && 1 === true === false, cae al console.error.
// Se filtra tanto warn como error porque la librería usa console.error directamente.
(function () {
  function isErmfNoise(args) {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    return msg.includes('Illegal ERMF') || msg.includes('ERMF value');
  }

  const _originalWarn = console.warn.bind(console);
  console.warn = function (...args) {
    if (isErmfNoise(args)) return;
    _originalWarn.apply(console, args);
  };

  const _originalError = console.error.bind(console);
  console.error = function (...args) {
    if (isErmfNoise(args)) return;
    _originalError.apply(console, args);
  };
})();

// Interceptar rechazos de promesas XHR antes de que lleguen al overlay de React/webpack
window.addEventListener(
  'unhandledrejection',
  function (event) {
    const reason = event.reason;
    const isXHRError =
      reason instanceof XMLHttpRequest ||
      (reason &&
        typeof reason === 'object' &&
        'status' in reason &&
        'statusText' in reason);

    if (isXHRError) {
      const status = reason.status;
      if (status !== 404 && status !== 410 && status !== 403) {
        console.warn('[VIEWMED] XHR error interceptado, status:', status);
      }
      event.preventDefault();
      event.stopImmediatePropagation(); // impide que el handler de webpack/React se ejecute
    }
  },
  true // capture phase: se ejecuta antes que cualquier otro handler
);
