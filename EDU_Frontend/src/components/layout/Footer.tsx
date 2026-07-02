import React from 'react';
import AILogoGif from '@/images/AI logo Foriday.gif';
import { useTranslation } from 'react-i18next';

const Footer: React.FC = () => {
  const { t } = useTranslation('footer');
  return (
    <footer className="relative z-10 border-t border-default-200/50 bg-white/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <img src={AILogoGif} alt="Agent EDU" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg text-slate-800">Agent EDU Lab</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <a href="#" className="hover:text-primary-600 transition-colors">{t('about')}</a>
            <a href="#" className="hover:text-primary-600 transition-colors">{t('contact')}</a>
            <a href="#" className="hover:text-primary-600 transition-colors">{t('privacy')}</a>
            <a href="#" className="hover:text-primary-600 transition-colors">{t('terms')}</a>
          </div>

          {/* Copyright */}
          <div className="text-sm text-slate-400">
            © 2026 Agent EDU Lab. {t('rightsReserved', { ns: 'uiReview' })}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
