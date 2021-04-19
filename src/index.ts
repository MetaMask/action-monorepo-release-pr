import { setFailed as setActionToFailed } from '@actions/core';
import semverIncrement from 'semver/functions/inc';
import semverDiff from 'semver/functions/diff';
import type { ReleaseType as SemverReleaseType } from 'semver';

import {
  getPackagesMetadata,
  getPackagesToUpdate,
  updatePackages,
  getPackageManifest,
  isMajorSemverDiff,
} from './package-operations';
import { getActionInputs, WORKSPACE_ROOT } from './utils';

main().catch((error) => {
  setActionToFailed(error);
});

async function main(): Promise<void> {
  const actionInputs = getActionInputs();

  const rootManifest = await getPackageManifest(WORKSPACE_ROOT, ['version']);
  const { version: currentVersion } = rootManifest;

  let newVersion: string, versionDiff: SemverReleaseType;
  if (actionInputs.ReleaseType) {
    newVersion = semverIncrement(
      currentVersion,
      actionInputs.ReleaseType,
    ) as string;
    versionDiff = actionInputs.ReleaseType;
  } else {
    newVersion = actionInputs.ReleaseVersion as string;
    versionDiff = semverDiff(currentVersion, newVersion) as SemverReleaseType;
  }

  // If the version bump is major, we will synchronize the versions of all
  // monorepo packages, meaning the "version" field of their manifests and
  // their version range whenever they appear as a dependency.
  const synchronizeVersions = isMajorSemverDiff(versionDiff);

  const allPackages = await getPackagesMetadata();
  const packagesToUpdate = await getPackagesToUpdate(
    allPackages,
    synchronizeVersions,
  );
  await updatePackages(allPackages, {
    newVersion,
    packagesToUpdate,
    versionDiff,
    synchronizeVersions,
  });
}
