import pathUtils from 'path';
import semver from 'semver';
import simpleGit from 'simple-git';
import { PackageMetadata } from './package-operations';
import { isValidSemVer, WORKSPACE } from './utils';

const HEAD = 'HEAD';

type DiffMap = Map<string, string[]>;

let git: ReturnType<typeof simpleGit>;
let TAGS: string[];
const DIFFS: DiffMap = new Map();

export async function didPackageChange(
  packageData: PackageMetadata,
  packagesDir = 'packages',
): Promise<boolean> {
  await initGit();

  const {
    manifest: { name: packageName, version: currentVersion },
  } = packageData;
  const tagOfCurrentVersion = versionToTag(currentVersion);

  if (!TAGS.includes(tagOfCurrentVersion)) {
    throw new Error(
      `Package "${packageName}" has version "${currentVersion}" in its manifest, but no corresponding tag "${tagOfCurrentVersion}" exists.`,
    );
  }

  return performDiff(packageData, tagOfCurrentVersion, packagesDir);
}

async function performDiff(
  packageData: PackageMetadata,
  tag: string,
  packagesDir: string,
): Promise<boolean> {
  const { dirName: packageDirName } = packageData;
  const diff = await getDiff(tag, packagesDir);
  const packagePathPrefix = pathUtils.join(packagesDir, packageDirName);
  return diff.some((diffPath) => diffPath.startsWith(packagePathPrefix));
}

async function getDiff(tag: string, packagesDir: string): Promise<string[]> {
  if (DIFFS.has(tag)) {
    return DIFFS.get(tag) as string[];
  }

  const diff = (
    await git.diff([tag, HEAD, '--name-only', '--', packagesDir])
  ).split('\n');
  DIFFS.set(tag, diff);
  return diff;
}

async function initGit() {
  if (!git) {
    git = simpleGit({ baseDir: WORKSPACE });
    [TAGS] = await getTags();
  }
}

async function getTags() {
  const { all, latest } = await git.tags();
  if (!latest || !isValidSemVer(semver.clean(latest))) {
    throw new Error(
      `Invalid latest tag. Expected a valid SemVer version. Received: ${latest}`,
    );
  }
  return [all, latest] as const;
}

function versionToTag(version: string) {
  return `v${version}`;
}
