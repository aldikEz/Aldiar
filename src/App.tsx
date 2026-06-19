import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppEmptySetup,
  AppNavigation,
  ChatPage,
  CoachPage,
  DashboardPage,
  FoodPage,
  LegalPage,
  PlanPage,
  ProfilePage,
  TrainingPage,
} from './pace/components/AppPages';
import { CommandPalette } from './pace/components/CommandPalette';
import { Footer } from './pace/components/Footer';
import { Header } from './pace/components/Header';
import { HeroSection } from './pace/components/HeroSection';
import { MarketingSections } from './pace/components/MarketingSections';
import {
  OnboardingPage,
  defaultOnboardingDraft,
  stepPath,
  type OnboardingDraft,
} from './pace/components/OnboardingPage';
import { PlanPreview } from './pace/components/PlanPreview';
import { commands, hooks, startSteps } from './pace/content';
import { usePaceApp, type ProfileAnswers } from './pace/usePaceApp';
import type { CommandAction, LegalId, OnboardingStepId } from './pace/types';

type RouteKind =
  | 'home'
  | 'start'
  | 'dashboard'
  | 'plan'
  | 'food'
  | 'training'
  | 'coach'
  | 'chat'
  | 'profile'
  | 'privacy'
  | 'terms';

type AppRoute = {
  kind: RouteKind;
  path: string;
  startStep?: OnboardingStepId;
};

const appRoutes: RouteKind[] = ['dashboard', 'plan', 'food', 'training', 'coach', 'chat', 'profile', 'privacy', 'terms'];

function readRoute(): AppRoute {
  if (typeof window === 'undefined') {
    return { kind: 'home', path: '/' };
  }

  const path = `${window.location.pathname}${window.location.search}`;
  const normalizedPath = window.location.pathname.replace(/\/$/, '') || '/';
  const [, first, second] = normalizedPath.split('/');

  if (first === 'start') {
    const step = startSteps.includes(second as OnboardingStepId) ? (second as OnboardingStepId) : 'name';
    return { kind: 'start', path, startStep: step };
  }

  if (normalizedPath === '/app') {
    return { kind: 'dashboard', path };
  }

  const routeName = normalizedPath.slice(1) as RouteKind;

  if (appRoutes.includes(routeName)) {
    return { kind: routeName, path };
  }

  return { kind: 'home', path };
}

export default function App() {
  const pace = usePaceApp();
  const [route, setRoute] = useState<AppRoute>(() => readRoute());
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCommand, setActiveCommand] = useState(0);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft>(defaultOnboardingDraft);
  const [isGeneratingSetup, setIsGeneratingSetup] = useState(false);
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCommands = useMemo(
    () => commands.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const isAppRoute = appRoutes.includes(route.kind);
  const showCoachNav =
    pace.profile?.person === 'Coach' ||
    pace.profile?.coachShare === 'Share summary with coach' ||
    pace.profile?.coachShare === 'Coach helps build plans' ||
    pace.profile?.planTier === 'Coach' ||
    pace.coachPeople.length > 0;

  useEffect(() => setActiveCommand(0), [query]);

  useEffect(() => {
    function onPopState() {
      setRoute(readRoute());
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, '') === '/app') {
      setBrowserPath('/dashboard', true);
    }

    if (window.location.pathname.replace(/\/$/, '') === '/start') {
      setBrowserPath('/start/name', true);
    }
  }, [route.path]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        commandOpen ? closeCommand() : openCommand();
        return;
      }

      if (!commandOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommand();
        return;
      }

      if (event.key === 'ArrowDown' && filteredCommands.length > 0) {
        event.preventDefault();
        setActiveCommand((value) => (value + 1) % filteredCommands.length);
        return;
      }

      if (event.key === 'ArrowUp' && filteredCommands.length > 0) {
        event.preventDefault();
        setActiveCommand((value) => (value === 0 ? filteredCommands.length - 1 : value - 1));
        return;
      }

      if (event.key === 'Enter' && filteredCommands.length > 0) {
        event.preventDefault();
        runCommand(filteredCommands[activeCommand]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCommand, commandOpen, filteredCommands]);

  useEffect(() => {
    if (!commandOpen) return;
    const frame = requestAnimationFrame(() => commandInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [commandOpen]);

  function setBrowserPath(path: string, replace = false) {
    if (typeof window === 'undefined') return;

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentPath !== path) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    }

    setRoute(readRoute());
  }

  function navigate(path: string, replace = false) {
    setBrowserPath(path, replace);
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }

  function navigateHome(hash?: string) {
    setBrowserPath(hash ? `/${hash}` : '/');

    window.setTimeout(() => {
      if (!hash) {
        window.scrollTo({ behavior: 'smooth', top: 0 });
        return;
      }

      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function openCommand() {
    setQuery('');
    setCommandOpen(true);
  }

  function closeCommand() {
    setCommandOpen(false);
  }

  function navigateStart() {
    navigate('/start/name');
  }

  function runCommand(command: CommandAction) {
    pace.setAction(command.label);
    setCommandOpen(false);

    switch (command.label) {
      case 'Open Today':
        navigate('/dashboard');
        break;
      case 'Make My Week Plan':
        pace.profile ? navigate('/plan') : navigateStart();
        break;
      case 'Generate AI Week':
        void pace.generateAiWeek();
        navigate('/dashboard');
        break;
      case 'Start Training':
        pace.startTraining();
        navigate('/training');
        break;
      case 'Log Food':
        navigate('/food');
        break;
      case 'Ask Pace':
        navigate('/chat');
        break;
      default:
        break;
    }
  }

  function pickTier(name: string) {
    pace.setSelectedTier(name as typeof pace.selectedTier);
    setOnboardingDraft((draft) => ({ ...draft, planTier: name as typeof pace.selectedTier }));
    navigateStart();
  }

  async function completeOnboarding(profile: ProfileAnswers) {
    setIsGeneratingSetup(true);
    await pace.createProfileWithAi(profile);
    setIsGeneratingSetup(false);
    navigate('/dashboard', true);
  }

  const planPreview = (
    <PlanPreview
      coachPinned={pace.coachPinned}
      copyNotice={pace.copyNotice}
      foodSummary={pace.currentFoodSummary}
      note={pace.note}
      plan={pace.plan}
      profileSummary={pace.profile ? pace.currentProfileSummary : undefined}
      onCopyPlan={pace.copyPlan}
      onEditPlan={() => (pace.profile ? navigate('/plan') : navigateStart())}
      onLogFood={() => navigate('/food')}
      onLogToday={() => navigate('/dashboard')}
    />
  );

  function renderAppRoute() {
    if (!pace.profile && route.kind !== 'profile' && route.kind !== 'privacy' && route.kind !== 'terms') {
      return <AppEmptySetup onStart={navigateStart} />;
    }

    if (route.kind === 'dashboard') {
      return (
        <DashboardPage
          cards={pace.cards}
          foodEntries={pace.foodEntries}
          note={pace.note}
          nutrition={pace.nutrition}
          plan={pace.plan}
          profile={pace.profile}
          reminders={pace.reminders}
          onNavigate={navigate}
          onToggleReminder={pace.toggleReminder}
        />
      );
    }

    if (route.kind === 'plan') {
      return (
        <PlanPage
          copyNotice={pace.copyNotice}
          note={pace.note}
          plan={pace.plan}
          reminders={pace.reminders}
          onCopyPlan={pace.copyPlan}
          onGenerateAiWeek={() => void pace.generateAiWeek()}
        />
      );
    }

    if (route.kind === 'food') {
      return <FoodPage entries={pace.foodEntries} nutrition={pace.nutrition} onAddFood={pace.addFood} onRemoveFood={pace.removeFood} />;
    }

    if (route.kind === 'training') {
      return (
        <TrainingPage
          activeSession={pace.activeSession}
          aiStatus={pace.aiStatus}
          history={pace.trainingHistory}
          nextSession={pace.nextSession}
          progress={pace.currentSessionProgress}
          onCompleteSet={pace.completeTrainingSet}
          onFinishTraining={pace.finishTraining}
          onGenerateAiWeek={() => void pace.generateAiWeek()}
          onResetExercise={pace.resetTrainingSet}
          onStartTraining={pace.startTraining}
        />
      );
    }

    if (route.kind === 'coach') {
      return <CoachPage people={pace.coachPeople} onAddPerson={pace.addCoachPerson} onRemovePerson={pace.removeCoachPerson} />;
    }

    if (route.kind === 'chat') {
      return (
        <ChatPage
          aiStatus={pace.aiStatus}
          messages={pace.chatMessages}
          notice={pace.chatNotice}
          onSendMessage={pace.sendChatMessage}
        />
      );
    }

    if (route.kind === 'profile') {
      return <ProfilePage dataNotice={pace.dataNotice} onClearData={pace.clearData} onNavigate={navigate} profile={pace.profile} />;
    }

    if (route.kind === 'privacy') {
      return <LegalPage panel="privacy" />;
    }

    if (route.kind === 'terms') {
      return <LegalPage panel="terms" />;
    }

    return null;
  }

  return (
    <div className={`app-shell${isAppRoute ? ' has-app-nav' : ''}`}>
      {isAppRoute ? <AppNavigation current={route.kind} onNavigate={navigate} showCoach={showCoachNav} /> : null}
      {!isAppRoute ? <Header onNavigateHome={navigateHome} onOpenProfile={() => navigate('/profile')} onStartTrial={navigateStart} /> : null}

      <main className={`layout-shell route-shell route-shell-${route.kind}`} id="main-content" key={route.path}>
        {route.kind === 'start' ? (
          <OnboardingPage
            draft={onboardingDraft}
            isGenerating={isGeneratingSetup}
            stepId={route.startStep ?? 'name'}
            onBackHome={() => navigateHome()}
            onComplete={completeOnboarding}
            onDraftChange={setOnboardingDraft}
            onNavigateStep={(step) => navigate(stepPath(step))}
          />
        ) : isAppRoute ? (
          renderAppRoute()
        ) : (
          <>
            <HeroSection hooks={hooks} onSeePlans={() => navigateHome('#plans')} onStartTrial={navigateStart} />
            {planPreview}
            <MarketingSections
              coachCount={pace.coachPeople.length}
              coachNames={pace.coachPeople.map((person) => person.name)}
              onOpenCoach={() => navigate('/coach')}
              onPickTier={pickTier}
            />
            <section className="final-cta" aria-labelledby="final-cta-title">
              <h2 id="final-cta-title">Make a week you can actually follow.</h2>
              <button className="primary-action" onClick={navigateStart} type="button">
                Start now
              </button>
            </section>
          </>
        )}
      </main>

      {!isAppRoute ? <Footer onOpenLegal={(panel: LegalId) => navigate(`/${panel}`)} /> : null}

      <CommandPalette
        activeIndex={activeCommand}
        inputRef={commandInputRef}
        isOpen={commandOpen}
        lastAction={pace.action}
        query={query}
        results={filteredCommands}
        onClose={closeCommand}
        onQueryChange={setQuery}
        onRun={runCommand}
        onSetActiveIndex={setActiveCommand}
      />
    </div>
  );
}
