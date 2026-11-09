import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';
import zhNotifications from './locales/zh/notifications.json';
import enNotifications from './locales/en/notifications.json';
import zhImportCsv from './locales/zh/importCsv.json';
import enImportCsv from './locales/en/importCsv.json';
import zhFeedback from './locales/zh/feedback.json';
import enFeedback from './locales/en/feedback.json';
import zhSettings from './locales/zh/settings.json';
import enSettings from './locales/en/settings.json';
import zhConfig from './locales/zh/config.json';
import enConfig from './locales/en/config.json';
import zhContent from './locales/zh/content.json';
import enContent from './locales/en/content.json';
import zhTeam from './locales/zh/team.json';
import zhDetail from './locales/zh/detail.json';
import enTeam from './locales/en/team.json';
import enDetail from './locales/en/detail.json';

i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: zh,
      notifications: zhNotifications,
      importCsv: zhImportCsv,
      feedback: zhFeedback,
      settings: zhSettings,
      config: zhConfig,
      content: zhContent,
      team: zhTeam,
      detail: zhDetail,
    },
    en: {
      translation: en,
      notifications: enNotifications,
      importCsv: enImportCsv,
      feedback: enFeedback,
      settings: enSettings,
      config: enConfig,
      content: enContent,
      team: enTeam,
      detail: enDetail,
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
