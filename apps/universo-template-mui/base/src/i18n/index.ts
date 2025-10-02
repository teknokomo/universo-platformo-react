import type { i18n as I18nextInstance } from 'i18next';
import enFlowListTranslation from './locales/en/flowList.json';
import ruFlowListTranslation from './locales/ru/flowList.json';
import enMenuTranslation from './locales/en/menu.json';
import ruMenuTranslation from './locales/ru/menu.json';
import uiI18n from '@ui/i18n';

export const templateMuiTranslations = {
  en: {
    flowList: enFlowListTranslation.flowList ?? enFlowListTranslation,
    menu: enMenuTranslation.menu ?? enMenuTranslation
  },
  ru: {
    flowList: ruFlowListTranslation.flowList ?? ruFlowListTranslation,
    menu: ruMenuTranslation.menu ?? ruMenuTranslation
  }
};

export function getTemplateMuiTranslations(language: string) {
  const normalized = language?.slice(0, 2).toLowerCase();
  return templateMuiTranslations[normalized as 'en' | 'ru']?.flowList ?? templateMuiTranslations.en.flowList;
}

export function registerTemplateMuiTranslations(instance?: I18nextInstance | null) {
  const i18nextInstance = instance ?? uiI18n;
  if (!i18nextInstance?.addResourceBundle) {
    return;
  }

  (Object.entries(templateMuiTranslations) as Array<[string, Record<string, Record<string, any>>]>).forEach(
    ([language, namespaces]) => {
      Object.entries(namespaces).forEach(([namespace, resources]) => {
        if (resources) {
          i18nextInstance.addResourceBundle(language, namespace, resources, true, true);
        }
      });
    }
  );
}

if (uiI18n) {
  if (uiI18n.isInitialized) {
    registerTemplateMuiTranslations(uiI18n);
  } else {
    uiI18n.on('initialized', () => registerTemplateMuiTranslations(uiI18n));
  }
}

export default templateMuiTranslations;
