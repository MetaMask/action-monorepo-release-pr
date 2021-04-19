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
enum InputNames {
  BUMP_TYPE = 'bump-type',
  BUMP_VERSION = 'bump-version',
}

/**
 * The actual inputs to the Action.
 */
export const INPUTS: ActionInputs = {
  BUMP_TYPE:
    (getActionInput(InputNames.BUMP_TYPE) as AcceptedSemVerDiffs) || null,
  BUMP_VERSION: getActionInput(InputNames.BUMP_VERSION) || null,
};

export const WORKSPACE_ROOT = process.env.GITHUB_WORKSPACE;

const TWO_SPACES = '  ';

export enum AcceptedSemVerDiffs {
  Major = 'major',
  Minor = 'minor',
  Patch = 'patch',
}

export interface ActionInputs {
  readonly BUMP_TYPE: AcceptedSemVerDiffs | null;
  readonly BUMP_VERSION: string | null;
}

//---------------------------------------------
// Utility Functions
//---------------------------------------------

/**
 * Validates the inputs to the Action, defined earlier in this file.
 * Throws an error if validation fails.
 */
export function validateInputs(): void {
  if (!INPUTS.BUMP_TYPE && !INPUTS.BUMP_VERSION) {
    throw new Error(
      `Must specify either "${InputNames.BUMP_TYPE}" or "${InputNames.BUMP_VERSION}".`,
    );
  }

  if (INPUTS.BUMP_TYPE && INPUTS.BUMP_VERSION) {
    throw new Error(
      `Must specify either "${InputNames.BUMP_TYPE}" or "${InputNames.BUMP_VERSION}", not both.`,
    );
  }

  if (INPUTS.BUMP_TYPE && !(INPUTS.BUMP_TYPE in AcceptedSemVerDiffs)) {
    const tab = tabs(1, '\n');
    throw new Error(
      `Unrecognized "${
        InputNames.BUMP_TYPE
      }". Must be one of:${tab}${Object.keys(AcceptedSemVerDiffs).join(tab)}`,
    );
  }

  if (INPUTS.BUMP_VERSION) {
    if (!isValidSemVer(INPUTS.BUMP_VERSION)) {
      throw new Error(
        `"${InputNames.BUMP_VERSION}" must be a plain semver version string. Received: ${INPUTS.BUMP_VERSION}`,
      );
    }
  }
}

/**
 * @param value - The value to test.
 * @returns Whether the value is a non-empty string.
 */
export function isTruthyString(value: unknown): value is string {
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

  const tab = prefix ? `{${prefix}${TWO_SPACES}}` : TWO_SPACES;

  if (numTabs === 1) {
    return tab;
  }
  return tab + new Array(numTabs).join(tab);
}
