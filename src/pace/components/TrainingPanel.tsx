import type { AiStatus } from '../usePaceApp';
import type { TrainingSession } from '../types';

type TrainingPanelProps = {
  activeSession: TrainingSession | null;
  aiStatus: AiStatus;
  history: TrainingSession[];
  nextSession: TrainingSession | null;
  progress: { done: number; total: number; percent: number };
  onCompleteSet: (exerciseId: string) => void;
  onFinishTraining: () => void;
  onGenerateAiWeek: () => void;
  onResetExercise: (exerciseId: string) => void;
  onStartTraining: () => void;
};

export function TrainingPanel({
  activeSession,
  aiStatus,
  history,
  nextSession,
  progress,
  onCompleteSet,
  onFinishTraining,
  onGenerateAiWeek,
  onResetExercise,
  onStartTraining,
}: TrainingPanelProps) {
  const hasProgress = progress.total > 0;

  return (
    <section className="training-section" id="training" aria-labelledby="training-title">
      <div className="training-copy">
        <span className="comfort-kicker">Training</span>
        <h2 id="training-title">Start the session, not another dashboard.</h2>
        <p>
          Pace turns the week into one focused workout. Complete sets, keep the next target visible, and save the
          session when you are done.
        </p>
        <div className="training-actions">
          <button className="primary-action" onClick={onStartTraining} type="button">
            {activeSession ? 'Restart session' : 'Start training'}
          </button>
          <button className="secondary-action training-ai-button" disabled={aiStatus.state === 'loading'} onClick={onGenerateAiWeek} type="button">
            {aiStatus.state === 'loading' ? 'Generating...' : 'AI week'}
          </button>
        </div>
        <p className={`training-ai-status training-ai-status-${aiStatus.state}`} role="status" aria-live="polite">
          {aiStatus.message}
        </p>
      </div>

      <div className="training-card">
        {activeSession ? (
          <>
            <div className="training-card-header">
              <div>
                <span>Active now</span>
                <h3>{activeSession.title}</h3>
                <p>{activeSession.focus}</p>
              </div>
              <strong>{hasProgress ? `${progress.done}/${progress.total}` : '0/0'}</strong>
            </div>

            <div className="training-progress" aria-label={`${progress.percent}% complete`}>
              <span style={{ width: `${progress.percent}%` }} />
            </div>

            <div className="training-exercise-list">
              {activeSession.exercises.map((exercise) => (
                <article className="training-exercise" key={exercise.id}>
                  <div>
                    <h4>{exercise.name}</h4>
                    <p>
                      {exercise.done}/{exercise.sets} sets - {exercise.target}
                    </p>
                  </div>
                  <div className="training-exercise-actions">
                    <button disabled={exercise.done >= exercise.sets} onClick={() => onCompleteSet(exercise.id)} type="button">
                      Set done
                    </button>
                    <button onClick={() => onResetExercise(exercise.id)} type="button">
                      Reset
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <button className="training-finish-button" onClick={onFinishTraining} type="button">
              Finish session
            </button>
          </>
        ) : (
          <div className="training-empty">
            <span>Next session</span>
            <h3>{nextSession?.title ?? 'Ready when you are.'}</h3>
            <p>
              {nextSession
                ? `${nextSession.exercises.length} blocks prepared. Start when the day is ready.`
                : 'Build a week or let AI prepare a session, then start training here.'}
            </p>
            <button className="primary-action" onClick={onStartTraining} type="button">
              Start training
            </button>
          </div>
        )}
      </div>

      <div className="training-history" aria-label="Training history">
        <span>History</span>
        {history.length > 0 ? (
          history.slice(0, 3).map((session) => (
            <article key={session.id}>
              <h3>{session.title}</h3>
              <p>{session.completedAt ? new Date(session.completedAt).toLocaleDateString() : 'Saved'}</p>
            </article>
          ))
        ) : (
          <p>No sessions saved yet.</p>
        )}
      </div>
    </section>
  );
}
