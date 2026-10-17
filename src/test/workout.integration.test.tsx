import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { db, resetDatabase } from '../db/db';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('logging a full workout', () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('starts, logs sets, survives a reload, finishes and shows up in history', async () => {
    const user = userEvent.setup();
    const first = renderApp();

    await user.click(await screen.findByRole('button', { name: /start empty workout/i }));
    await user.click(await screen.findByRole('button', { name: /add exercises/i }));

    // Pick Bench Press from the library sheet.
    const picker = await screen.findByRole('dialog', { name: /add exercises/i });
    await user.type(within(picker).getByRole('searchbox', { name: /search exercises/i }), 'bench press');
    await user.click(await within(picker).findByRole('button', { name: /^Bench Press\s*chest/ }));
    await user.click(within(picker).getByRole('button', { name: /add 1 exercise/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Set 1: type weight and reps, pick an RPE, tick it.
    await user.type(await screen.findByLabelText('Weight (kg) for Bench Press set 1'), '100');
    await user.type(screen.getByLabelText('Reps for Bench Press set 1'), '5');
    await user.selectOptions(screen.getByLabelText('RPE for Bench Press set 1'), '8');
    await user.click(screen.getByRole('button', { name: 'Complete Bench Press set 1' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Bench Press set 1' })).toHaveAttribute('aria-pressed', 'true'));

    // Completing a set starts the rest timer.
    expect(await screen.findByRole('timer', { name: /rest timer/i })).toBeInTheDocument();

    // "Close the app": unmount everything and boot again from the home screen.
    first.unmount();
    renderApp();
    await user.click(await screen.findByRole('link', { name: /resume workout$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Bench Press set 1' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByLabelText('Weight (kg) for Bench Press set 1')).toHaveValue('100');

    // Set 2 is pre-filled from set 1; set 3 gets added then removed.
    await user.click(screen.getByRole('button', { name: /add set/i }));
    await user.click(await screen.findByRole('button', { name: 'Complete Bench Press set 2' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Bench Press set 2' })).toHaveAttribute('aria-pressed', 'true'));
    await user.click(screen.getByRole('button', { name: /add set/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete Bench Press set 3' }));
    await waitFor(() => expect(screen.getAllByTestId('set-row')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText(/workout saved/i)).toBeInTheDocument();

    // Persisted as a completed workout with both sets.
    const [saved] = await db.workouts.toArray();
    expect(saved).toMatchObject({ status: 'completed' });
    expect(saved!.endedAt).toBeGreaterThanOrEqual(saved!.startedAt);
    expect(saved!.exercises[0]!.sets.map((s) => [s.weight, s.reps, s.rpe, s.completed])).toEqual([
      [100, 5, 8, true],
      [100, 5, null, true],
    ]);
    expect(await db.timers.count()).toBe(0);

    // History list shows it with volume and set count.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const card = await screen.findByRole('link', { name: /morning|afternoon|evening workout/i });
    expect(within(card).getByText('1,000 kg')).toBeInTheDocument();
    expect(within(card).getByText('2')).toBeInTheDocument();
  });
});
