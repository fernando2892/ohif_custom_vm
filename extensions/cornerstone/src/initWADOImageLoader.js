import { volumeLoader, imageLoadPoolManager } from '@cornerstonejs/core';
import {
  cornerstoneStreamingImageVolumeLoader,
  cornerstoneStreamingDynamicImageVolumeLoader,
} from '@cornerstonejs/core/loaders';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { errorHandler, utils } from '@ohif/core';

const { registerVolumeLoader } = volumeLoader;

/**
 * Monkey-patch del imageLoadPoolManager para que ninguna promesa de carga de imagen
 * sea un unhandled rejection. El error sigue siendo manejado por handleImageLoadPromise
 * de Cornerstone3D (que dispara IMAGE_LOAD_FAILED y IMAGE_LOADED), por lo que todos
 * los handlers de error siguen funcionando.
 *
 * El problema raíz: xhrRequest.js hace reject(xhr) y requestPoolManager.js
 * usa .finally() sin .catch() en el result — la rejección se propaga al overlay.
 */
function patchImageLoadPoolManager() {
  const origAddRequest = imageLoadPoolManager.addRequest.bind(imageLoadPoolManager);
  imageLoadPoolManager.addRequest = function (requestFn, type, additionalDetails, priority, addToBeginning) {
    const safeFn = () => {
      let result;
      try {
        result = requestFn();
      } catch (e) {
        return Promise.resolve();
      }
      if (result && typeof result.catch === 'function') {
        // Retornar una promesa que nunca rechaza.
        // handleImageLoadPromise ya maneja el error original y dispara IMAGE_LOAD_FAILED.
        return result.catch(() => {});
      }
      return result;
    };
    return origAddRequest(safeFn, type, additionalDetails, priority, addToBeginning);
  };
}

export default function initWADOImageLoader(
  userAuthenticationService,
  appConfig,
  extensionManager
) {
  registerVolumeLoader('cornerstoneStreamingImageVolume', cornerstoneStreamingImageVolumeLoader);

  registerVolumeLoader(
    'cornerstoneStreamingDynamicImageVolume',
    cornerstoneStreamingDynamicImageVolumeLoader
  );

  dicomImageLoader.init({
    maxWebWorkers: Math.min(
      Math.max(navigator.hardwareConcurrency - 1, 1),
      appConfig.maxNumberOfWebWorkers
    ),
    beforeSend: function (xhr) {
      //TODO should be removed in the future and request emitted by DicomWebDataSource
      const sourceConfig = extensionManager.getActiveDataSource()?.[0].getConfig() ?? {};
      const headers = userAuthenticationService.getAuthorizationHeader();
      const acceptHeader = utils.generateAcceptHeader(
        sourceConfig.acceptHeader,
        sourceConfig.requestTransferSyntaxUID,
        sourceConfig.omitQuotationForMultipartRequest
      );

      const xhrRequestHeaders = {
        Accept: acceptHeader,
      };

      if (headers) {
        Object.assign(xhrRequestHeaders, headers);
      }

      return xhrRequestHeaders;
    },
    errorInterceptor: error => {
      const handler = errorHandler.getHTTPErrorHandler();
      if (typeof handler === 'function') {
        handler(error);
      }
    },
  });

  patchImageLoadPoolManager();
}

export function destroy() {
  console.debug('Destroying WADO Image Loader');
}
