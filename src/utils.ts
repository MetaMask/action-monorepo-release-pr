import { promises as fs } from 'fs';
import { getInput as getActionInput } from '@actions/core';
import semverParse from 'semver/functions/parse';

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
  ReleaseType = 'release-type',
  ReleaseVersion = 'release-version',
}

export const WORKSPACE_ROOT = process.env.GITHUB_WORKSPACE;

const TWO_SPACES = '  ';

/**
 * SemVer release types that are accepted by this action.
 */
export enum ValidSemverReleaseTypes {
  Major = 'major',
  Minor = 'minor',
  Patch = 'patch',
}

export interface ActionInputs {
  readonly ReleaseType: ValidSemverReleaseTypes | null;
  readonly ReleaseVersion: string | null;
}

//---------------------------------------------
// Utility Functions
//---------------------------------------------

export function getActionInputs(): ActionInputs {
  const inputs: ActionInputs = {
    ReleaseType:
      (getActionInput(InputNames.ReleaseType) as ValidSemverReleaseTypes) ||
      null,
    ReleaseVersion: getActionInput(InputNames.ReleaseVersion) || null,
  };
  validateActionInputs(inputs);
  return inputs;
}

/**
 * Validates the inputs to the Action, defined earlier in this file.
 * Throws an error if validation fails.
 */
export function validateActionInputs(inputs: ActionInputs): void {
  if (!inputs.ReleaseType && !inputs.ReleaseVersion) {
    throw new Error(
      `Must specify either "${InputNames.ReleaseType}" or "${InputNames.ReleaseVersion}".`,
    );
  }

  if (inputs.ReleaseType && inputs.ReleaseVersion) {
    throw new Error(
      `Must specify either "${InputNames.ReleaseType}" or "${InputNames.ReleaseVersion}", not both.`,
    );
  }

  if (inputs.ReleaseType && !(inputs.ReleaseType in ValidSemverReleaseTypes)) {
    const tab = tabs(1, '\n');
    throw new Error(
      `Unrecognized "${
        InputNames.ReleaseType
      }". Must be one of:${tab}${Object.keys(ValidSemverReleaseTypes).join(
        tab,
      )}`,
    );
  }

  if (inputs.ReleaseVersion) {
    if (!isValidSemver(inputs.ReleaseVersion)) {
      throw new Error(
        `"${InputNames.ReleaseVersion}" must be a plain SemVer version string. Received: ${inputs.ReleaseVersion}`,
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
export function isValidSemver(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return semverParse(value, { loose: false })?.version === value;
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
