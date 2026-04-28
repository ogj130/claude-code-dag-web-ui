import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/themes.css';
// V3.0.0: i18n 初始化（必须在 App 之前导入）
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
