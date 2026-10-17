import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconAlert } from './Icons';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      {icon}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div className="state" role="alert">
      <IconAlert />
      <h2>{title}</h2>
      {message && <p className="small">{message}</p>}
      {action}
    </div>
  );
}

interface EBState { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page page--no-tabs">
          <ErrorState
            message={`${this.state.error.message}. Your data is stored on this device and has not been lost.`}
            action={
              <button className="btn btn--primary" onClick={() => window.location.reload()}>
                Reload app
              </button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
