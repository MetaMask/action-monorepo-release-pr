import execa from 'execa';
import { didPackageChange, getTags } from './git-operations';

// We don't actually use it, so it doesn't matter what it is.
process.env.GITHUB_WORKSPACE = 'root';

jest.mock('execa');
const execaMock: jest.Mock<any, any> = execa as any;

enum VERSIONS {
  A = '1.0.0',
  B = '1.0.1',
  C = '1.1.0',
}

enum TAGS {
  A = 'v1.0.0',
  B = 'v1.0.1',
  C = 'v1.1.0',
}

const PACKAGES: Readonly<Record<string, { name: string; dir: string }>> = {
  A: { name: 'fooName', dir: 'foo' },
  B: { name: 'barName', dir: 'bar' },
};

const RAW_MOCK_TAGS = `${Object.values(TAGS).join('\n')}\n`;

const DEFAULT_TAGS: Readonly<Set<string>> = new Set(Object.values(TAGS));

const RAW_DIFFS: Readonly<Record<TAGS, string>> = {
  [TAGS.A]: `packages/${PACKAGES.A.dir}/file.txt\npackages/${PACKAGES.B.dir}/file.txt\n`,
  [TAGS.B]: `packages/${PACKAGES.A.dir}/file.txt\n`,
  [TAGS.C]: `packages/${PACKAGES.B.dir}/file.txt\n`,
};

describe('getTags', () => {
  it('successfully parses tags', async () => {
    // execa('git', ['tag', ...])
    execaMock.mockImplementationOnce(async () => {
      return { stdout: RAW_MOCK_TAGS };
    });

    expect(await getTags()).toStrictEqual([DEFAULT_TAGS, TAGS.C]);
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it('succeeds if repo has complete history and no tags', async () => {
    execaMock.mockImplementation(async (...args) => {
      const gitCommand = args[1][0];
      if (gitCommand === 'tag') {
        return { stdout: '' };
      } else if (gitCommand === 'rev-parse') {
        return { stdout: 'false' };
      }
      throw new Error(`Unrecognized git command: ${gitCommand}`);
    });

    expect(await getTags()).toStrictEqual([new Set(), null]);
    expect(execaMock).toHaveBeenCalledTimes(2);
  });

  it('throws if repo has incomplete history and no tags', async () => {
    execaMock.mockImplementation(async (...args) => {
      const gitCommand = args[1][0];
      if (gitCommand === 'tag') {
        return { stdout: '' };
      } else if (gitCommand === 'rev-parse') {
        return { stdout: 'true' };
      }
      throw new Error(`Unrecognized git command: ${gitCommand}`);
    });

    await expect(getTags()).rejects.toThrow(/^"git tag" returned no tags/u);
    expect(execaMock).toHaveBeenCalledTimes(2);
  });

  it('throws if repo has invalid tags', async () => {
    // execa('git', ['tag', ...])
    execaMock.mockImplementationOnce(async () => {
      return { stdout: 'foo\nbar\n' };
    });

    await expect(getTags()).rejects.toThrow(/^Invalid latest tag/u);
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it('throws if git rev-parse returns unrecognized value', async () => {
    execaMock.mockImplementation(async (...args) => {
      const gitCommand = args[1][0];
      if (gitCommand === 'tag') {
        return { stdout: '' };
      } else if (gitCommand === 'rev-parse') {
        return { stdout: 'foo' };
      }
      throw new Error(`Unrecognized git command: ${gitCommand}`);
    });

    await expect(getTags()).rejects.toThrow(
      /^"git rev-parse --is-shallow-repository" returned unrecognized/u,
    );
    expect(execaMock).toHaveBeenCalledTimes(2);
  });
});

describe('didPackageChange', () => {
  it('returns true if there are no tags', async () => {
    expect(await didPackageChange(new Set(), {} as any, 'foo')).toStrictEqual(
      true,
    );
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('calls "git diff" with expected tag', async () => {
    execaMock.mockImplementationOnce(async () => {
      return { stdout: RAW_DIFFS[TAGS.A] };
    });

    expect(
      await didPackageChange(DEFAULT_TAGS, {
        name: PACKAGES.A.name,
        manifest: { name: PACKAGES.A.name, version: VERSIONS.A },
        dirName: PACKAGES.A.dir,
        dirPath: '', // just for interface compliance, not relevant
      }),
    ).toStrictEqual(true);
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it('repeat call for tag retrieves result from cache', async () => {
    expect(
      await didPackageChange(DEFAULT_TAGS, {
        name: PACKAGES.A.name,
        manifest: { name: PACKAGES.A.name, version: VERSIONS.A },
        dirName: PACKAGES.A.dir,
        dirPath: '', // just for interface compliance, not relevant
      }),
    ).toStrictEqual(true);
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('retrieves cached diff on repeat call for tag', async () => {
    expect(
      await didPackageChange(DEFAULT_TAGS, {
        name: PACKAGES.A.name,
        manifest: { name: PACKAGES.A.name, version: VERSIONS.A },
        dirName: PACKAGES.A.dir,
        dirPath: '', // just for interface compliance, not relevant
      }),
    ).toStrictEqual(true);
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('throws if package manifest specifies version without tag', async () => {
    await expect(
      didPackageChange(DEFAULT_TAGS, {
        name: PACKAGES.A.name,
        manifest: { name: PACKAGES.A.name, version: '2.0.0' },
        dirName: PACKAGES.A.dir,
        dirPath: '', // just for interface compliance, not relevant
      }),
    ).rejects.toThrow(/no corresponding tag/u);
    expect(execaMock).not.toHaveBeenCalled();
  });
});
