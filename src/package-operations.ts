import { promises as fs } from 'fs';
import pathUtils from 'path';
import { didPackageChange } from './git-operations';
import {
  AcceptedSemVerDiff,
  isTruthyString,
  isValidSemVer,
  readJsonFile,
  SEMVER_DIFFS,
  WORKSPACE,
} from './utils';

const PACKAGE_JSON = 'package.json';

enum BUMP_SCOPES {
  all = 'all',
  changed = 'changed',
}

type BumpScope = keyof typeof BUMP_SCOPES;

export interface PackageManifest {
  readonly name: string;
  readonly version: string;
}
export interface PackageMetadata {
  readonly dirName: string;
  readonly manifest: Readonly<PackageManifest>;
  readonly name: string;
  readonly path: string;
}

interface GetPackageMetadataArgs {
  rootDir: string;
  packagesDir: string;
}

export async function getPackagesMetadata(
  args: GetPackageMetadataArgs = {
    rootDir: WORKSPACE,
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
 * Get the scope of the version bump.
 */
function getBumpScope(bumpType: AcceptedSemVerDiff | null): BumpScope {
  return bumpType === SEMVER_DIFFS.patch
    ? BUMP_SCOPES.changed
    : BUMP_SCOPES.all;
}

/**
 * Given the Action's bump type parameter... TODO
 * @returns An array of the names of the packages to bump.
 */
export async function getPackagesToUpdate(
  allPackages: Record<string, PackageMetadata>,
  bumpType: AcceptedSemVerDiff | null,
): Promise<(keyof typeof allPackages)[]> {
  const bumpScope = getBumpScope(bumpType);
  if (bumpScope === BUMP_SCOPES.changed) {
    return Object.keys(allPackages).filter(async (packageName) => {
      return await didPackageChange(allPackages[packageName]);
    });
  }

  // If we're not just bumping the changed packages, we're bumping all of them.
  return Object.keys(allPackages);
}

/**
 * "Bumps" the specified packages. "Bumping" currently just means overwriting
 * the version.
 */
export async function updatePackages(
  newVersion: string,
  allPackages: Record<string, PackageMetadata>,
  packagesToUpdate: string[],
): Promise<void> {
  await Promise.all(
    Object.keys(packagesToUpdate).map(async (packageName) =>
      updatePackage(newVersion, allPackages[packageName]),
    ),
  );
}

async function updatePackage(
  newVersion: string,
  packageMetadata: PackageMetadata,
): Promise<void> {
  await fs.writeFile(
    pathUtils.join(packageMetadata.path, PACKAGE_JSON),
    JSON.stringify(
      { ...packageMetadata.manifest, version: newVersion },
      null,
      2,
    ),
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
  validatePackageManifest(containingDirPath, manifest, requiredFields);
  return manifest as Pick<PackageManifest, T>;
}

function validatePackageManifest(
  path: string,
  manifest: Record<string, unknown>,
  requiredFields: (keyof PackageManifest)[] = ['name', 'version'],
): void {
  const legiblePath = pathUtils.resolve(WORKSPACE, path);
  if (requiredFields.includes('name') && !isTruthyString(manifest.name)) {
    throw new Error(
      `Manifest at path "${legiblePath}" does not have a valid "name" field.`,
    );
  }

  if (requiredFields.includes('version') && !isValidSemVer(manifest.version)) {
    throw new Error(
      `"${
        manifest.name || path
      }" manifest version is not a valid SemVer version: ${manifest.version}`,
    );
  }
}
