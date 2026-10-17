import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useActiveWorkout } from '../hooks/data';
import { useNow } from '../hooks/useNow';
import { useI18n, type TKey } from '../i18n';
import { formatClock } from '../lib/format';
import { IconChart, IconDumbbell, IconHistory, IconList, IconSettings } from './Icons';
import { RestBar, useRestTimerController } from './RestTimer';

const TABS: { to: string; label: TKey; icon: typeof IconDumbbell; end?: boolean }[] = [
  { to: '/', label: 'tab.workout', icon: IconDumbbell, end: true },
  { to: '/history', label: 'tab.history', icon: IconHistory },
  { to: '/progress', label: 'tab.progress', icon: IconChart },
  { to: '/exercises', label: 'tab.exercises', icon: IconList },
  { to: '/settings', label: 'tab.settings', icon: IconSettings },
];

export function Layout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const active = useActiveWorkout();
  const { timer, remaining } = useRestTimerController();
  const onWorkout = pathname === '/workout';
  const now = useNow(1000, !!active && !onWorkout);

  return (
    <div className="app">
      {/* Keyed on the path so each screen gets the entrance animation. */}
      <div key={pathname} className="route">
        <Outlet />
      </div>

      {onWorkout && timer && (
        <div className="floating floating--bottom">
          <RestBar timer={timer} remaining={remaining} />
        </div>
      )}

      {!onWorkout && active && (
        <div className="floating floating--above-tabs">
          <NavLink to="/workout" className="pill" aria-label={t('pill.resume')}>
            <span className="pill__dot" aria-hidden />
            <span className="grow pill__name">{active.name}</span>
            {timer && remaining > 0 && <span className="timer pill__rest">{t('pill.rest', { time: formatClock(remaining) })}</span>}
            <span className="timer">{formatClock(now - active.startedAt)}</span>
          </NavLink>
        </div>
      )}

      {!onWorkout && (
        <nav className="tabbar" aria-label={t('nav.main')}>
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <span className="tabbar__icon"><Icon /></span>
              <span>{t(label)}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
