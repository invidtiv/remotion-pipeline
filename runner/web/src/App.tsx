// runner/web/src/App.tsx
import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { NewRun } from './pages/NewRun.js';
import { RunDetail } from './pages/RunDetail.js';
import { History } from './pages/History.js';

export const App: React.FC = () => (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
    <header style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Remotion Runner</h1>
      <nav style={{ display: 'flex', gap: 16 }}>
        <Link to="/">New run</Link>
        <Link to="/history">History</Link>
      </nav>
    </header>
    <Routes>
      <Route path="/" element={<NewRun />} />
      <Route path="/history" element={<History />} />
      <Route path="/runs/:id" element={<RunDetail />} />
    </Routes>
  </div>
);
