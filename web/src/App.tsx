import { useEffect, useState } from 'react';
import { Chemistry } from './views/Chemistry';
import { Hits } from './views/Hits';
import { Overview } from './views/Overview';
import { Replicates } from './views/Replicates';

const TABS = [
  { id: 'overview', label: 'Overview', view: Overview },
  { id: 'hits', label: 'Hits', view: Hits },
  { id: 'chemistry', label: 'Chemistry', view: Chemistry },
  { id: 'replicates', label: 'Replicates', view: Replicates },
] as const;
type TabId = (typeof TABS)[number]['id'];

const fromHash = (): TabId => {
  const h = typeof location !== 'undefined' ? location.hash.slice(1) : '';
  return (TABS.find((t) => t.id === h)?.id ?? 'overview') as TabId;
};

export default function App() {
  const [tab, setTab] = useState<TabId>(fromHash);
  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const View = TABS.find((t) => t.id === tab)!.view;
  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">DEL</span>
            <div>
              <p className="brand-name">DEL Hit Explorer</p>
              <p className="brand-sub">From FASTQ reads to ranked hits</p>
            </div>
          </div>
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <a key={t.id} href={`#${t.id}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</a>
            ))}
          </nav>
        </div>
      </header>
      <main className="page">
        <View />
      </main>
      <footer className="footer">
        Synthetic DNA encoded library screen with a known planted signal. Pipeline in Python; app in React and TypeScript.{' '}
        <a href="https://github.com/prasad0411/del-hit-explorer">Source on GitHub</a>
      </footer>
    </div>
  );
}
