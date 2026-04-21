import React from 'react';
import { AboutModal } from '@ohif/ui-next';
import detect from 'browser-detect';
import { useTranslation } from 'react-i18next';

function AboutModalDefault() {
  const { os, version, name } = detect();
  const browser = `${name[0].toUpperCase()}${name.substr(1)} ${version}`;
  const versionNumber = process.env.VERSION_NUMBER;
  const commitHash = process.env.COMMIT_HASH;

  const [main, beta] = versionNumber.split('-');

  return (
    <AboutModal className="w-[400px]">
      <AboutModal.ProductName>Visor DICOM ViewMed</AboutModal.ProductName>
      <AboutModal.ProductVersion>{main}</AboutModal.ProductVersion>
      {beta && <AboutModal.ProductBeta>{beta}</AboutModal.ProductBeta>}

      <AboutModal.Body>
        <AboutModal.DetailItem
          label="Commit Hash"
          value={commitHash}
        />
        <AboutModal.DetailItem
          label="Navegador y SO"
          value={`${browser}, ${os}`}
        />
        <a
          href="https://www.viewmedonline.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mt-2 inline-flex items-center text-lg hover:underline"
        >
          www.viewmedonline.com
        </a>
      </AboutModal.Body>
    </AboutModal>
  );
}

export default {
  'ohif.aboutModal': AboutModalDefault,
};
