import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { onboardingQuestions, startSteps, tiers } from '../content';
import type { OnboardingStepId, PlanTier } from '../types';
import type { ProfileAnswers } from '../usePaceApp';

export type OnboardingDraft = {
  ageRange: string;
  blockers: string[];
  coachShare: string;
  displayName: string;
  foodGoal: string;
  goals: string[];
  heightCentimeters: string;
  heightFeet: string;
  heightInches: string;
  heightUnit: 'ft' | 'cm';
  metricsUnit: string;
  otherGoal: string;
  otherSport: string;
  person: string;
  planTier: PlanTier;
  position: string;
  reminderPreference: string[];
  schoolLoad: string;
  sleepRange: string;
  sportOptions: string[];
  supportStyle: string;
  trainingDays: string;
  scheduleNotes: string;
  weightSkipped: boolean;
  weightUnit: 'lb' | 'kg';
  weightValue: string;
};

type OnboardingPageProps = {
  draft: OnboardingDraft;
  isGenerating: boolean;
  stepId: OnboardingStepId;
  onBackHome: () => void;
  onComplete: (profile: ProfileAnswers) => Promise<void>;
  onDraftChange: (draft: OnboardingDraft) => void;
  onNavigateStep: (step: OnboardingStepId) => void;
};

export const defaultOnboardingDraft: OnboardingDraft = {
  ageRange: '',
  blockers: [],
  coachShare: 'Private to me for now',
  displayName: '',
  foodGoal: 'Optional macros',
  goals: [],
  heightCentimeters: '',
  heightFeet: '',
  heightInches: '0',
  heightUnit: 'ft',
  metricsUnit: '',
  otherGoal: '',
  otherSport: '',
  person: '',
  planTier: 'Always FREE',
  position: '',
  reminderPreference: [],
  schoolLoad: '',
  sleepRange: '',
  sportOptions: [],
  supportStyle: '',
  trainingDays: '',
  scheduleNotes: '',
  weightSkipped: false,
  weightUnit: 'lb',
  weightValue: '',
};

const ageRanges = ['Under 13', '13-15', '16-18', '19-24', '25+'];
const footOptions = ['4', '5', '6', '7', '8'];
const inchOptions = Array.from({ length: 12 }, (_, index) => String(index));
const centimeterOptions = Array.from({ length: 123 }, (_, index) => String(index + 122));
const schoolLoadOptions = ['Light this week', 'Normal', 'Heavy', 'Finals or big project'];
const sleepOptions = ['Under 6 hours lately', '6-7 hours, want to improve', '7-8 solid hours', '8+ and consistent'];
const coachShareOptions = ['Private to me for now', 'Share summary with coach', 'Coach helps build plans'];
const blockerOptions = [
  'Homework piles up',
  'Practice ends late',
  'Sleep gets pushed back',
  'I skip food before training',
  'I overthink the plan',
  'Travel or games change the week',
  'Phone keeps me up',
  'I lose motivation after one bad day',
  'My schedule changes a lot',
];
const supportStyleOptions = ['Keep it calm', 'Push me a little', 'Make it very direct'];

function stepPath(step: OnboardingStepId) {
  return `/start/${step}`;
}

function formatHeight(draft: OnboardingDraft) {
  if (draft.heightUnit === 'cm') {
    return draft.heightCentimeters ? `${draft.heightCentimeters} cm` : '';
  }

  return draft.heightFeet ? `${draft.heightFeet} ft ${draft.heightInches || '0'} in` : '';
}

function formatWeight(draft: OnboardingDraft) {
  const cleanWeight = draft.weightValue.trim();

  if (draft.weightSkipped || !cleanWeight) {
    return '';
  }

  return `${cleanWeight} ${draft.weightUnit}`;
}

function selectedSport(draft: OnboardingDraft) {
  const sports = draft.sportOptions.filter((item) => item !== 'Other');
  const custom = draft.otherSport.trim();
  return custom || sports[0] || 'General training';
}

function selectedGoals(draft: OnboardingDraft) {
  const goals = draft.goals.filter((item) => item !== 'Other');
  const custom = draft.otherGoal.trim();
  return custom ? [...goals, custom] : goals;
}

function ChoiceButton({
  isSelected,
  label,
  onClick,
}: {
  isSelected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button aria-pressed={isSelected} className={isSelected ? 'is-selected' : undefined} onClick={onClick} type="button">
      {label}
    </button>
  );
}

export function OnboardingPage({
  draft,
  isGenerating,
  onBackHome,
  onComplete,
  onDraftChange,
  onNavigateStep,
  stepId,
}: OnboardingPageProps) {
  const [error, setError] = useState('');
  const generatedRef = useRef(false);
  const stepIndex = Math.max(startSteps.indexOf(stepId), 0);
  const progress = ((stepIndex + 1) / startSteps.length) * 100;
  const displayName = draft.displayName.trim() || 'there';
  const height = formatHeight(draft);
  const weight = formatWeight(draft);

  const canContinue = useMemo(() => {
    if (stepId === 'name') return draft.displayName.trim().length > 0;
    if (stepId === 'role') return Boolean(draft.person);
    if (stepId === 'metrics') return Boolean(draft.ageRange && height && (draft.weightSkipped || Number(draft.weightValue) > 0));
    if (stepId === 'sports') return draft.sportOptions.length > 0 && (!draft.sportOptions.includes('Other') || draft.otherSport.trim().length > 0);
    if (stepId === 'goals') return draft.goals.length > 0 && (!draft.goals.includes('Other') || draft.otherGoal.trim().length > 0);
    if (stepId === 'schedule') return Boolean(draft.trainingDays && draft.schoolLoad && draft.sleepRange);
    if (stepId === 'nutrition') return Boolean(draft.foodGoal);
    if (stepId === 'preferences') return draft.blockers.length > 0 && draft.reminderPreference.length > 0 && Boolean(draft.supportStyle);
    if (stepId === 'plan') return Boolean(draft.planTier);
    return true;
  }, [draft, height, stepId]);

  function update(next: Partial<OnboardingDraft>) {
    onDraftChange({ ...draft, ...next });
  }

  function toggleMulti(key: 'blockers' | 'goals' | 'sportOptions' | 'reminderPreference', value: string) {
    const current = draft[key];
    update({
      [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    } as Partial<OnboardingDraft>);
  }

  function next(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!canContinue) {
      setError('Choose an answer to keep going. You can change this later.');
      return;
    }

    setError('');
    const nextStep = startSteps[stepIndex + 1];

    if (nextStep) {
      onNavigateStep(nextStep);
    }
  }

  function back() {
    setError('');

    if (stepIndex <= 0) {
      onBackHome();
      return;
    }

    onNavigateStep(startSteps[stepIndex - 1]);
  }

  function buildProfile(): ProfileAnswers {
    const goals = selectedGoals(draft);
    const sport = selectedSport(draft);

    return {
      ageRange: draft.ageRange,
      blockers: draft.blockers,
      coachShare: draft.coachShare,
      displayName: draft.displayName.trim(),
      foodGoal: draft.foodGoal,
      foodPreference: draft.foodGoal,
      goal: goals[0] ?? 'Balance school and training',
      goals,
      height,
      metricsUnit: draft.heightUnit,
      person: draft.person,
      planTier: draft.planTier,
      position: draft.position.trim(),
      reminderPreference: draft.reminderPreference.join(', '),
      schoolLoad: draft.schoolLoad,
      sleepRange: draft.sleepRange,
      sport,
      sportOptions: draft.sportOptions.includes('Other') && draft.otherSport.trim()
        ? [...draft.sportOptions.filter((item) => item !== 'Other'), draft.otherSport.trim()]
        : draft.sportOptions,
      scheduleNotes: draft.scheduleNotes.trim(),
      supportStyle: draft.supportStyle,
      trainingDays: draft.trainingDays,
      weight: weight || undefined,
    };
  }

  useEffect(() => {
    if (stepId !== 'generating' || generatedRef.current) {
      return;
    }

    generatedRef.current = true;
    void onComplete(buildProfile());
  }, [stepId]);

  function renderQuestion() {
    if (stepId === 'generating') {
      return (
        <>
          <span className="comfort-kicker">BUILDING YOUR DASHBOARD</span>
          <h1 id="onboarding-title">Pace is putting your plan together.</h1>
          <p>
            {draft.ageRange === 'Under 13'
              ? 'Setup is saved locally. AI planning needs a guardian before continuing.'
              : 'Training, food, school, recovery, and reminders are being shaped into one dashboard.'}
          </p>
          <div className="onboarding-loading" aria-hidden="true">
            <span />
          </div>
        </>
      );
    }

    if (stepId === 'metrics') {
      return (
        <>
          <span className="comfort-kicker">WELCOME, {displayName.toUpperCase()}</span>
          <h1 id="onboarding-title">A few basics.</h1>
          <p>Share only what feels useful. Pace uses this for planning context, never to score your body.</p>

          <fieldset className="onboarding-choice-group">
            <legend>Age range</legend>
            <div className="onboarding-choice-wrap">
              {ageRanges.map((option) => (
                <ChoiceButton key={option} isSelected={draft.ageRange === option} label={option} onClick={() => update({ ageRange: option })} />
              ))}
            </div>
          </fieldset>

          <div className="onboarding-metric-grid">
            <section className="onboarding-metric-card" aria-label="Height">
              <div className="onboarding-metric-heading">
                <strong>Height</strong>
                <div className="onboarding-unit-toggle" aria-label="Height unit">
                  <ChoiceButton isSelected={draft.heightUnit === 'ft'} label="ft" onClick={() => update({ heightUnit: 'ft' })} />
                  <ChoiceButton isSelected={draft.heightUnit === 'cm'} label="cm" onClick={() => update({ heightUnit: 'cm' })} />
                </div>
              </div>

              {draft.heightUnit === 'ft' ? (
                <div className="onboarding-metric-row">
                  <label className="onboarding-text-field">
                    <span>Feet</span>
                    <select onChange={(event) => update({ heightFeet: event.target.value })} value={draft.heightFeet}>
                      <option value="">Choose</option>
                      {footOptions.map((option) => (
                        <option key={option} value={option}>
                          {option} ft
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="onboarding-text-field">
                    <span>Inches</span>
                    <select onChange={(event) => update({ heightInches: event.target.value })} value={draft.heightInches}>
                      {inchOptions.map((option) => (
                        <option key={option} value={option}>
                          {option} in
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <label className="onboarding-text-field">
                  <span>Centimeters</span>
                  <select onChange={(event) => update({ heightCentimeters: event.target.value })} value={draft.heightCentimeters}>
                    <option value="">Choose</option>
                    {centimeterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} cm
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>

            <section className="onboarding-metric-card" aria-label="Weight">
              <div className="onboarding-metric-heading">
                <strong>Weight</strong>
                <div className="onboarding-unit-toggle" aria-label="Weight unit">
                  <ChoiceButton isSelected={draft.weightUnit === 'lb'} label="lb" onClick={() => update({ weightUnit: 'lb' })} />
                  <ChoiceButton isSelected={draft.weightUnit === 'kg'} label="kg" onClick={() => update({ weightUnit: 'kg' })} />
                </div>
              </div>
              <label className="onboarding-text-field">
                <span>Optional</span>
                <input
                  inputMode="decimal"
                  min="1"
                  onChange={(event) => update({ weightValue: event.target.value, weightSkipped: false })}
                  placeholder={draft.weightUnit === 'lb' ? 'Example: 155' : 'Example: 70'}
                  type="number"
                  value={draft.weightValue}
                />
              </label>
              <button
                aria-pressed={draft.weightSkipped}
                className={`onboarding-skip-button${draft.weightSkipped ? ' is-selected' : ''}`}
                onClick={() => update({ weightSkipped: true, weightValue: '' })}
                type="button"
              >
                Skip weight for now
              </button>
            </section>
          </div>
        </>
      );
    }

    if (stepId === 'plan') {
      return (
        <>
          <span className="comfort-kicker">CHOOSE YOUR PLAN</span>
          <h1 id="onboarding-title">Start free. Upgrade only if it helps.</h1>
          <p>Always FREE is selected by default. Paid plans are placeholders for this prototype.</p>
          <div className="onboarding-tier-grid">
            {tiers.map(([name, price, text, features]) => (
              <button
                aria-pressed={draft.planTier === name}
                className={draft.planTier === name ? 'is-selected' : undefined}
                key={name}
                onClick={() => update({ planTier: name as PlanTier })}
                type="button"
              >
                <span>{name}</span>
                <strong>{price}</strong>
                <p>{text}</p>
                <small>{features.slice(0, 2).join(' / ')}</small>
              </button>
            ))}
          </div>
        </>
      );
    }

    const question = onboardingQuestions[stepId as keyof typeof onboardingQuestions];

    if (question.kind === 'text') {
      return (
        <>
          <span className="comfort-kicker">START NOW</span>
          <h1 id="onboarding-title">{question.label}</h1>
          <p>{question.helper}</p>
          <label className="onboarding-text-field">
            <span>Name</span>
            <input
              autoComplete="given-name"
              autoFocus
              onChange={(event) => update({ displayName: event.target.value })}
              placeholder="Your name"
              type="text"
              value={draft.displayName}
            />
          </label>
        </>
      );
    }

    if (stepId === 'schedule') {
      return (
        <>
          <span className="comfort-kicker">WEEK RHYTHM</span>
          <h1 id="onboarding-title">{question.label}</h1>
          <p>{question.helper}</p>
          <div className="onboarding-two-groups">
            <fieldset className="onboarding-choice-group">
              <legend>Training days</legend>
              <div>
                {question.choices.map((option) => (
                  <ChoiceButton key={option} isSelected={draft.trainingDays === option} label={option} onClick={() => update({ trainingDays: option })} />
                ))}
              </div>
            </fieldset>
            <fieldset className="onboarding-choice-group">
              <legend>School load</legend>
              <div>
                {schoolLoadOptions.map((option) => (
                  <ChoiceButton key={option} isSelected={draft.schoolLoad === option} label={option} onClick={() => update({ schoolLoad: option })} />
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset className="onboarding-choice-group">
            <legend>Sleep lately</legend>
            <div className="onboarding-choice-wrap">
              {sleepOptions.map((option) => (
                <ChoiceButton key={option} isSelected={draft.sleepRange === option} label={option} onClick={() => update({ sleepRange: option })} />
              ))}
            </div>
          </fieldset>
          {draft.sleepRange.includes('Under 6') || draft.sleepRange.includes('6-7') ? (
            <p className="onboarding-inline-note">
              Good to know. Pace will add a simple sleep setup so the plan helps tonight instead of judging today.
            </p>
          ) : null}
          <label className="onboarding-text-field onboarding-wide-field">
            <span>Anything big this week?</span>
            <input
              onChange={(event) => update({ scheduleNotes: event.target.value })}
              placeholder="Example: tournament Saturday, two tests, travel day..."
              value={draft.scheduleNotes}
            />
          </label>
        </>
      );
    }

    if (stepId === 'preferences') {
      return (
        <>
          <span className="comfort-kicker">PACE LOOP</span>
          <h1 id="onboarding-title">{question.label}</h1>
          <p>{question.helper}</p>
          <fieldset className="onboarding-choice-group">
            <legend>What usually gets in the way?</legend>
            <div className="onboarding-choice-wrap">
              {blockerOptions.map((option) => (
                <ChoiceButton
                  key={option}
                  isSelected={draft.blockers.includes(option)}
                  label={option}
                  onClick={() => toggleMulti('blockers', option)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="onboarding-choice-group">
            <legend>Choose all that help</legend>
            <div className="onboarding-choice-wrap">
              {question.choices.map((option) => (
                <ChoiceButton
                  key={option}
                  isSelected={draft.reminderPreference.includes(option)}
                  label={option}
                  onClick={() => toggleMulti('reminderPreference', option)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="onboarding-choice-group">
            <legend>How should Pace support you?</legend>
            <div className="onboarding-choice-wrap">
              {supportStyleOptions.map((option) => (
                <ChoiceButton
                  key={option}
                  isSelected={draft.supportStyle === option}
                  label={option}
                  onClick={() => update({ supportStyle: option })}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="onboarding-choice-group">
            <legend>Coach sharing</legend>
            <div className="onboarding-choice-wrap">
              {coachShareOptions.map((option) => (
                <ChoiceButton key={option} isSelected={draft.coachShare === option} label={option} onClick={() => update({ coachShare: option })} />
              ))}
            </div>
          </fieldset>
        </>
      );
    }

    const key = question.id as 'person' | 'foodGoal';

    return (
      <>
        <span className="comfort-kicker">{stepId === 'sports' || stepId === 'goals' ? 'CHOOSE ALL THAT FIT' : `WELCOME, ${displayName.toUpperCase()}`}</span>
        <h1 id="onboarding-title">{question.label}</h1>
        <p>{question.helper}</p>
        <fieldset className="onboarding-choice-group">
          <legend>{question.kind === 'multi' ? 'Multiple answers allowed' : 'Choose one'}</legend>
          <div className="onboarding-choice-wrap">
            {question.choices.map((option) => {
              const selected =
                stepId === 'sports'
                  ? draft.sportOptions.includes(option)
                  : stepId === 'goals'
                    ? draft.goals.includes(option)
                    : draft[key] === option;

              return (
                <ChoiceButton
                  key={option}
                  isSelected={selected}
                  label={option}
                  onClick={() => {
                    if (stepId === 'sports') toggleMulti('sportOptions', option);
                    else if (stepId === 'goals') toggleMulti('goals', option);
                    else update({ [key]: option } as Partial<OnboardingDraft>);
                  }}
                />
              );
            })}
          </div>
        </fieldset>
        {stepId === 'sports' && draft.sportOptions.includes('Other') ? (
          <label className="onboarding-text-field onboarding-wide-field">
            <span>Your sport</span>
            <input onChange={(event) => update({ otherSport: event.target.value })} placeholder="Type it here" value={draft.otherSport} />
          </label>
        ) : null}
        {stepId === 'sports' ? (
          <label className="onboarding-text-field onboarding-wide-field">
            <span>Position or event</span>
            <input onChange={(event) => update({ position: event.target.value })} placeholder="Example: point guard, 400m, striker..." value={draft.position} />
          </label>
        ) : null}
        {stepId === 'goals' && draft.goals.includes('Other') ? (
          <label className="onboarding-text-field onboarding-wide-field">
            <span>Your goal</span>
            <input onChange={(event) => update({ otherGoal: event.target.value })} placeholder="Type it here" value={draft.otherGoal} />
          </label>
        ) : null}
      </>
    );
  }

  return (
    <section className="onboarding-page route-page" aria-labelledby="onboarding-title">
      <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${startSteps.length}`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <form className="onboarding-shell" onSubmit={next}>
        <div className="onboarding-step" key={stepId}>{renderQuestion()}</div>

        <p className="onboarding-error" role="alert" aria-live="polite">
          {error}
        </p>

        {stepId !== 'generating' ? (
          <div className="onboarding-actions">
            <button className="secondary-action" onClick={back} type="button">
              {stepIndex === 0 ? 'Back home' : 'Back'}
            </button>
            <button className="primary-action" disabled={!canContinue || isGenerating} type="submit">
              {stepId === 'plan' ? 'Build my dashboard' : 'Next'}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

export { stepPath };
