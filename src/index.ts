import { setFailed as setActionToFailed } from '@actions/core';
import semverIncrement from 'semver/functions/inc';
import semverDiff from 'semver/functions/diff';
import type { ReleaseType } from 'semver';

import {
  getPackagesMetadata,
  getPackagesToUpdate,
  updatePackages,
  getPackageManifest,
} from './package-operations';
import { getActionInputs, WORKSPACE_ROOT } from './utils';

main().catch((error) => {
  setActionToFailed(error);
});

async function main(): Promise<void> {
  const actionInputs = getActionInputs();

  const rootManifest = await getPackageManifest(WORKSPACE_ROOT, ['version']);
  const { version: currentVersion } = rootManifest;

  let newVersion: string, versionDiff: ReleaseType;
  if (actionInputs.BumpType) {
    newVersion = semverIncrement(
      currentVersion,
      actionInputs.BumpType,
    ) as string;
    versionDiff = actionInputs.BumpType;
  } else {
    newVersion = actionInputs.BumpVersion as string;
    versionDiff = semverDiff(currentVersion, newVersion) as ReleaseType;
  }

  const allPackages = await getPackagesMetadata();
  const packagesToUpdate = await getPackagesToUpdate(allPackages, versionDiff);
  await updatePackages(allPackages, {
    newVersion,
    packagesToUpdate,
    versionDiff,
  });
}
