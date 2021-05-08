import * as actionsCore from '@actions/core';
import * as gitOperations from './git-operations';
import * as packageOperations from './package-operations';
import * as utils from './utils';
import { main } from './action';

jest.mock('@actions/core', () => {
  return {
    setOutput: jest.fn(),
  };
});

jest.mock('./git-operations', () => {
  return {
    getTags: jest.fn(),
  };
});

jest.mock('./package-operations', () => {
  const actualModule = jest.requireActual('./package-operations');
  return {
    ...actualModule,
    getMetadataForAllPackages: jest.fn(),
    getPackagesToUpdate: jest.fn(),
    getPackageManifest: jest.fn(),
    updatePackage: jest.fn(),
    updatePackages: jest.fn(),
  };
});

jest.mock('./utils', () => {
  const actualModule = jest.requireActual('./utils');
  return {
    ...actualModule,
    getActionInputs: jest.fn(),
    WORKSPACE_ROOT: 'rootDir',
  };
});

describe('main', () => {
  const WORKSPACE_ROOT = 'rootDir';

  let getActionInputsMock: jest.SpyInstance;
  let getTagsMock: jest.SpyInstance;
  let getPackageManifestMock: jest.SpyInstance;
  let setActionOutputMock: jest.SpyInstance;

  beforeEach(() => {
    getActionInputsMock = jest.spyOn(utils, 'getActionInputs');
    getTagsMock = jest
      .spyOn(gitOperations, 'getTags')
      .mockImplementationOnce(async () => [
        new Set(['1.0.0', '1.1.0']),
        '1.1.0',
      ]);
    getPackageManifestMock = jest.spyOn(
      packageOperations,
      'getPackageManifest',
    );
    setActionOutputMock = jest.spyOn(actionsCore, 'setOutput');
  });

  it('updates a polyrepo with release-version input', async () => {
    const packageName = 'A';
    const oldVersion = '1.1.0';
    const newVersion = '2.0.0';

    getActionInputsMock.mockImplementationOnce(() => {
      return { ReleaseType: null, ReleaseVersion: newVersion };
    });
    getPackageManifestMock.mockImplementationOnce(async () => {
      return {
        name: packageName,
        version: oldVersion,
      };
    });

    await main();
    expect(getTagsMock).toHaveBeenCalledTimes(1);
    expect(packageOperations.updatePackage).toHaveBeenCalledTimes(1);
    expect(packageOperations.updatePackage).toHaveBeenCalledWith(
      {
        dirPath: WORKSPACE_ROOT,
        manifest: { name: packageName, version: oldVersion },
      },
      { newVersion },
    );
    expect(setActionOutputMock).toHaveBeenCalledTimes(1);
    expect(setActionOutputMock).toHaveBeenCalledWith('NEW_VERSION', newVersion);
  });

  it('updates a polyrepo with release-type input', async () => {
    const packageName = 'A';
    const oldVersion = '1.1.0';
    const newVersion = '2.0.0';

    getActionInputsMock.mockImplementationOnce(() => {
      return { ReleaseType: 'major', ReleaseVersion: null };
    });
    getPackageManifestMock.mockImplementationOnce(async () => {
      return {
        name: packageName,
        version: oldVersion,
      };
    });

    await main();
    expect(getTagsMock).toHaveBeenCalledTimes(1);
    expect(packageOperations.updatePackage).toHaveBeenCalledTimes(1);
    expect(packageOperations.updatePackage).toHaveBeenCalledWith(
      {
        dirPath: WORKSPACE_ROOT,
        manifest: { name: packageName, version: oldVersion },
      },
      { newVersion },
    );
    expect(setActionOutputMock).toHaveBeenCalledTimes(1);
    expect(setActionOutputMock).toHaveBeenCalledWith('NEW_VERSION', newVersion);
  });

  it('updates a monorepo', async () => {
    const rootManifestName = 'root';
    const oldVersion = '1.1.0';
    const newVersion = '2.0.0';
    const workspaces: readonly string[] = ['a', 'b', 'c'];

    getActionInputsMock.mockImplementationOnce(() => {
      return { ReleaseType: null, ReleaseVersion: newVersion };
    });

    getPackageManifestMock.mockImplementationOnce(async () => {
      return {
        name: rootManifestName,
        version: oldVersion,
        private: true,
        workspaces: [...workspaces],
      };
    });

    const getPackagesMetadataMock = jest
      .spyOn(packageOperations, 'getMetadataForAllPackages')
      .mockImplementationOnce(async () => {
        return { a: {}, b: {}, c: {} } as any;
      });

    const getPackagesToUpdateMock = jest
      .spyOn(packageOperations, 'getPackagesToUpdate')
      .mockImplementationOnce(async () => new Set(workspaces));

    await main();

    expect(getTagsMock).toHaveBeenCalledTimes(1);
    expect(getPackagesMetadataMock).toHaveBeenCalledTimes(1);

    expect(getPackagesToUpdateMock).toHaveBeenCalledTimes(1);
    expect(getPackagesToUpdateMock).toHaveBeenCalledWith(
      { a: {}, b: {}, c: {} },
      true,
      new Set(['1.0.0', '1.1.0']),
    );

    expect(packageOperations.updatePackages).toHaveBeenCalledTimes(1);
    expect(packageOperations.updatePackages).toHaveBeenCalledWith(
      { a: {}, b: {}, c: {} },
      {
        newVersion,
        packagesToUpdate: new Set(workspaces),
        synchronizeVersions: true,
      },
    );

    expect(packageOperations.updatePackage).toHaveBeenCalledTimes(1);
    expect(packageOperations.updatePackage).toHaveBeenCalledWith(
      {
        dirPath: WORKSPACE_ROOT,
        manifest: {
          name: rootManifestName,
          private: true,
          version: oldVersion,
          workspaces: [...workspaces],
        },
      },
      {
        newVersion,
        packagesToUpdate: new Set(workspaces),
        synchronizeVersions: true,
      },
    );

    expect(setActionOutputMock).toHaveBeenCalledTimes(1);
    expect(setActionOutputMock).toHaveBeenCalledWith('NEW_VERSION', newVersion);
  });
});
