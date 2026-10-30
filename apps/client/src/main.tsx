import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RenderDemo } from './scene/demoEntry';

createRoot(document.getElementById('root')!).render(location.search.includes('demo=render') ? <RenderDemo /> : <App />);
