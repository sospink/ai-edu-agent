import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

export const marketingText = (key: string): string => i18n.t(`marketing:${key}`);

export const useMarketingText = () => {
  const { t } = useTranslation('marketing');
  return (key: string) => t(key);
};
