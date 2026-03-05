import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import QuickSearchPanel from './components/QuickSearchPanel';
import * as serviceWorker from './serviceWorker';

const params = new URLSearchParams(window.location.search);
const view = params.get('view');

ReactDOM.render(
  <React.StrictMode>
    {view === 'search' ? <QuickSearchPanel /> : <App />}
  </React.StrictMode>,
  document.getElementById('root')
);

serviceWorker.unregister();
