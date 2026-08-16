/**
 * The lesson stage. Every visual is a pure function of `frame`.
 *
 * Scaffold-grade visuals only. The real look is a separate job and the two installed design
 * skills (ui-ux-pro-max, design-taste-frontend) are the tools for it — see docs/rationale.md.
 * What matters here is the capture contract and the layout skeleton, not the palette.
 */
import { Background } from './Background';
import { Tex } from './Math';
import { Beat, beatAt, progressIn, revealedSteps } from './timeline';

export function Lesson({ beats, frame, background }: {
  beats: Beat[];
  frame: number;
  background?: string | null;
}) {
  const beat = beatAt(beats, frame);
  if (!beat) return <div className="stage"><Background src={background} /></div>;

  const p = progressIn(beat, frame);
  const style = { opacity: p, transform: `translateY(${(1 - p) * 24}px)` };

  return (
    <div className="stage">
      <Background src={background} />
      <div className="brand">math.with.axi</div>
      <div className="panel" style={style}>{renderBeat(beat, frame)}</div>
      <div className="mascot-slot" data-mascot-slot="1" />
      <ProgressBar beats={beats} frame={frame} />
    </div>
  );
}

function renderBeat(beat: Beat, frame: number) {
  switch (beat.kind) {
    case 'title':
      return <h1 className="title">{String(beat.data)}</h1>;

    case 'method':
      return (
        <section>
          <h2 className="kicker">Приём</h2>
          <Prose value={beat.data} />
        </section>
      );

    case 'mechanism':
      return (
        <section>
          <h2 className="kicker">Почему это работает</h2>
          <Prose value={beat.data} />
        </section>
      );

    case 'example': {
      const steps: any[] = beat.data?.steps ?? [];
      const shown = revealedSteps(beat, frame, steps.length);
      return (
        <section>
          <h2 className="kicker">Пример</h2>
          <div className="operands">
            {(beat.data?.operands ?? []).map((o: any, i: number) => (
              <span className="operand" key={i}>{String(o)}</span>
            ))}
          </div>
          <ol className="steps">
            {steps.slice(0, shown + 1).map((s: any, i: number) => (
              <li key={i} className={i === shown ? 'step current' : 'step'}>
                {s?.tex ? <Tex tex={s.tex} display /> : <span>{String(s?.text ?? s)}</span>}
              </li>
            ))}
          </ol>
          {shown >= steps.length && beat.data?.result != null && (
            <div className="result"><Tex tex={String(beat.data.result_tex ?? beat.data.result)} display /></div>
          )}
        </section>
      );
    }

    case 'applicability':
      return (
        <section>
          <h2 className="kicker">Когда работает</h2>
          <Prose value={beat.data?.condition} />
          {beat.data?.formal && <div className="formal"><Tex tex={String(beat.data.formal)} display /></div>}
        </section>
      );

    case 'counterexample':
      return (
        <section className="counter">
          <h2 className="kicker warn">Где ломается</h2>
          <div className="counter-input"><Tex tex={String(beat.data?.input_tex ?? beat.data?.input)} display /></div>
          <div className="counter-rows">
            <div><span className="label">приём даёт</span><b className="wrong">{String(beat.data?.method_says)}</b></div>
            <div><span className="label">на самом деле</span><b className="right">{String(beat.data?.truth)}</b></div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

/**
 * A missing field renders as an explicit marker, never as filler text. §3.3 — an empty result is
 * acceptable, a fabricated one is not, and that rule does not stop applying at the view layer.
 */
function Prose({ value }: { value: any }) {
  if (value == null) return <p className="missing" data-missing="1">— поле отсутствует —</p>;
  if (typeof value === 'string') return <p className="prose">{value}</p>;
  if (Array.isArray(value)) {
    return <ul className="prose-list">{value.map((v, i) => <li key={i}>{String(v)}</li>)}</ul>;
  }
  if (value.tex) return <Tex tex={String(value.tex)} display />;
  return <p className="prose">{String(value.text ?? '')}</p>;
}

function ProgressBar({ beats, frame }: { beats: Beat[]; frame: number }) {
  const total = beats.length ? beats[beats.length - 1].end : 1;
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${(frame / total) * 100}%` }} />
    </div>
  );
}
