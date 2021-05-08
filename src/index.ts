import { setFailed as setActionToFailed } from '@actions/core';
import { main } from './action';

main().catch((error) => {
  setActionToFailed(error);
});
