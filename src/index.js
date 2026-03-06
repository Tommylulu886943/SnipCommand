import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import QuickSearchPanel from './components/QuickSearchPanel';
import QuickAddPanel from './components/QuickAddPanel';
import * as serviceWorker from './serviceWorker';

const params = new URLSearchParams(window.location.search);
const view = params.get('view');

function RootView() {
  if (view === 'search') return <QuickSearchPanel />;
  if (view === 'quickadd') return <QuickAddPanel />;
  return <App />;
}

ReactDOM.render(
  <React.StrictMode>
    <RootView />
  </React.StrictMode>,
  document.getElementById('root')
);

serviceWorker.unregister();
