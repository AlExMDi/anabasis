import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBack } from './Icons';

export function PageHeader({ title, back, actions }: { title: ReactNode; back?: string | true; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      <div className="page-header__title">
        {back && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Back"
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
          >
            <IconBack />
          </button>
        )}
        {typeof title === 'string' ? <h1>{title}</h1> : title}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
