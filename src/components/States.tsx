import { Component, type ErrorInfo, type ReactNode } from 'react';
import { I18nContext, useI18n } from '../i18n';
import { IconAlert } from './Icons';

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      {icon && <div className="state__icon">{icon}</div>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, message, action }: { title?: string; message?: string; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="state" role="alert">
      <div className="state__icon state__icon--danger"><IconAlert /></div>
      <h2>{title ?? t('state.errorTitle')}</h2>
      {message && <p className="small">{message}</p>}
      {action}
    </div>
  );
}

interface EBState { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  static contextType = I18nContext;
  declare context: React.ContextType<typeof I18nContext>;
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    const { t } = this.context;
    if (this.state.error) {
      return (
        <div className="page page--no-tabs">
          <ErrorState
            message={t('state.errorDataSafe', { message: this.state.error.message })}
            action={<button className="btn btn--primary" onClick={() => window.location.reload()}>{t('state.reload')}</button>}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
