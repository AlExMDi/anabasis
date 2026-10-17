import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { IconBack } from './Icons';

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: string | true; actions?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <header className="page-header">
      <div className="page-header__title">
        {back && (
          <button type="button" className="icon-btn" aria-label={t('common.back')} onClick={() => (back === true ? navigate(-1) : navigate(back))}>
            <IconBack />
          </button>
        )}
        <div className="page-header__text">
          {typeof title === 'string' ? <h1>{title}</h1> : title}
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
