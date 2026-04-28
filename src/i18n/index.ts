/**
 * i18n 配置 — i18next + react-i18next
 *
 * 支持语言：zh-CN（默认）、en-US、ja-JP
 * 语言选择持久化到 localStorage。
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';

// 从 localStorage 读取用户偏好，无则使用系统语言
function getInitialLanguage(): string {
  const saved = localStorage.getItem('cc-web-ui-language');
  if (saved && ['zh-CN', 'en-US', 'ja-JP'].includes(saved)) return saved;

  const sysLang = navigator.language;
  if (sysLang.startsWith('zh')) return 'zh-CN';
  if (sysLang.startsWith('ja')) return 'ja-JP';
  return 'zh-CN'; // 默认
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
      'ja-JP': { translation: jaJP },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false, // React 已自动转义
    },
    // 缺失 key 时记录到控制台
    saveMissing: true,
    missingKeyHandler: (_lngs, _ns, key) => {
      console.warn(`[i18n] Missing translation key: ${key}`);
    },
  });

// 语言切换时持久化到 localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('cc-web-ui-language', lng);
});

export default i18n;
