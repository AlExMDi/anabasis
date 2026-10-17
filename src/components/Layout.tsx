import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useActiveWorkout } from '../hooks/data';
import { useNow } from '../hooks/useNow';
import { formatClock } from '../lib/format';
import { IconChart, IconDumbbell, IconHistory, IconList, IconSettings } from './Icons';
import { RestBar, useRestTimerController } from './RestTimer';

const TABS = [
  { to: '/', label: 'Workout', icon: IconDumbbell, end: true },
  { to: '/history', label: 'History', icon: IconHistory },
  { to: '/progress', label: 'Progress', icon: IconChart },
  { to: '/exercises', label: 'Exercises', icon: IconList },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];

export function Layout() {
  const { pathname } = useLocation();
  const active = useActiveWorkout();
  const { timer, remaining } = useRestTimerController();
  const onWorkout = pathname === '/workout';
  const now = useNow(1000, !!active && !onWorkout);

  return (
    <div className="app">
      <Outlet />

      {onWorkout && timer && (
        <div className="floating floating--bottom">
          <RestBar timer={timer} remaining={remaining} />
        </div>
      )}

      {!onWorkout && active && (
        <div className="floating floating--above-tabs">
          <NavLink to="/workout" className="pill" aria-label="Resume workout in progress">
            <span className="grow">{active.name}</span>
            {timer && remaining > 0 && <span className="timer">Rest {formatClock(remaining)}</span>}
            <span className="timer">{formatClock(now - active.startedAt)}</span>
          </NavLink>
        </div>
      )}

      {!onWorkout && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
