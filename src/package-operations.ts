import { promises as fs } from 'fs';
import pathUtils from 'path';
import type { ReleaseType as SemverReleaseType } from 'semver';

import { didPackageChange } from './git-operations';
import {
  isTruthyString,
  isValidSemver,
  readJsonFile,
  ValidSemverReleaseTypes,
  WORKSPACE_ROOT,
} from './utils';

const PACKAGE_JSON = 'package.json';

enum PackageDependencyFields {
  Production = 'dependencies',
  Development = 'devDependencies',
  Peer = 'peerDependencies',
  Bundled = 'bundledDependencies',
  Optional = 'optionalDependencies',
}

export interface PackageManifest
  extends Record<PackageDependencyFields, Record<string, string>> {
  readonly name: string;
  readonly version: string;
}

export interface PackageMetadata {
  readonly dirName: string;
  readonly manifest: Readonly<PackageManifest>;
  readonly name: string;
  readonly path: string;
}

interface UpdateContext {
  readonly versionDiff: SemverReleaseType;
  readonly newVersion: string;
  readonly packagesToUpdate: Set<string>;
  readonly synchronizeVersions: boolean;
}

interface GetPackageMetadataArgs {
  rootDir: string;
  packagesDir: string;
}

export async function getPackagesMetadata(
  args: GetPackageMetadataArgs = {
    rootDir: WORKSPACE_ROOT,
    packagesDir: 'packages',
  },
): Promise<Record<string, PackageMetadata>> {
  const { rootDir, packagesDir } = args;
  const packagesPath = pathUtils.join(rootDir, packagesDir);
  const packagesDirContents = await fs.readdir(packagesPath);

  const result: Record<string, PackageMetadata> = {};
  await Promise.all(
    packagesDirContents.map(async (packageDir) => {
      const packagePath = pathUtils.join(packagesPath, packageDir);
      const manifest = await getPackageManifest(packagePath);

      if ((await fs.lstat(packagePath)).isDirectory()) {
        result[manifest.name] = {
          dirName: packageDir,
          manifest,
          name: manifest.name,
          path: packagePath,
        };
      }
    }),
  );
  return result;
}

/**
 * Given the Action's bump type parameter... TODO
 * @returns An array of the names of the packages to bump.
 */
export async function getPackagesToUpdate(
  allPackages: Record<string, PackageMetadata>,
  synchronizeVersions: boolean,
): Promise<Set<string>> {
  // In order to synchronize versions, we must update every package.
  if (synchronizeVersions) {
    return new Set(Object.keys(allPackages));
  }

  // If we're not synchronizing versions, we only update changed packages.
  return new Set(
    Object.keys(allPackages).filter(async (packageName) => {
      return await didPackageChange(allPackages[packageName]);
    }),
  );
}

/**
 * "Bumps" the specified packages. "Bumping" currently just means overwriting
 * the version.
 */
export async function updatePackages(
  allPackages: Record<string, PackageMetadata>,
  updateContext: UpdateContext,
): Promise<void> {
  const { packagesToUpdate } = updateContext;
  await Promise.all(
    Array.from(packagesToUpdate.keys()).map(async (packageName) =>
      updatePackage(allPackages[packageName], updateContext),
    ),
  );
}

async function updatePackage(
  packageMetadata: PackageMetadata,
  updateContext: UpdateContext,
): Promise<void> {
  await fs.writeFile(
    pathUtils.join(packageMetadata.path, PACKAGE_JSON),
    JSON.stringify(
      getUpdatedManifest(packageMetadata.manifest, updateContext),
      null,
      2,
    ),
  );
}

function getUpdatedManifest(
  currentManifest: PackageManifest,
  updateContext: UpdateContext,
) {
  const { newVersion, synchronizeVersions } = updateContext;
  if (synchronizeVersions) {
    // If we're synchronizing the versions of our updated packages, we also
    // synchronize their versions whenever they appear as a dependency.
    return {
      ...currentManifest,
      ...getUpdatedDependencyFields(currentManifest, updateContext),
      version: newVersion,
    };
  }

  // If we're not synchronizing versions, we leave all dependencies as they are.
  return { ...currentManifest, version: newVersion };
}

function getUpdatedDependencyFields(
  manifest: PackageManifest,
  updateContext: UpdateContext,
): Partial<Pick<PackageManifest, PackageDependencyFields>> {
  return Object.values(PackageDependencyFields).reduce(
    (newDepsFields: Record<string, unknown>, fieldName) => {
      if (fieldName in manifest) {
        newDepsFields[fieldName] = getUpdatedDependencyField(
          manifest[fieldName],
          updateContext,
        );
      }

      return newDepsFields;
    },
    {},
  );
}

function getUpdatedDependencyField(
  dependencyField: Record<string, string>,
  updateContext: UpdateContext,
): Record<string, string> {
  const { newVersion, packagesToUpdate } = updateContext;
  const newVersionRange = `^${newVersion}`;
  return Object.keys(dependencyField).reduce(
    (newDeps: Record<string, string>, packageName) => {
      newDeps[packageName] = packagesToUpdate.has(packageName)
        ? newVersionRange
        : dependencyField[packageName];

      return newDeps;
    },
    {},
  );
}

/**
 * Read, parse, and return the object corresponding to the package.json file
 * in the given directory.
 * @param containingDirPath - The path to the directory containing the
 * package.json file.
 * @returns The object corresponding to the parsed package.json file.
 */
export async function getPackageManifest<T extends keyof PackageManifest>(
  containingDirPath: string,
  requiredFields?: T[],
): Promise<Pick<PackageManifest, T>> {
  const manifest = await readJsonFile(
    pathUtils.join(containingDirPath, PACKAGE_JSON),
  );

  validatePackageManifest(manifest, containingDirPath, requiredFields);
  return manifest as Pick<PackageManifest, T>;
}

function validatePackageManifest(
  manifest: Record<string, unknown>,
  manifestDirPath: string,
  requiredFields: (keyof PackageManifest)[] = ['name', 'version'],
): void {
  const legiblePath = manifestDirPath.split('/').splice(-2).join('/');
  if (requiredFields.includes('name') && !isTruthyString(manifest.name)) {
    throw new Error(
      `Manifest in "${legiblePath}" does not have a valid "name" field.`,
    );
  }

  if (requiredFields.includes('version') && !isValidSemver(manifest.version)) {
    throw new Error(
      `${
        `"${manifest.name}" manifest "version"` ||
        `"version" of manifest in "${legiblePath}"`
      } is not a valid SemVer version: ${manifest.version}`,
    );
  }
}

export function isMajorSemverDiff(diff: SemverReleaseType): boolean {
  return diff.includes(ValidSemverReleaseTypes.Major);
}
