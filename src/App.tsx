import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary, ErrorState, Loading } from './components/States';
import { db } from './db/db';
import { requestPersistentStorage } from './lib/storage';
import { ActiveWorkoutPage } from './pages/ActiveWorkoutPage';
import { ExerciseFormPage } from './pages/ExerciseFormPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { ProgressPage } from './pages/ProgressPage';
import { RoutineEditorPage } from './pages/RoutineEditorPage';
import { SettingsPage } from './pages/SettingsPage';

// Recharts is most of the bundle, so the chart page loads on demand.
// The service worker precaches every chunk, so this still works offline.
const ProgressExercisePage = lazy(() => import('./pages/ProgressExercisePage').then((m) => ({ default: m.ProgressExercisePage })));

/** Router-agnostic app: main.tsx wraps it in a HashRouter, tests in a MemoryRouter. */
export function App() {
  const [dbState, setDbState] = useState<'opening' | 'ready' | Error>('opening');

  useEffect(() => {
    db.open().then(
      () => setDbState('ready'),
      (e: unknown) => setDbState(e instanceof Error ? e : new Error(String(e))),
    );
    // Ask once on start; Settings shows the outcome.
    void requestPersistentStorage();
  }, []);

  if (dbState === 'opening') return <main className="page page--no-tabs"><Loading label="Opening database…" /></main>;
  if (dbState instanceof Error) {
    return (
      <main className="page page--no-tabs">
        <ErrorState
          title="Storage unavailable"
          message={`The local database could not be opened (${dbState.message}). Private browsing or blocked site data can cause this.`}
          action={<button className="btn btn--primary" onClick={() => window.location.reload()}>Try again</button>}
        />
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="workout" element={<ActiveWorkoutPage />} />
          <Route path="routines/new" element={<RoutineEditorPage />} />
          <Route path="routines/:id" element={<RoutineEditorPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:id" element={<HistoryDetailPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route
            path="progress/:exerciseId"
            element={<Suspense fallback={<main className="page page--no-tabs"><Loading /></main>}><ProgressExercisePage /></Suspense>}
          />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="exercises/new" element={<ExerciseFormPage />} />
          <Route path="exercises/:id/edit" element={<ExerciseFormPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
