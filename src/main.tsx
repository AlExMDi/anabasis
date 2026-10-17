import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles/app.css';

// HashRouter: GitHub Pages has no SPA rewrites, and hash URLs keep deep links
// working inside the installed PWA without a 404.html redirect hack.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
