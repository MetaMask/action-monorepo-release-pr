import * as actionsCore from '@actions/core';
import * as actionModule from './action';

jest.mock('@actions/core', () => {
  return {
    setFailed: jest.fn(),
  };
});

jest.mock('./action', () => {
  return {
    main: jest.fn(),
  };
});

describe('main entry file', () => {
  it('calls main and catches thrown errors', async () => {
    const mainMock = jest
      .spyOn(actionModule, 'main')
      .mockImplementationOnce(async () => {
        throw new Error('error');
      });
    const setFailedMock = jest.spyOn(actionsCore, 'setFailed');

    import('.');
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        expect(mainMock).toHaveBeenCalledTimes(1);
        expect(setFailedMock).toHaveBeenCalledTimes(1);
        expect(setFailedMock).toHaveBeenCalledWith(new Error('error'));
        resolve();
      });
    });
  });
});
