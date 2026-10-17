import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Unit, Workout } from '../db/types';
import { useI18n } from '../i18n';
import { formatShortDate } from '../lib/format';
import { weeklySeries } from '../lib/stats';
import { formatNumber, toDisplayWeight } from '../lib/units';

export function WeeklyVolumeChart({ workouts, unit }: { workouts: Workout[]; unit: Unit }) {
  const { t } = useI18n();
  const data = useMemo(
    () => weeklySeries(workouts, 12).map((w) => ({ week: w.weekStart, value: Math.round(toDisplayWeight(w.volume, unit)), workouts: w.workouts })),
    [workouts, unit],
  );
  return (
    <section className="card stack" aria-label={t('progress.weeklyVolume')}>
      <h2 className="section-title">{t('progress.weeklyVolume')}</h2>
      <div className="chart" role="img" aria-label={t('progress.weeklyChart', { unit })}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#2c313c" vertical={false} />
            <XAxis dataKey="week" tickFormatter={(v: number) => formatShortDate(v)} stroke="#2c313c" tickLine={false} minTickGap={16} />
            <YAxis stroke="#2c313c" tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatNumber(v, 0)} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#20242d', border: '1px solid #2c313c', borderRadius: 10, color: '#eef0f4' }}
              labelStyle={{ color: '#a3aab8' }}
              labelFormatter={(v) => formatShortDate(Number(v))}
              formatter={(v) => [`${formatNumber(Number(v), 0)} ${unit}`, t('common.volume')]}
            />
            <Bar dataKey="value" fill="#4f8cff" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
