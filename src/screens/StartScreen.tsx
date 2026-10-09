import { type BaziChar, BRANCHES, ELEMENTS, STEMS, YIN_YANG } from '../data/characters';
import { useInstall } from '../logic/install';

function CharGrid({ title, chars }: { title: string; chars: BaziChar[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <ul className="chars">
        {chars.map((c) => (
          <li key={c.id} className={`char el-${c.element}`}>
            <span className="char__hanzi hanzi" aria-hidden>
              {c.hanzi}
            </span>
            <span className="char__ru">{c.ru}</span>
            <span className="char__meta">
              {ELEMENTS[c.element]} {YIN_YANG[c.yinYang]}
              {c.animal && <> · {c.animal}</>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StartScreen() {
  const { canInstall, iosHint, install } = useInstall();

  return (
    <main className="screen start">
      <header className="start__hero">
        <h1>Прописи БаЦзы</h1>
        <p className="muted">Как пишется, читается и что значит каждый знак</p>
      </header>

      <CharGrid title="Небесные стволы · 天干" chars={STEMS} />
      <CharGrid title="Земные ветви · 地支" chars={BRANCHES} />

      <p className="hint">Режимы тренировки появятся в следующих версиях.</p>

      {canInstall && (
        <button className="btn btn--wide" onClick={install}>
          Установить на устройство
        </button>
      )}
      {iosHint && (
        <p className="hint">Чтобы установить на iPhone: «Поделиться» → «На экран „Домой“». Работает и без интернета.</p>
      )}
    </main>
  );
}
