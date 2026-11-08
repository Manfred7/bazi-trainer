import { test as base } from '@playwright/test';
import { Board } from '../screens/board';
import { StartScreen } from '../screens/start';
import { StepsScreen } from '../screens/steps';

type ScreenFixtures = {
  start: StartScreen;
  /** «Один знак — все шаги» */
  drill: StepsScreen;
  /** «Продолжить путь» */
  path: StepsScreen;
  board: Board;
};

/** Экранные объекты: локаторы и действия; проверки — в тестах. Создаются лениво, при обращении */
export const test = base.extend<ScreenFixtures>({
  start: async ({ page }, use) => use(new StartScreen(page)),
  drill: async ({ page }, use) => use(new StepsScreen(page, 'drill')),
  path: async ({ page }, use) => use(new StepsScreen(page, 'path')),
  board: async ({ page }, use) => use(new Board(page)),
});
