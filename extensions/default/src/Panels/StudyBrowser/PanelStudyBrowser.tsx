import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
  useMemo,
} from 'react';
import { useImageViewer } from '@ohif/ui-next';
import { useSystem, utils } from '@ohif/core';
import { useNavigate } from 'react-router-dom';
import { useViewportGrid, StudyBrowser, Separator } from '@ohif/ui-next';
import { PanelStudyBrowserHeader } from './PanelStudyBrowserHeader';
import { defaultActionIcons } from './constants';
import MoreDropdownMenu from '../../Components/MoreDropdownMenu';
import { CallbackCustomization } from 'platform/core/src/types';
import { type TabsProps } from '@ohif/core/src/utils/createStudyBrowserTabs';

const { sortStudyInstances, formatDate, createStudyBrowserTabs } = utils;

const thumbnailNoImageModalities = ['SR', 'SEG', 'RTSTRUCT', 'RTPLAN', 'RTDOSE', 'DOC', 'PMAP'];

// Helpers para suscribirse al store de progreso de carga de imágenes (extensión cornerstone)
const _getImageProgressSnapshot = () => {
  const store = (window as any).imageLoadProgressStore;
  return store ? store.getState() : { globalLoaded: 0, globalFailed: 0, progressBySeriesUID: {} };
};

function LoadingProgressIndicator({ displaySets }: { displaySets: any[] }) {
  // Use a ref to store the latest subscribe function, or trigger a re-render if store becomes available
  const [storeAvailable, setStoreAvailable] = React.useState(!!(window as any).imageLoadProgressStore);

  React.useEffect(() => {
    if (!storeAvailable) {
      const interval = setInterval(() => {
        if ((window as any).imageLoadProgressStore) {
          setStoreAvailable(true);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [storeAvailable]);

  const subscribe = React.useCallback((callback: () => void) => {
    const store = (window as any).imageLoadProgressStore;
    return store ? store.subscribe(callback) : () => {};
  }, [storeAvailable]);

  const imageLoadState = useSyncExternalStore(
    subscribe,
    _getImageProgressSnapshot,
    _getImageProgressSnapshot
  );

  const { loadingProgress, isLoading, loadedFrames, totalFrames } = useMemo(() => {
    const imagingDisplaySets = (displaySets || []).filter(
      ds => !thumbnailNoImageModalities.includes(ds.modality)
    );

    let total = 0;
    imagingDisplaySets.forEach(ds => {
      total += ds.numInstances || 0;
    });

    const loadedRaw = imageLoadState.globalLoaded + imageLoadState.globalFailed;
    // Cap the loaded frames to not exceed the total, since globalLoaded tracks all frames across the app
    const loaded = total > 0 ? Math.min(loadedRaw, total) : 0;

    if (total === 0) {
      return {
        loadingProgress: 0,
        isLoading: imagingDisplaySets.length > 0,
        loadedFrames: 0,
        totalFrames: imagingDisplaySets.reduce((sum, ds) => {
          return sum + (ds.numImageFrames ?? ds.numInstances ?? 0);
        }, 0),
      };
    }

    const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
    return {
      loadingProgress: progress,
      isLoading: total > 0 && loaded < total,
      loadedFrames: loaded,
      totalFrames: total,
    };
  }, [displaySets, imageLoadState]);

  if (!isLoading && totalFrames > 0) {
    return (
      <div
        className="loading-complete-indicator"
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', // OHIF blue tones
          color: 'white',
          padding: '8px 16px',
          margin: '8px',
          borderRadius: '8px',
          fontSize: '13px',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        {loadedFrames} de {totalFrames} imágenes cargadas
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-primary-dark m-2 rounded-lg p-3 text-white shadow-lg">
        <div className="mb-1 flex justify-between text-xs text-white">
          <span>Cargando Imágenes...</span>
          <span>{loadingProgress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary-dark">
          <div
            className="h-full bg-primary-light transition-all duration-300 ease-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
        <div className="mt-1 text-center text-[10px] text-gray-400">
          {loadedFrames} de {totalFrames} imágenes
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Study Browser component that displays and manages studies and their display sets
 */
function PanelStudyBrowser({
  getImageSrc,
  getStudiesForPatientByMRN,
  requestDisplaySetCreationForStudy,
  dataSource,
  customMapDisplaySets,
  onClickUntrack,
  onDoubleClickThumbnailHandlerCallBack,
}) {
  const { servicesManager, commandsManager, extensionManager } = useSystem();
  const { displaySetService, customizationService } = servicesManager.services;
  const navigate = useNavigate();
  const studyMode =
    (customizationService.getCustomization('studyBrowser.studyMode') as string) || 'all';

  const internalImageViewer = useImageViewer();
  const StudyInstanceUIDs = internalImageViewer.StudyInstanceUIDs;
  const fetchedStudiesRef = useRef(new Set());

  const [{ activeViewportId, viewports, isHangingProtocolLayout }] = useViewportGrid();
  const [activeTabName, setActiveTabName] = useState(studyMode);
  const [expandedStudyInstanceUIDs, setExpandedStudyInstanceUIDs] = useState(
    studyMode === 'primary' && StudyInstanceUIDs.length > 0
      ? [StudyInstanceUIDs[0]]
      : [...StudyInstanceUIDs]
  );
  const [hasLoadedViewports, setHasLoadedViewports] = useState(false);
  const [studyDisplayList, setStudyDisplayList] = useState([]);
  const [displaySets, setDisplaySets] = useState([]);
  const [displaySetsLoadingState, setDisplaySetsLoadingState] = useState({});
  const [thumbnailImageSrcMap, setThumbnailImageSrcMap] = useState({});
  const [jumpToDisplaySet, setJumpToDisplaySet] = useState(null);

  const [viewPresets, setViewPresets] = useState(
    customizationService.getCustomization('studyBrowser.viewPresets')
  );

  const [actionIcons, setActionIcons] = useState(defaultActionIcons);

  // multiple can be true or false
  const updateActionIconValue = actionIcon => {
    actionIcon.value = !actionIcon.value;
    const newActionIcons = [...actionIcons];
    setActionIcons(newActionIcons);
  };

  // only one is true at a time
  const updateViewPresetValue = viewPreset => {
    if (!viewPreset) {
      return;
    }
    const newViewPresets = viewPresets.map(preset => {
      preset.selected = preset.id === viewPreset.id;
      return preset;
    });
    setViewPresets(newViewPresets);
  };

  const mapDisplaySetsWithState = customMapDisplaySets || _mapDisplaySets;

  const onDoubleClickThumbnailHandler = useCallback(
    async displaySetInstanceUID => {
      const customHandler = customizationService.getCustomization(
        'studyBrowser.thumbnailDoubleClickCallback'
      ) as CallbackCustomization;

      const setupArgs = {
        activeViewportId,
        commandsManager,
        servicesManager,
        isHangingProtocolLayout,
        appConfig: extensionManager.appConfig,
      };

      const handlers = customHandler?.callbacks.map(callback => callback(setupArgs));

      for (const handler of handlers) {
        await handler(displaySetInstanceUID);
      }
      onDoubleClickThumbnailHandlerCallBack?.(displaySetInstanceUID);
    },
    [
      activeViewportId,
      commandsManager,
      servicesManager,
      isHangingProtocolLayout,
      customizationService,
    ]
  );

  // ~~ studyDisplayList
  useEffect(() => {
    // Fetch all studies for the patient in each primary study
    async function fetchStudiesForPatient(StudyInstanceUID) {
      // Skip fetching if we've already fetched this study
      if (fetchedStudiesRef.current.has(StudyInstanceUID)) {
        return;
      }

      fetchedStudiesRef.current.add(StudyInstanceUID);

      try {
        // current study qido
        const qidoForStudyUID = await dataSource.query.studies.search({
          studyInstanceUid: StudyInstanceUID,
        });

        let qidoStudiesForPatient = qidoForStudyUID;

        // try to fetch the prior studies based on the patientID if the
        // server can respond.
        try {
          qidoStudiesForPatient = await getStudiesForPatientByMRN(qidoForStudyUID);
        } catch (error) {
          console.warn(
            `[PanelStudyBrowser] Error fetching prior studies for ${StudyInstanceUID}:`,
            error
          );
        }

        // Validate data before processing
        if (!Array.isArray(qidoStudiesForPatient)) {
          console.warn(
            `[PanelStudyBrowser] Invalid response for study ${StudyInstanceUID}:`,
            qidoStudiesForPatient
          );
          return;
        }

        const mappedStudies = _mapDataSourceStudies(qidoStudiesForPatient);
        const actuallyMappedStudies = mappedStudies.map(qidoStudy => {
          return {
            studyInstanceUid: qidoStudy.StudyInstanceUID,
            date: formatDate(qidoStudy.StudyDate) || '',
            description: qidoStudy.StudyDescription,
            modalities: qidoStudy.ModalitiesInStudy,
            numInstances: Number(qidoStudy.NumInstances),
          };
        });

        setStudyDisplayList(prevArray => {
          const ret = [...prevArray];
          for (const study of actuallyMappedStudies) {
            if (!prevArray.find(it => it.studyInstanceUid === study.studyInstanceUid)) {
              ret.push(study);
            }
          }
          return ret;
        });
      } catch (error) {
        console.error(`[PanelStudyBrowser] Error fetching study ${StudyInstanceUID}:`, error);
        // Don't let one failed study block the entire loading
      }
    }

    StudyInstanceUIDs.forEach(sid => fetchStudiesForPatient(sid));
  }, [StudyInstanceUIDs, dataSource, getStudiesForPatientByMRN, navigate]);

  // ~~ Initial Thumbnails
  useEffect(() => {
    if (!hasLoadedViewports) {
      if (activeViewportId) {
        // Once there is an active viewport id, it means the layout is ready
        // so wait a bit of time to allow the viewports preferential loading
        // which improves user experience of responsiveness significantly on slower
        // systems.
        const delayMs = 250 + displaySetService.getActiveDisplaySets().length * 10;
        window.setTimeout(() => setHasLoadedViewports(true), delayMs);
      }

      return;
    }

    let currentDisplaySets = displaySetService.activeDisplaySets;
    // filter non based on the list of modalities that are supported by cornerstone
    currentDisplaySets = currentDisplaySets.filter(
      ds => !thumbnailNoImageModalities.includes(ds.Modality) || ds.thumbnailSrc === null
    );

    if (!currentDisplaySets.length) {
      return;
    }

    currentDisplaySets.forEach(async dSet => {
      // SKIP PR (Presentation State) and other problematic modalities
      if (dSet.Modality === 'PR' || dSet.Modality === 'KO') {
        console.warn(
          `[PanelStudyBrowser] Skipping ${dSet.Modality} displaySet:`,
          dSet.displaySetInstanceUID
        );
        // Mark as loaded to not block progress
        setThumbnailImageSrcMap(prevState => ({
          ...prevState,
          [dSet.displaySetInstanceUID]: null,
        }));
        return;
      }

      try {
        const newImageSrcEntry = {};
        const displaySet = displaySetService.getDisplaySetByUID(dSet.displaySetInstanceUID);

        // Validate displaySet exists
        if (!displaySet) {
          console.warn(`[PanelStudyBrowser] DisplaySet not found:`, dSet.displaySetInstanceUID);
          return;
        }

        // Skip unsupported displaySets
        if (displaySet?.unsupported) {
          return;
        }

        let imageIds;
        try {
          imageIds = dataSource.getImageIdsForDisplaySet(dSet);
        } catch (error) {
          console.warn(
            `[PanelStudyBrowser] Error getting imageIds for displaySet ${dSet.displaySetInstanceUID}:`,
            error
          );
          // Mark as loaded to not block progress
          setThumbnailImageSrcMap(prevState => ({
            ...prevState,
            [dSet.displaySetInstanceUID]: null,
          }));
          return;
        }

        const imageId = getImageIdForThumbnail(displaySet, imageIds);

        // When the image arrives, render it and store the result in the thumbnailImgSrcMap
        let { thumbnailSrc } = displaySet;
        if (!thumbnailSrc && displaySet.getThumbnailSrc) {
          try {
            thumbnailSrc = await displaySet.getThumbnailSrc({ getImageSrc });
          } catch (error) {
            console.warn(
              `[PanelStudyBrowser] Error getting thumbnailSrc for displaySet ${dSet.displaySetInstanceUID}:`,
              error
            );
            thumbnailSrc = null;
          }
        }
        if (!thumbnailSrc && imageId) {
          try {
            thumbnailSrc = await getImageSrc(imageId);
            displaySet.thumbnailSrc = thumbnailSrc;
          } catch (error) {
            console.warn(
              `[PanelStudyBrowser] Error fetching thumbnail for displaySet ${dSet.displaySetInstanceUID}:`,
              error
            );
            thumbnailSrc = null;
          }
        }
        newImageSrcEntry[dSet.displaySetInstanceUID] = thumbnailSrc;

        setThumbnailImageSrcMap(prevState => {
          return { ...prevState, ...newImageSrcEntry };
        });
      } catch (error) {
        console.error(
          `[PanelStudyBrowser] Unexpected error processing displaySet ${dSet.displaySetInstanceUID}:`,
          error
        );
        // Mark as loaded to not block progress even on error
        setThumbnailImageSrcMap(prevState => ({
          ...prevState,
          [dSet.displaySetInstanceUID]: null,
        }));
      }
    });
  }, [displaySetService, dataSource, getImageSrc, activeViewportId, hasLoadedViewports]);

  // ~~ displaySets
  useEffect(() => {
    const currentDisplaySets = displaySetService.activeDisplaySets;

    if (!currentDisplaySets.length) {
      return;
    }

    const mappedDisplaySets = mapDisplaySetsWithState(
      currentDisplaySets,
      displaySetsLoadingState,
      thumbnailImageSrcMap,
      viewports
    );

    if (!customMapDisplaySets) {
      sortStudyInstances(mappedDisplaySets);
    }

    setDisplaySets(mappedDisplaySets);
  }, [
    displaySetService.activeDisplaySets,
    displaySetsLoadingState,
    viewports,
    thumbnailImageSrcMap,
    customMapDisplaySets,
  ]);

  // ~~ subscriptions --> displaySets
  useEffect(() => {
    // DISPLAY_SETS_ADDED returns an array of DisplaySets that were added
    const SubscriptionDisplaySetsAdded = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      data => {
        if (!hasLoadedViewports) {
          return;
        }
        const { displaySetsAdded, options } = data;
        displaySetsAdded.forEach(async dSet => {
          const displaySetInstanceUID = dSet.displaySetInstanceUID;

          // SKIP PR (Presentation State) and other problematic modalities
          if (dSet.Modality === 'PR' || dSet.Modality === 'KO') {
            console.warn(
              `[PanelStudyBrowser] Skipping ${dSet.Modality} displaySet in subscription:`,
              displaySetInstanceUID
            );
            setThumbnailImageSrcMap(prevState => ({
              ...prevState,
              [displaySetInstanceUID]: null,
            }));
            return;
          }

          try {
            const newImageSrcEntry = {};
            const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

            if (!displaySet) {
              console.warn(
                `[PanelStudyBrowser] DisplaySet not found in subscription:`,
                displaySetInstanceUID
              );
              return;
            }

            if (displaySet?.unsupported) {
              return;
            }
            if (options?.madeInClient) {
              setJumpToDisplaySet(displaySetInstanceUID);
            }

            let imageIds;
            try {
              imageIds = dataSource.getImageIdsForDisplaySet(displaySet);
            } catch (error) {
              console.warn(
                `[PanelStudyBrowser] Error getting imageIds in subscription for ${displaySetInstanceUID}:`,
                error
              );
              setThumbnailImageSrcMap(prevState => ({
                ...prevState,
                [displaySetInstanceUID]: null,
              }));
              return;
            }

            const imageId = getImageIdForThumbnail(displaySet, imageIds);

            // TODO: Is it okay that imageIds are not returned here for SR displaysets?
            if (!imageId) {
              return;
            }

            // When the image arrives, render it and store the result in the thumbnailImgSrcMap
            let { thumbnailSrc } = displaySet;
            if (!thumbnailSrc && displaySet.getThumbnailSrc) {
              try {
                thumbnailSrc = await displaySet.getThumbnailSrc({ getImageSrc });
              } catch (error) {
                console.warn(
                  `[PanelStudyBrowser] Error getting thumbnailSrc in subscription for ${displaySetInstanceUID}:`,
                  error
                );
                thumbnailSrc = null;
              }
            }
            if (!thumbnailSrc) {
              try {
                thumbnailSrc = await getImageSrc(imageId);
                displaySet.thumbnailSrc = thumbnailSrc;
              } catch (error) {
                console.warn(
                  `[PanelStudyBrowser] Error fetching thumbnail in subscription for ${displaySetInstanceUID}:`,
                  error
                );
                thumbnailSrc = null;
              }
            }
            newImageSrcEntry[displaySetInstanceUID] = thumbnailSrc;

            setThumbnailImageSrcMap(prevState => {
              return { ...prevState, ...newImageSrcEntry };
            });
          } catch (error) {
            console.error(
              `[PanelStudyBrowser] Unexpected error in subscription for ${displaySetInstanceUID}:`,
              error
            );
            setThumbnailImageSrcMap(prevState => ({
              ...prevState,
              [displaySetInstanceUID]: null,
            }));
          }
        });
      }
    );

    return () => {
      SubscriptionDisplaySetsAdded.unsubscribe();
    };
  }, [displaySetService, dataSource, getImageSrc, hasLoadedViewports]);

  useEffect(() => {
    // TODO: Will this always hold _all_ the displaySets we care about?
    // DISPLAY_SETS_CHANGED returns `DisplaySerService.activeDisplaySets`
    const SubscriptionDisplaySetsChanged = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      changedDisplaySets => {
        const mappedDisplaySets = mapDisplaySetsWithState(
          changedDisplaySets,
          displaySetsLoadingState,
          thumbnailImageSrcMap,
          viewports
        );

        if (!customMapDisplaySets) {
          sortStudyInstances(mappedDisplaySets);
        }

        setDisplaySets(mappedDisplaySets);
      }
    );

    const SubscriptionDisplaySetMetaDataInvalidated = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SET_SERIES_METADATA_INVALIDATED,
      () => {
        const mappedDisplaySets = mapDisplaySetsWithState(
          displaySetService.getActiveDisplaySets(),
          displaySetsLoadingState,
          thumbnailImageSrcMap,
          viewports
        );

        if (!customMapDisplaySets) {
          sortStudyInstances(mappedDisplaySets);
        }

        setDisplaySets(mappedDisplaySets);
      }
    );

    return () => {
      SubscriptionDisplaySetsChanged.unsubscribe();
      SubscriptionDisplaySetMetaDataInvalidated.unsubscribe();
    };
  }, [
    displaySetsLoadingState,
    thumbnailImageSrcMap,
    viewports,
    displaySetService,
    customMapDisplaySets,
  ]);

  const tabs = createStudyBrowserTabs(StudyInstanceUIDs, studyDisplayList, displaySets);

  // TODO: Should not fire this on "close"
  function _handleStudyClick(StudyInstanceUID) {
    const shouldCollapseStudy = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    const updatedExpandedStudyInstanceUIDs = shouldCollapseStudy
      ? [...expandedStudyInstanceUIDs.filter(stdyUid => stdyUid !== StudyInstanceUID)]
      : [...expandedStudyInstanceUIDs, StudyInstanceUID];

    setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);

    if (!shouldCollapseStudy) {
      const madeInClient = true;
      requestDisplaySetCreationForStudy(displaySetService, StudyInstanceUID, madeInClient);
    }
  }

  useEffect(() => {
    if (jumpToDisplaySet) {
      // Get element by displaySetInstanceUID
      const displaySetInstanceUID = jumpToDisplaySet;
      const element = document.getElementById(`thumbnail-${displaySetInstanceUID}`);

      if (element && typeof element.scrollIntoView === 'function') {
        // TODO: Any way to support IE here?
        element.scrollIntoView({ behavior: 'smooth' });

        setJumpToDisplaySet(null);
      }
    }
  }, [jumpToDisplaySet, expandedStudyInstanceUIDs, activeTabName]);

  useEffect(() => {
    if (!jumpToDisplaySet) {
      return;
    }

    const displaySetInstanceUID = jumpToDisplaySet;
    // It is possible to navigate to a study not currently in view
    const thumbnailLocation = _findTabAndStudyOfDisplaySet(
      displaySetInstanceUID,
      tabs,
      activeTabName
    );
    if (!thumbnailLocation) {
      return;
    }
    const { tabName, StudyInstanceUID } = thumbnailLocation;
    setActiveTabName(tabName);
    const studyExpanded = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    if (!studyExpanded) {
      const updatedExpandedStudyInstanceUIDs = [...expandedStudyInstanceUIDs, StudyInstanceUID];
      setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);
    }
  }, [expandedStudyInstanceUIDs, jumpToDisplaySet, tabs]);

  const activeDisplaySetInstanceUIDs = viewports.get(activeViewportId)?.displaySetInstanceUIDs;

  return (
    <>
      <>
        <PanelStudyBrowserHeader
          viewPresets={viewPresets}
          updateViewPresetValue={updateViewPresetValue}
          actionIcons={actionIcons}
          updateActionIconValue={updateActionIconValue}
        />
        <Separator
          orientation="horizontal"
          className="bg-background"
          thickness="2px"
        />
      </>

      <LoadingProgressIndicator displaySets={displaySets} />

      <StudyBrowser
        tabs={tabs}
        servicesManager={servicesManager}
        activeTabName={activeTabName}
        expandedStudyInstanceUIDs={expandedStudyInstanceUIDs}
        onClickStudy={_handleStudyClick}
        onClickTab={clickedTabName => {
          setActiveTabName(clickedTabName);
        }}
        onClickUntrack={onClickUntrack}
        onClickThumbnail={() => {}}
        onDoubleClickThumbnail={onDoubleClickThumbnailHandler}
        activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
        showSettings={actionIcons.find(icon => icon.id === 'settings')?.value}
        viewPresets={viewPresets}
        ThumbnailMenuItems={MoreDropdownMenu({
          commandsManager,
          servicesManager,
          menuItemsKey: 'studyBrowser.thumbnailMenuItems',
        })}
        StudyMenuItems={MoreDropdownMenu({
          commandsManager,
          servicesManager,
          menuItemsKey: 'studyBrowser.studyMenuItems',
        })}
      />
    </>
  );
}

export default PanelStudyBrowser;

/**
 * Maps from the DataSource's format to a naturalized object
 *
 * @param {*} studies
 */
function _mapDataSourceStudies(studies) {
  return studies.map(study => {
    // TODO: Why does the data source return in this format?
    return {
      AccessionNumber: study.accession,
      StudyDate: study.date,
      StudyDescription: study.description,
      NumInstances: study.instances,
      ModalitiesInStudy: study.modalities,
      PatientID: study.mrn,
      PatientName: study.patientName,
      StudyInstanceUID: study.studyInstanceUid,
      StudyTime: study.time,
    };
  });
}

function _mapDisplaySets(displaySets, displaySetLoadingState, thumbnailImageSrcMap, viewports) {
  const thumbnailDisplaySets = [];
  const thumbnailNoImageDisplaySets = [];
  displaySets
    .filter(ds => !ds.excludeFromThumbnailBrowser)
    .forEach(ds => {
      const { thumbnailSrc, displaySetInstanceUID } = ds;
      const componentType = _getComponentType(ds);

      const array =
        componentType === 'thumbnail' ? thumbnailDisplaySets : thumbnailNoImageDisplaySets;

      const loadingProgress = displaySetLoadingState?.[displaySetInstanceUID];

      array.push({
        displaySetInstanceUID,
        description: ds.SeriesDescription || '',
        seriesNumber: ds.SeriesNumber,
        modality: ds.Modality,
        seriesDate: formatDate(ds.SeriesDate),
        numInstances: ds.numImageFrames ?? ds.instances?.length,
        // Necesario para la barra de progreso (imageLoadProgressStore usa SeriesInstanceUID)
        SeriesInstanceUID: ds.SeriesInstanceUID,
        loadingProgress,
        countIcon: ds.countIcon,
        messages: ds.messages,
        StudyInstanceUID: ds.StudyInstanceUID,
        componentType,
        imageSrc: thumbnailSrc || thumbnailImageSrcMap[displaySetInstanceUID],
        dragData: {
          type: 'displayset',
          displaySetInstanceUID,
          // .. Any other data to pass
        },
        isHydratedForDerivedDisplaySet: ds.isHydrated,
      });
    });

  return [...thumbnailDisplaySets, ...thumbnailNoImageDisplaySets];
}

function _getComponentType(ds) {
  if (
    thumbnailNoImageModalities.includes(ds.Modality) ||
    ds?.unsupported ||
    ds.thumbnailSrc === null
  ) {
    return 'thumbnailNoImage';
  }

  return 'thumbnail';
}

function getImageIdForThumbnail(displaySet, imageIds) {
  let imageId;
  if (displaySet.isDynamicVolume) {
    const timePoints = displaySet.dynamicVolumeInfo.timePoints;
    const middleIndex = Math.floor(timePoints.length / 2);
    const middleTimePointImageIds = timePoints[middleIndex];
    imageId = middleTimePointImageIds[Math.floor(middleTimePointImageIds.length / 2)];
  } else {
    imageId = imageIds[Math.floor(imageIds.length / 2)];
  }
  return imageId;
}

function _findTabAndStudyOfDisplaySet(
  displaySetInstanceUID: string,
  tabs: TabsProps,
  currentTabName: string
) {
  const current = tabs.find(tab => tab.name === currentTabName) || tabs[0];
  const biasedTabs = [current, ...tabs];

  for (let t = 0; t < biasedTabs.length; t++) {
    const study = biasedTabs[t].studies.find(study =>
      study.displaySets.find(ds => ds.displaySetInstanceUID === displaySetInstanceUID)
    );
    if (study) {
      return {
        tabName: biasedTabs[t].name,
        StudyInstanceUID: study.studyInstanceUid,
      };
    }
  }
}
