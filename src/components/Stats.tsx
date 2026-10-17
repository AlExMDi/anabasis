import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Exercise, Unit, Workout } from '../db/types';
import { useI18n } from '../i18n';
import { formatDuration, formatMonthYear, formatShortDate, weekdayInitials } from '../lib/format';
import { addWeeks, dayKey, monthCalendar, monthGrid, muscleSets, weekComparison, weekStart, weekStreak } from '../lib/stats';
import { formatVolume } from '../lib/units';
import { IconBack, IconChevron, IconFlame } from './Icons';

/** Compact "this week" strip for the home screen. */
export function WeekStrip({ workouts, unit }: { workouts: Workout[]; unit: Unit }) {
  const { t, tn } = useI18n();
  const { thisWeek } = useMemo(() => weekComparison(workouts), [workouts]);
  const streak = useMemo(() => weekStreak(workouts), [workouts]);
  const days = useMemo(() => {
    const start = weekStart(Date.now());
    const trained = new Set(workouts.filter((w) => w.startedAt >= start).map((w) => dayKey(w.startedAt)));
    const today = dayKey(Date.now());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = dayKey(d.getTime());
      return { key, trained: trained.has(key), today: key === today };
    });
  }, [workouts]);
  const initials = weekdayInitials();

  return (
    <section className="card week-strip" aria-label={t('home.thisWeek')}>
      <div className="row row--between">
        <div>
          <p className="section-title">{t('home.thisWeek')}</p>
          <p className="week-strip__big">{tn('home.weekWorkouts', thisWeek.workouts)}</p>
          {thisWeek.workouts > 0 && <p className="small muted">{formatVolume(thisWeek.volume, unit)} · {formatDuration(thisWeek.durationMs)}</p>}
        </div>
        <div className={`streak ${streak > 0 ? 'streak--on' : ''}`}>
          <IconFlame width={22} height={22} />
          <span className="small">{streak > 0 ? tn('home.streak', streak) : t('home.streakNone')}</span>
        </div>
      </div>
      <div className="week-days" aria-hidden>
        {days.map((d, i) => (
          <div key={d.key} className={`week-day ${d.trained ? 'week-day--on' : ''} ${d.today ? 'week-day--today' : ''}`}>
            <span>{initials[i]}</span>
            <i />
          </div>
        ))}
      </div>
    </section>
  );
}

function Delta({ now, before, format }: { now: number; before: number; format: (n: number) => string }) {
  if (before === 0 && now === 0) return null;
  const diff = now - before;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  return <span className={`delta ${diff > 0 ? 'delta--up' : diff < 0 ? 'delta--down' : ''}`}>{sign}{format(Math.abs(diff))}</span>;
}

export function WeekComparison({ workouts, unit }: { workouts: Workout[]; unit: Unit }) {
  const { t, tn } = useI18n();
  const { thisWeek, lastWeek } = useMemo(() => weekComparison(workouts), [workouts]);
  const streak = useMemo(() => weekStreak(workouts), [workouts]);
  return (
    <section className="card stack" aria-label={t('progress.thisWeek')}>
      <div className="row row--between">
        <h2 className="section-title">{t('progress.thisWeek')}</h2>
        <span className="tiny faint">{t('progress.vsLastWeek')}</span>
      </div>
      <div className="stats stats--2">
        <div className="stat">
          <div className="stat__label">{t('common.workouts')}</div>
          <div className="stat__value">{thisWeek.workouts} <Delta now={thisWeek.workouts} before={lastWeek.workouts} format={String} /></div>
        </div>
        <div className="stat">
          <div className="stat__label">{t('common.volume')}</div>
          <div className="stat__value">{formatVolume(thisWeek.volume, unit)} <Delta now={thisWeek.volume} before={lastWeek.volume} format={(n) => formatVolume(n, unit)} /></div>
        </div>
        <div className="stat">
          <div className="stat__label">{t('common.sets')}</div>
          <div className="stat__value">{thisWeek.sets} <Delta now={thisWeek.sets} before={lastWeek.sets} format={String} /></div>
        </div>
        <div className="stat">
          <div className="stat__label">{t('progress.streak')}</div>
          <div className="stat__value row"><IconFlame width={16} height={16} className={streak > 0 ? 'flame-on' : 'faint'} /> {tn('progress.streakWeeks', streak)}</div>
        </div>
      </div>
    </section>
  );
}

export function MonthCalendar({ workouts }: { workouts: Workout[] }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const days = useMemo(() => monthCalendar(workouts, cursor.y, cursor.m), [workouts, cursor]);
  const cells = monthGrid(cursor.y, cursor.m);
  const initials = weekdayInitials();
  const shift = (d: number) => setCursor(({ y, m }) => {
    const date = new Date(y, m + d, 1);
    return { y: date.getFullYear(), m: date.getMonth() };
  });
  const isFuture = cursor.y > today.getFullYear() || (cursor.y === today.getFullYear() && cursor.m >= today.getMonth());

  return (
    <section className="card stack" aria-label={t('progress.calendar')}>
      <div className="row row--between">
        <button type="button" className="icon-btn" aria-label={t('progress.prevMonth')} onClick={() => shift(-1)}><IconBack /></button>
        <h2 className="calendar__title">{formatMonthYear(cursor.y, cursor.m)}</h2>
        <button type="button" className="icon-btn" aria-label={t('progress.nextMonth')} disabled={isFuture} onClick={() => shift(1)}><IconChevron /></button>
      </div>
      <div className="calendar" role="grid">
        {initials.map((d, i) => <div key={`h${i}`} className="calendar__head" role="columnheader">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const list = days.get(day);
          const isToday = cursor.y === today.getFullYear() && cursor.m === today.getMonth() && day === today.getDate();
          const cls = `calendar__day ${list ? 'calendar__day--on' : ''} ${isToday ? 'calendar__day--today' : ''}`;
          if (!list) return <div key={day} className={cls} role="gridcell">{day}</div>;
          const date = new Date(cursor.y, cursor.m, day).getTime();
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              className={cls}
              aria-label={t('progress.dayWorkouts', { date: formatShortDate(date), names: list.map((w) => w.name).join(', ') })}
              onClick={() => navigate(`/history/${list[list.length - 1]!.id}`)}
            >
              {day}
              {list.length > 1 && <sup>{list.length}</sup>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function MuscleBars({ workouts, exercises }: { workouts: Workout[]; exercises: Map<string, Exercise> }) {
  const { t, tn, muscle } = useI18n();
  const rows = useMemo(() => {
    const start = weekStart(Date.now());
    return muscleSets(workouts, exercises, start, addWeeks(start, 1));
  }, [workouts, exercises]);
  const max = Math.max(1, ...rows.map((r) => r.sets));
  return (
    <section className="card stack" aria-label={t('progress.musclesWeek')}>
      <h2 className="section-title">{t('progress.musclesWeek')}</h2>
      {rows.length === 0 ? (
        <p className="small muted">{t('progress.musclesEmpty')}</p>
      ) : (
        <ul className="bars">
          {rows.map((r) => (
            <li key={r.muscle} className="bars__row">
              <span className="bars__label small">{muscle(r.muscle)}</span>
              <span className="bars__track"><span className="bars__fill" style={{ width: `${(r.sets / max) * 100}%` }} /></span>
              <span className="bars__value small tabular">{tn('common.setsCount', r.sets)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
