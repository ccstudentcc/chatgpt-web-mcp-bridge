import { createRoot } from 'react-dom/client';

import { SidepanelSurfaceApp } from '../../src/ui-surfaces/sidepanel-surface-app.js';
import '../../src/ui-surfaces/styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Sidepanel root element missing');
}

createRoot(root).render(<SidepanelSurfaceApp />);
