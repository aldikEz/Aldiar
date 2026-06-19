import { useState, type FormEvent } from 'react';
import {
  Apple,
  Bot,
  Check,
  ChevronRight,
  Dumbbell,
  Home,
  MessageCircle,
  NotebookText,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { CHAT_LIMIT } from '../safety';
import { legalPanels } from '../content';
import type { AiStatus } from '../usePaceApp';
import type {
  ChatMessage,
  CoachPerson,
  DashboardCard,
  FoodEntry,
  LegalId,
  NutritionTarget,
  PlanItem,
  Profile,
  Reminder,
  TrainingSession,
} from '../types';
import { AuroraBackground } from '../../components/ui/aurora-background';
import { TrainingPanel } from './TrainingPanel';

type AppRouteName = 'dashboard' | 'plan' | 'food' | 'training' | 'coach' | 'chat' | 'profile';

type AppNavProps = {
  current: string;
  onNavigate: (path: string) => void;
  showCoach: boolean;
};

const navItems: Array<[AppRouteName, string, typeof Home]> = [
  ['dashboard', 'Today', Home],
  ['plan', 'Plan', NotebookText],
  ['food', 'Food', Apple],
  ['training', 'Training', Dumbbell],
  ['chat', 'Ask', MessageCircle],
];

function mainBlocker(profile: Profile | null) {
  return profile?.blockers?.[0] ?? 'the week getting busy';
}

export function AppNavigation({ current, onNavigate, showCoach }: AppNavProps) {
  return (
    <>
      <aside className="pace-app-sidebar" aria-label="Pace app navigation">
        <button className="pace-app-brand" onClick={() => onNavigate('/dashboard')} type="button">
          <span aria-hidden="true">P</span>
          <strong>PACE AI</strong>
        </button>
        <nav>
          {navItems.map(([key, label, Icon]) => (
            <button
              aria-current={current === key ? 'page' : undefined}
              className={current === key ? 'is-active' : undefined}
              key={key}
              onClick={() => onNavigate(`/${key}`)}
              type="button"
            >
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
            </button>
          ))}
          {showCoach ? (
            <button
              aria-current={current === 'coach' ? 'page' : undefined}
              className={current === 'coach' ? 'is-active' : undefined}
              onClick={() => onNavigate('/coach')}
              type="button"
            >
              <UsersRound aria-hidden="true" size={20} />
              <span>Coach</span>
            </button>
          ) : null}
          <button
            aria-current={current === 'profile' ? 'page' : undefined}
            className={current === 'profile' ? 'is-active' : undefined}
            onClick={() => onNavigate('/profile')}
            type="button"
          >
            <UserRound aria-hidden="true" size={20} />
            <span>Profile</span>
          </button>
        </nav>
      </aside>
      <nav className="pace-bottom-nav" aria-label="Pace mobile navigation">
        {navItems.map(([key, label, Icon]) => (
          <button
            aria-current={current === key ? 'page' : undefined}
            className={current === key ? 'is-active' : undefined}
            key={key}
            onClick={() => onNavigate(`/${key}`)}
            type="button"
          >
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <header className="app-page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  );
}

function ToneIcon({ tone }: { tone: string }) {
  const Icon = tone === 'food' ? Apple : tone === 'training' ? Dumbbell : tone === 'recovery' ? ShieldCheck : NotebookText;
  return <Icon aria-hidden="true" size={18} />;
}

export function DashboardPage({
  cards,
  foodEntries,
  note,
  nutrition,
  onNavigate,
  onToggleReminder,
  plan,
  profile,
  reminders,
}: {
  cards: DashboardCard[];
  foodEntries: FoodEntry[];
  note: string;
  nutrition: NutritionTarget;
  onNavigate: (path: string) => void;
  onToggleReminder: (id: string) => void;
  plan: PlanItem[];
  profile: Profile | null;
  reminders: Reminder[];
}) {
  const name = profile?.displayName || 'there';
  const completedReminders = reminders.filter((item) => item.done).length;
  const primaryGoal = profile?.goals?.[0] ?? profile?.goal ?? 'Keep today simple';
  const blocker = mainBlocker(profile);
  const nextReminder = reminders.find((item) => !item.done) ?? reminders[0];
  const planPreviewItems = plan.slice(0, 2);
  const supportCards = cards.slice(0, 3);

  return (
    <section className="app-page app-dashboard dashboard-calm" aria-label="Today dashboard">
      <AuroraBackground className="dashboard-aurora" />
      <PageHeader
        eyebrow="Today"
        title={`Good to see you, ${name}.`}
        text="One focus, one next move, and the rest tucked away until you need it."
      />

      <section className="daily-focus-card" aria-label="Today's focus">
        <div className="daily-focus-main">
          <span>Today's focus</span>
          <h2>{primaryGoal}</h2>
          <p>{note}</p>
          <div className="daily-focus-actions">
            <button className="primary-action" onClick={() => onNavigate('/training')} type="button">
              Start training
            </button>
            <button className="secondary-action" onClick={() => onNavigate('/chat')} type="button">
              Ask Pace
            </button>
          </div>
        </div>
        <div className="daily-focus-path" aria-label="Pace loop summary">
          <article>
            <span>Protect</span>
            <strong>{primaryGoal}</strong>
          </article>
          <article>
            <span>Built around</span>
            <strong>{blocker}</strong>
          </article>
          <article>
            <span>Next move</span>
            <strong>{nextReminder ? `${nextReminder.time} ${nextReminder.title}` : 'Open the plan'}</strong>
          </article>
        </div>
      </section>

      <div className="dashboard-primary-grid">
        <section className="app-card" aria-labelledby="today-checklist-title">
          <div className="app-card-header">
            <div>
              <span>Checklist</span>
              <h2 id="today-checklist-title">
                {reminders.length ? `${completedReminders}/${reminders.length} done today` : 'No checklist yet'}
              </h2>
            </div>
            <button onClick={() => onNavigate('/plan')} type="button">
              Plan <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="reminder-list">
            {reminders.map((reminder) => (
              <button className={reminder.done ? 'is-done' : undefined} key={reminder.id} onClick={() => onToggleReminder(reminder.id)} type="button">
                <span>
                  {reminder.done ? <Check aria-hidden="true" size={16} /> : <ToneIcon tone={reminder.tone} />}
                </span>
                <strong>{reminder.time}</strong>
                <div>
                  <h3>{reminder.title}</h3>
                  <p>{reminder.detail}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="app-card plan-mini-card" aria-labelledby="plan-mini-title">
          <div className="app-card-header">
            <div>
              <span>Plan preview</span>
              <h2 id="plan-mini-title">{plan.length} steps ready</h2>
            </div>
            <button onClick={() => onNavigate('/chat')} type="button">
              Ask <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
          {planPreviewItems.map((item) => (
            <article key={`${item.time}-${item.title}`}>
              <time>{item.time}</time>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </section>
      </div>

      <details className="dashboard-context-drawer">
        <summary>
          <span>Food, support, and extra context</span>
          <ChevronRight aria-hidden="true" size={18} />
        </summary>
        <div className="dashboard-context-grid">
          <section className="app-card nutrition-card" aria-labelledby="nutrition-title">
            <div className="app-card-header">
              <div>
                <span>Food</span>
                <h2 id="nutrition-title">{nutrition.mode === 'optional-macros' ? 'Optional macros' : 'Simple tracking'}</h2>
              </div>
              <button onClick={() => onNavigate('/food')} type="button">
                Log <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
            {nutrition.mode === 'optional-macros' ? (
              <div className="macro-grid">
                {[
                  ['Cal', nutrition.calories],
                  ['Protein', nutrition.protein],
                  ['Carbs', nutrition.carbs],
                  ['Fats', nutrition.fats],
                ].map(([label, value]) => (
                  <article key={label}>
                    <strong>{value ?? '--'}</strong>
                    <span>{label}</span>
                  </article>
                ))}
              </div>
            ) : null}
            <p>{nutrition.note}</p>
            <small>{nutrition.hydration}</small>
            <small>{foodEntries.length ? `${foodEntries.length} food log item(s) saved.` : 'No food logged today.'}</small>
          </section>

          <section className="dashboard-support-strip" aria-label="Extra Pace context">
            {supportCards.map((card) => (
              <article className={`dashboard-card dashboard-card-${card.tone}`} key={card.id}>
                <span>
                  <ToneIcon tone={card.tone} />
                  {card.label}
                </span>
                <h2>{card.title}</h2>
                <p>{card.detail}</p>
              </article>
            ))}
          </section>
        </div>
      </details>
    </section>
  );
}

export function PlanPage({
  copyNotice,
  note,
  onCopyPlan,
  onGenerateAiWeek,
  plan,
  reminders,
}: {
  copyNotice: string;
  note: string;
  onCopyPlan: () => void;
  onGenerateAiWeek: () => void;
  plan: PlanItem[];
  reminders: Reminder[];
}) {
  return (
    <section className="app-page" aria-labelledby="plan-page-title">
      <PageHeader eyebrow="Plan" title="Not a generic schedule. Your loop." text="The first step protects what matters; the second tells you how to adjust when real life hits." />
      <div className="app-card plan-page-card">
        <div className="app-card-header">
          <div>
            <span>Pace note</span>
            <h2 id="plan-page-title">{note}</h2>
          </div>
          <div className="button-row">
            <button onClick={onGenerateAiWeek} type="button">AI refresh</button>
            <button onClick={onCopyPlan} type="button">Copy</button>
          </div>
        </div>
        <div className="plan-page-list">
          {plan.map((item) => (
            <article key={`${item.time}-${item.title}`}>
              <time>{item.time}</time>
              <span className={`plan-dot plan-dot-${item.tone}`} aria-hidden="true" />
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="copy-notice" role="status" aria-live="polite">{copyNotice}</p>
      </div>
      <div className="app-card">
        <div className="app-card-header">
          <div>
            <span>Reminders</span>
            <h2>What Pace will keep visible</h2>
          </div>
        </div>
        <div className="mini-reminder-grid">
          {reminders.map((reminder) => (
            <article key={reminder.id}>
              <strong>{reminder.time}</strong>
              <h3>{reminder.title}</h3>
              <p>{reminder.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FoodPage({
  entries,
  nutrition,
  onAddFood,
  onRemoveFood,
}: {
  entries: FoodEntry[];
  nutrition: NutritionTarget;
  onAddFood: (label: string, kind: string, macros?: Partial<Pick<FoodEntry, 'calories' | 'protein' | 'carbs' | 'fats'>>) => string;
  onRemoveFood: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('Meal');
  const [notice, setNotice] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const showMacros = nutrition.mode === 'optional-macros';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onAddFood(label, kind, showMacros ? {
      calories: Number(calories) || undefined,
      protein: Number(protein) || undefined,
    } : undefined);
    setNotice(message);

    if (label.trim()) {
      setLabel('');
      setCalories('');
      setProtein('');
    }
  }

  return (
    <section className="app-page" aria-labelledby="food-page-title">
      <PageHeader eyebrow="Food" title="Track what helps. Skip what does not." text="Use meals, snacks, water, or optional macros. No pressure language, no shame math." />
      <form className="app-card food-page-form" onSubmit={submit}>
        <div className="app-card-header">
          <div>
            <span>Quick log</span>
            <h2 id="food-page-title">Add one item</h2>
          </div>
          <button className="primary-action" type="submit">Add food</button>
        </div>
        <label>
          <span>Food or drink</span>
          <input onChange={(event) => setLabel(event.target.value)} placeholder="Example: eggs and toast" value={label} />
        </label>
        <label>
          <span>Type</span>
          <select onChange={(event) => setKind(event.target.value)} value={kind}>
            {['Meal', 'Snack', 'Water', 'Note'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        {showMacros ? (
          <div className="food-macro-fields">
            <label>
              <span>Calories optional</span>
              <input inputMode="numeric" onChange={(event) => setCalories(event.target.value)} placeholder="Example: 520" value={calories} />
            </label>
            <label>
              <span>Protein optional</span>
              <input inputMode="numeric" onChange={(event) => setProtein(event.target.value)} placeholder="Example: 32" value={protein} />
            </label>
          </div>
        ) : null}
        <p role="status" aria-live="polite">{notice}</p>
      </form>
      <div className="app-card food-log-page-list">
        <div className="app-card-header">
          <div>
            <span>Today</span>
            <h2>{entries.length ? `${entries.length} entries` : 'No entries yet'}</h2>
          </div>
        </div>
        {entries.length ? entries.map((entry) => (
          <article key={entry.id}>
            <div>
              <h3>{entry.label}</h3>
              <p>{entry.kind}{entry.calories ? ` / ${entry.calories} cal` : ''}{entry.protein ? ` / ${entry.protein}g protein` : ''}</p>
            </div>
            <button onClick={() => onRemoveFood(entry.id)} type="button">Remove</button>
          </article>
        )) : <p>Add one simple item when it helps.</p>}
      </div>
    </section>
  );
}

export function TrainingPage(props: {
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
}) {
  return (
    <section className="app-page app-training-page" aria-labelledby="training-page-title">
      <PageHeader eyebrow="Training" title="Start the session, not another dashboard." text="One prepared workout, visible targets, and a clean finish." />
      <TrainingPanel {...props} />
    </section>
  );
}

export function CoachPage({
  people,
  onAddPerson,
  onRemovePerson,
}: {
  people: CoachPerson[];
  onAddPerson: (name: string) => string;
  onRemovePerson: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onAddPerson(name);
    setNotice(message);
    if (name.trim()) setName('');
  }

  return (
    <section className="app-page" aria-labelledby="coach-page-title">
      <PageHeader eyebrow="Coach" title="Coach mode, without another group chat." text="Add people, see the planning focus, and keep notes short and consent-based." />
      <form className="app-card coach-page-form" onSubmit={submit}>
        <div className="app-card-header">
          <div>
            <span>Roster</span>
            <h2 id="coach-page-title">Add a person</h2>
          </div>
          <button className="primary-action" type="submit">Add</button>
        </div>
        <label>
          <span>Name</span>
          <input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Example: Sam" value={name} />
        </label>
        <p role="status" aria-live="polite">{notice}</p>
      </form>
      <div className="app-card coach-page-list">
        {people.length ? people.map((person) => (
          <article key={person.id}>
            <div>
              <h3>{person.name}</h3>
              <p>{person.focus}</p>
            </div>
            <button onClick={() => onRemovePerson(person.id)} type="button">Remove</button>
          </article>
        )) : <p>No people added yet.</p>}
      </div>
    </section>
  );
}

export function ChatPage({
  aiStatus,
  messages,
  notice,
  onSendMessage,
}: {
  aiStatus: AiStatus;
  messages: ChatMessage[];
  notice: string;
  onSendMessage: (message: string) => Promise<string>;
}) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    await onSendMessage(message);
    setIsSending(false);
    if (message.trim()) setMessage('');
  }

  return (
    <section className="app-page chat-page" aria-labelledby="chat-page-title">
      <PageHeader eyebrow="Ask Pace" title="Tweak the plan without starting over." text="Ask short questions about your plan. Unsafe or hateful requests are blocked before AI runs." />
      <div className="app-card chat-window">
        <div className="chat-message-list">
          {messages.length ? messages.map((item) => (
            <article className={`chat-message chat-message-${item.role}`} key={item.id}>
              <span>{item.role === 'user' ? 'You' : 'Pace'}</span>
              <p>{item.text}</p>
            </article>
          )) : (
            <article className="chat-message chat-message-assistant">
              <span>Pace</span>
              <p>Ask something like “make tomorrow lighter” or “how should I handle food before practice?”</p>
            </article>
          )}
        </div>
        <form className="chat-form" onSubmit={submit}>
          <label>
            <span>Your question</span>
            <textarea
              maxLength={CHAT_LIMIT}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask a safe, specific question..."
              value={message}
            />
          </label>
          <div>
            <small>{message.length}/{CHAT_LIMIT}</small>
            <button className="primary-action" disabled={isSending || !message.trim()} type="submit">
              {isSending ? 'Sending...' : 'Ask Pace'}
            </button>
          </div>
        </form>
        <p className={`training-ai-status training-ai-status-${aiStatus.state}`} role="status" aria-live="polite">
          {notice || aiStatus.message}
        </p>
      </div>
    </section>
  );
}

export function ProfilePage({
  dataNotice,
  onClearData,
  onNavigate,
  profile,
}: {
  dataNotice: string;
  onClearData: () => void;
  onNavigate: (path: string) => void;
  profile: Profile | null;
}) {
  return (
    <section className="app-page" aria-labelledby="profile-page-title">
      <PageHeader eyebrow="Profile" title="Your Pace setup." text="This prototype saves data in this browser only." />
      <div className="app-card profile-page-card">
        <div className="app-card-header">
          <div>
            <span>Saved setup</span>
            <h2 id="profile-page-title">{profile?.displayName ?? 'No profile yet'}</h2>
          </div>
          <button onClick={() => onNavigate('/start/name')} type="button">Edit setup</button>
        </div>
        <dl>
          {[
            ['Role', profile?.person],
            ['Sport', profile?.sport],
            ['Goals', profile?.goals?.join(', ') || profile?.goal],
            ['Training', profile?.trainingDays],
            ['Food', profile?.foodGoal],
            ['Plan', profile?.planTier ?? 'Always FREE'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? 'Not set'}</dd>
            </div>
          ))}
        </dl>
        <div className="profile-actions">
          <button onClick={() => onNavigate('/privacy')} type="button">Privacy</button>
          <button onClick={() => onNavigate('/terms')} type="button">Terms</button>
          <button className="danger-action" onClick={onClearData} type="button">Clear demo data</button>
        </div>
        <p role="status" aria-live="polite">{dataNotice}</p>
      </div>
    </section>
  );
}

export function LegalPage({ panel }: { panel: LegalId }) {
  const content = legalPanels[panel];

  return (
    <section className="app-page legal-route-page" aria-labelledby="legal-route-title">
      <PageHeader eyebrow="Legal" title={content.title} text={content.intro} />
      <div className="app-card">
        <p className="legal-updated">Updated {content.updated}</p>
        <div className="legal-content">
          {content.items.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AppEmptySetup({ onStart }: { onStart: () => void }) {
  return (
    <section className="app-page app-empty-setup" aria-labelledby="empty-setup-title">
      <Bot aria-hidden="true" size={38} />
      <h1 id="empty-setup-title">Start with your setup.</h1>
      <p>Pace needs a few answers before the dashboard can become personal.</p>
      <button className="primary-action" onClick={onStart} type="button">Start now</button>
    </section>
  );
}
