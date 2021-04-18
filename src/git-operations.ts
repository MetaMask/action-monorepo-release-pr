import pathUtils from 'path';
import semver from 'semver';
import execa from 'execa';
import { PackageMetadata } from './package-operations';
import { isValidSemVer, WORKSPACE } from './utils';

const HEAD = 'HEAD';

type DiffMap = Map<string, string[]>;

let INITIALIZED_GIT = false;
let TAGS: Readonly<string[]>;
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
    await performGitOperation(
      'diff',
      tag,
      HEAD,
      '--name-only',
      '--',
      packagesDir,
    )
  ).split('\n');
  DIFFS.set(tag, diff);
  return diff;
}

async function initGit() {
  if (!INITIALIZED_GIT) {
    INITIALIZED_GIT = true;
    [TAGS] = await getTags();
  }
}

async function getTags(): Promise<Readonly<[string[], string]>> {
  const rawTags = await performGitOperation('tag');
  const allTags = rawTags.split('\n');
  const latestTag = allTags[allTags.length - 1];
  if (!latestTag || !isValidSemVer(semver.clean(latestTag))) {
    throw new Error(
      `Invalid latest tag. Expected a valid SemVer version. Received: ${latestTag}`,
    );
  }
  return [allTags, latestTag] as const;
}

async function performGitOperation(command: string, ...args: string[]) {
  return (
    await execa('git', [command, ...args], { cwd: WORKSPACE })
  ).stdout.trim();
}

function versionToTag(version: string) {
  return `v${version}`;
}
