import React from 'react';
import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  const { t } = useTranslation('common');
  return (
  <div className="min-h-screen pt-12 md:pt-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col items-center justify-center">
    <div className="card-surface w-full max-w-2xl rounded-3xl p-12 text-center backdrop-blur-md">
      <div className="w-20 h-20 bg-primary-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary-600 shadow-sm">
        <Layers className="w-10 h-10" /> 
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-4">{title}</h1>
      <p className="text-slate-500 text-lg leading-relaxed">
        {t('placeholder.title')}
        <br />
        {t('placeholder.description')}
      </p>
      <div className="mt-8">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
           {t('comingSoon', { ns: 'uiReview' })}
        </span>
      </div>
    </div>
  </div>
  );
};

export default PlaceholderPage;
