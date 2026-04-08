// Customización para mostrar indicador de carga en thumbnails
// Este archivo personaliza el componente Thumbnail para mostrar "Cargando..."
// cuando la serie está siendo precargada

window.config = window.config || {};
window.config.customizationService = window.config.customizationService || {};

// Personalizar el thumbnail para mostrar progreso de carga
window.config.customizationService['studyBrowser.thumbnailLoadingIndicator'] = {
  id: 'studyBrowser.thumbnailLoadingIndicator',
  // Esta customización se aplica al componente Thumbnail
  // cuando loadingProgress < 1, muestra indicador
};

// También podemos personalizar el StudyBrowser para mostrar mensaje global
window.config.customizationService['studyBrowser.loadingMessage'] = {
  id: 'studyBrowser.loadingMessage',
  message: 'Precargando series...',
  showProgress: true,
};
