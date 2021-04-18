import { setFailed as setActionToFailed } from '@actions/core';
import semver, { ReleaseType } from 'semver';

import {
  getPackagesMetadata,
  getPackagesToUpdate,
  updatePackages,
  getPackageManifest,
} from './package-operations';
import { WORKSPACE, INPUTS, validateInputs } from './utils';

main().catch((error) => {
  setActionToFailed(error);
});

async function main(): Promise<void> {
  validateInputs();

  const rootManifest = await getPackageManifest(WORKSPACE, ['version']);

  let newVersion: string;
  if (INPUTS.BUMP_TYPE) {
    const { version: currentVersion } = rootManifest;

    newVersion = semver.inc(
      currentVersion,
      INPUTS.BUMP_TYPE as ReleaseType,
    ) as string;
  } else {
    newVersion = INPUTS.BUMP_VERSION as string;
  }

  const allPackages = await getPackagesMetadata();
  const packagesToUpdate = await getPackagesToUpdate(
    allPackages,
    INPUTS.BUMP_TYPE,
  );
  await updatePackages(newVersion, allPackages, packagesToUpdate);
}
