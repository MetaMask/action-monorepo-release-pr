import { promises as fs } from 'fs';
import pathUtils from 'path';
import type { ReleaseType } from 'semver';

import { didPackageChange } from './git-operations';
import {
  isTruthyString,
  isValidSemVer,
  readJsonFile,
  AcceptedSemVerDiffs,
  WORKSPACE_ROOT,
} from './utils';

const PACKAGE_JSON = 'package.json';

enum PackageDependencyFields {
  Production = 'dependencies',
  Development = 'devDependencies',
  Peer = 'peerDependencies',
}

export interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly [PackageDependencyFields.Production]: Record<string, string>;
  readonly [PackageDependencyFields.Development]: Record<string, string>;
  readonly [PackageDependencyFields.Peer]: Record<string, string>;
}

export interface PackageMetadata {
  readonly dirName: string;
  readonly manifest: Readonly<PackageManifest>;
  readonly name: string;
  readonly path: string;
}

interface UpdateContext {
  readonly versionDiff: ReleaseType;
  readonly newVersion: string;
  readonly packagesToUpdate: Set<string>;
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
  versionDiff: ReleaseType,
): Promise<Set<string>> {
  // If it's a major version bump, everything will be updated.
  if (isMajorSemVerDiff(versionDiff)) {
    return new Set(Object.keys(allPackages));
  }

  // If it's not a major version bump, only changed packages will be updated.
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
  const { newVersion, versionDiff } = updateContext;
  if (isMajorSemVerDiff(versionDiff)) {
    // If the new version is a major version bump, we bump our packages to said
    // new major version in dependencies, devDependencies, and peerDependencies
    // in all packages.
    return {
      ...currentManifest,
      ...getUpdatedDependencyFields(currentManifest, updateContext),
      version: newVersion,
    };
  }

  // If it's not a major version bump, we assume that no breaking changes
  // between our packages were introduced, and we leave all dependencies as they
  // are.
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

  if (requiredFields.includes('version') && !isValidSemVer(manifest.version)) {
    throw new Error(
      `${
        `"${manifest.name}" manifest "version"` ||
        `"version" of manifest in "${legiblePath}"`
      } is not a valid SemVer version: ${manifest.version}`,
    );
  }
}

function isMajorSemVerDiff(diff: ReleaseType): boolean {
  return diff.includes(AcceptedSemVerDiffs.Major);
}
