import { useState } from 'react';
import { questions } from '../content';
import type { ProfileAnswers } from '../usePaceApp';

type PlannerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateProfile: (answers: ProfileAnswers) => void;
};

export function PlannerModal({ isOpen, onClose, onCreateProfile }: PlannerModalProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [other, setOther] = useState('');
  const currentQuestion = questions[step];
  const selectedChoice = answers[currentQuestion.id] ?? '';

  function choose(choice: string) {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [currentQuestion.id]: choice }));
    if (choice !== 'Other') {
      setOther('');
    }
  }

  function selectedAnswer(question = currentQuestion) {
    return answers[question.id] ?? question.choices[0];
  }

  function resetAndClose() {
    onClose();
  }

  function nextStep() {
    const picked = answers[currentQuestion.id];
    const value = picked === 'Other' && other.trim() ? other.trim() : picked;

    if (!picked) {
      choose(currentQuestion.choices[0]);
    }

    if (picked === 'Other' && other.trim()) {
      setAnswers((currentAnswers) => ({ ...currentAnswers, [currentQuestion.id]: other.trim() }));
      setOther('');
    }

    if (step < questions.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }

    const finalAnswers = questions.reduce<Record<string, string>>((memo, question) => {
      memo[question.id] = question.id === currentQuestion.id && value ? value : selectedAnswer(question);
      return memo;
    }, {});

    onCreateProfile(finalAnswers as unknown as ProfileAnswers);
    setStep(0);
    setAnswers({});
    setOther('');
    onClose();
  }

  return (
    <section aria-hidden={!isOpen} className={`planner-overlay${isOpen ? ' is-open' : ''}`} onClick={resetAndClose}>
      <div
        aria-labelledby="planner-title"
        aria-modal="true"
        className="planner-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="planner-header">
          <span>
            Step {step + 1} of {questions.length}
          </span>
          <button aria-label="Close planner" onClick={resetAndClose} type="button">
            Close
          </button>
        </div>
        <div className="planner-progress" aria-hidden="true">
          <span style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
        </div>
        <h2 id="planner-title">{currentQuestion.label}</h2>
        <p>{currentQuestion.helper}</p>
        <div className="planner-choice-grid">
          {currentQuestion.choices.map((choice) => (
            <button
              className={selectedChoice === choice ? 'is-selected' : ''}
              key={`${currentQuestion.id}-${choice}`}
              onClick={() => choose(choice)}
              type="button"
            >
              {choice}
            </button>
          ))}
        </div>
        {selectedChoice === 'Other' ? (
          <label className="planner-other-field">
            <span>Write your answer</span>
            <input
              onChange={(event) => setOther(event.target.value)}
              placeholder="Example: wrestling, rehab, coach plan..."
              type="text"
              value={other}
            />
          </label>
        ) : null}
        <div className="planner-footer">
          <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button">
            Back
          </button>
          <button onClick={nextStep} type="button">
            {step === questions.length - 1 ? 'Create plan' : 'Next'}
          </button>
        </div>
      </div>
    </section>
  );
}
