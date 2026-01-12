
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

window.addEventListener('error', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.style.background = '#fff';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.zIndex = '9999';
  errorDiv.innerText = `Global Error: ${event.message}\n${event.error?.stack}`;
  document.body.appendChild(errorDiv);
});

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err: any) {
  rootElement.innerHTML = `<div style="color:red;padding:20px;">
    <h1>Render Error</h1>
    <pre>${err.message}\n${err.stack}</pre>
  </div>`;
  console.error("Render failed:", err);
}
