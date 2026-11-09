import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';
import zhNotifications from './locales/zh/notifications.json';
import enNotifications from './locales/en/notifications.json';
import zhImportCsv from './locales/zh/importCsv.json';
import enImportCsv from './locales/en/importCsv.json';

i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: zh,
      notifications: zhNotifications,
      importCsv: zhImportCsv,
    },
    en: {
      translation: en,
      notifications: enNotifications,
      importCsv: enImportCsv,
    },
  },
  ns: ['translation'],
  lng: localStorage.getItem('lang') || 'zh',
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

const applyHtmlLang = (language: string) => {
  document.documentElement.lang = language.startsWith('en') ? 'en' : 'zh-CN';
};

applyHtmlLang(i18n.language);
i18n.on('languageChanged', applyHtmlLang);

export default i18n;
