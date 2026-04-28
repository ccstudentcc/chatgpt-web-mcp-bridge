import { createRoot } from 'react-dom/client';

import { ExtensionConsoleApp } from '../../src/ui-surfaces/extension-console-app.js';
import '../../src/ui-surfaces/styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Popup root element missing');
}

createRoot(root).render(<ExtensionConsoleApp surface="popup" />);
