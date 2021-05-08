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
    const mainSpy = jest
      .spyOn(actionModule, 'main')
      .mockImplementationOnce(async () => {
        throw new Error('error');
      });
    const setFailedSpy = jest.spyOn(actionsCore, 'setFailed');

    import('.');
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        expect(mainSpy).toHaveBeenCalledTimes(1);
        expect(setFailedSpy).toHaveBeenCalledTimes(1);
        expect(setFailedSpy).toHaveBeenCalledWith(new Error('error'));
        resolve();
      });
    });
  });
});
