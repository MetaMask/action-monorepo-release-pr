import { promises as fs } from 'fs';
import { getInput as getActionInput } from '@actions/core';
import semver from 'semver';

//---------------------------------------------
// Constants & Types
//---------------------------------------------

/**
 * Correctly type "process.env".
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      // The root of the workspace running this action
      GITHUB_WORKSPACE: string;
    }
  }
}

/**
 * The names of the inputs to the Action, per action.yml.
 */
export const INPUT_NAMES = {
  BUMP_TYPE: 'bump-type',
  BUMP_VERSION: 'bump-version',
};

// Get the inputs to the Action.
export const INPUTS: ActionInputs = {
  BUMP_TYPE:
    (getActionInput(INPUT_NAMES.BUMP_TYPE) as AcceptedSemVerDiff) || null,
  BUMP_VERSION: getActionInput(INPUT_NAMES.BUMP_VERSION) || null,
};

export const WORKSPACE = process.env.GITHUB_WORKSPACE;
const TAB = '  ';

export enum SEMVER_DIFFS {
  major = 'major',
  minor = 'minor',
  patch = 'patch',
}

export type AcceptedSemVerDiff = keyof typeof SEMVER_DIFFS;

export interface ActionInputs {
  BUMP_TYPE: AcceptedSemVerDiff | null;
  BUMP_VERSION: string | null;
}

//---------------------------------------------
// GitHub Action Utilities
//---------------------------------------------

/**
 * Validates the inputs to the Action. Throws an error if validation fails.
 */
export function validateInputs(): void {
  if (!INPUTS.BUMP_TYPE && !INPUTS.BUMP_VERSION) {
    throw new Error(
      `Must specify either "${INPUT_NAMES.BUMP_TYPE}" or "${INPUT_NAMES.BUMP_VERSION}".`,
    );
  }

  if (INPUTS.BUMP_TYPE && INPUTS.BUMP_VERSION) {
    throw new Error(
      `Must specify either "${INPUT_NAMES.BUMP_TYPE}" or "${INPUT_NAMES.BUMP_VERSION}", not both.`,
    );
  }

  if (INPUTS.BUMP_TYPE && !(INPUTS.BUMP_TYPE in SEMVER_DIFFS)) {
    const tab = tabs(1, '\n');
    throw new Error(
      `Unrecognized "${
        INPUT_NAMES.BUMP_TYPE
      }". Must be one of:${tab}${Object.keys(SEMVER_DIFFS).join(tab)}`,
    );
  }

  if (INPUTS.BUMP_VERSION) {
    if (!isValidSemVer(INPUTS.BUMP_VERSION)) {
      throw new Error(
        `"${INPUT_NAMES.BUMP_VERSION}" must be a plain semver version string. Received: ${INPUTS.BUMP_VERSION}`,
      );
    }
  }
}

//---------------------------------------------
// Miscellaneous
//---------------------------------------------

export function isTruthyString(value: unknown): boolean {
  return Boolean(value) && typeof value === 'string';
}

/**
 * Reads the assumed JSON file at the given path, attempts to parse it, and
 * returns the resulting object.
 *
 * Throws if failing to read or parse, or if the parsed JSON value is falsy.
 *
 * @param paths - The path segments pointing to the JSON file. Will be passed
 * to path.join().
 * @returns The object corresponding to the parsed JSON file.
 */
export async function readJsonFile(
  path: string,
): Promise<Record<string, unknown>> {
  const obj = JSON.parse(await fs.readFile(path, 'utf8')) as Record<
    string,
    unknown
  >;

  if (!obj) {
    throw new Error(
      `Assumed JSON file at path "${path}" parsed to a falsy value.`,
    );
  }
  return obj;
}

/**
 * Checks whether the given value is a valid, unprefixed SemVer version string.
 * The string must begin with the numerical major version.
 *
 * (The semver package has a similar function, but it permits v-prefixes.)
 *
 * @param value - The value to check.
 * @returns Whether the given value is a valid, unprefixed SemVer version
 * string.
 */
export function isValidSemVer(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return semver.parse(value, { loose: false })?.version === value;
}

/**
 * @param numTabs - The number of tabs to return. A tab consists of two spaces.
 * @param prefix - The prefix to prepend to the returned string, if any.
 * @returns A string consisting of the prefix, if any, and the requested number
 * of tabs.
 */
export function tabs(numTabs: number, prefix?: string): string {
  if (!Number.isInteger(numTabs) || numTabs < 0) {
    throw new Error('Expected positive integer.');
  }

  const tab = prefix ? `{${prefix}${TAB}}` : TAB;

  if (numTabs === 1) {
    return tab;
  }
  return tab + new Array(numTabs).join(tab);
}
