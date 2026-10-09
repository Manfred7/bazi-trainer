# Прописи БаЦзы

Тренажёр написания 22 знаков БаЦзы: 10 небесных стволов (天干) и 12 земных ветвей (地支). Рассчитан на телефон и письмо пальцем, работает без интернета.

**Открыть:** https://manfred7.github.io/bazi-trainer/

> Сейчас опубликован каркас: стартовый экран с таблицей знаков, установка как приложение (PWA), работа офлайн. Режимы тренировки появятся по этапам из [ТЗ](TZ.md).

## Знаки

Чтения, стихии и инь/ян взяты из прописей. Сверка с ТЗ и с данными порядка черт описана в [docs/stage0-pdf-review.md](docs/stage0-pdf-review.md).

## Разработка

```bash
npm install
npm run dev -- --host 127.0.0.1
```

- `npm run build` — сборка в `dist/`.
- `npm run preview -- --host 127.0.0.1` — собранная версия по адресу `/bazi-trainer/`, с service worker.
- `npm run icons` — иконки из `public/pwa-icon.svg`.

Публикация: при пуше в `main` GitHub Actions собирает проект и выкладывает его на GitHub Pages (`.github/workflows/deploy.yml`).

## Лицензии

Данные черт (и иконка, нарисованная по ним) — из [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) / [Make Me A Hanzi](https://github.com/skishore/makemeahanzi), под Arphic Public License: [src/data/LICENSE-strokes.txt](src/data/LICENSE-strokes.txt).
