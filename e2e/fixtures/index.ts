import { mergeTests } from '@playwright/test';
import { test as app } from './app';
import { test as screens } from './screens';

/** Единый вход для тестов: import { test, expect } from './fixtures' */
export const test = mergeTests(app, screens);
export { expect } from '../support/matchers';
export { levelOf, progressOf, readProgress } from '../support/data';
