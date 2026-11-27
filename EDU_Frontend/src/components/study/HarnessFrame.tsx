import React, { useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '@/config';
import { api } from '@/services/api';
import { authService } from '@/services/auth';

interface HarnessFrameProps {
  lessonId: string;
}

interface HarnessSession {
  url: string;
  expiresAt: string;
}

function validSession(data: unknown): data is HarnessSession {
  if (!data || typeof data !== 'object') return false;
  const { url, expiresAt } = data as Partial<HarnessSession>;
  if (typeof url !== 'string' || typeof expiresAt !== 'string'
    || !url.startsWith('/api/course-harness/proxy/') || /[\\\u0000-\u0020]/.test(url)
    || !(Date.parse(expiresAt) > Date.now())) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/course-harness/proxy/');
  } catch {
    return false;
  }
}

export default function HarnessFrame({ lessonId }: HarnessFrameProps) {
  const { i18n } = useTranslation('lesson');
  const locale = i18n.resolvedLanguage || i18n.language;
  const [attempt, setAttempt] = useState(0);
  return <WorkspaceFrame key={`${lessonId}:${locale}:${attempt}`} lessonId={lessonId} locale={locale} retry={() => setAttempt(value => value + 1)} />;
}

function WorkspaceFrame({ lessonId, locale, retry }: HarnessFrameProps & { locale: string; retry: () => void }) {
  const { t } = useTranslation('lesson');
  const translate = useRef(t);
  translate.current = t;
  const [session, setSession] = useState<HarnessSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = translate.current;
    if (!authService.isLoggedIn()) {
      setError(t('harness.login'));
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setError(t('harness.timeout'));
      controller.abort();
    }, 120_000);

    const prepare = async () => {
      // api.ts 未暴露可取消请求或令牌读取接口，沿用其存储及失效清理规则。
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError(t('harness.login'));
        window.clearTimeout(timeout);
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE_URL.replace(/\/$/, '')}/course-harness/lessons/${encodeURIComponent(lessonId)}/session`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': locale, Accept: 'application/json' },
            signal: controller.signal,
          },
        );
        const result = await response.json().catch(() => null);
        if (!active || controller.signal.aborted) return;
        if (response.status === 401) {
          const message = typeof result?.error === 'string' ? result.error : '';
          if (/无效|过期|invalid|expired/i.test(message) && localStorage.getItem('authToken') === token) api.clearToken();
          setError(t('harness.login'));
        } else if (response.status === 403) {
          setError(t('harness.forbidden'));
        } else if (response.status === 429) {
          setError(t('harness.capacity'));
        } else if (!response.ok || !result?.success) {
          setError(t('harness.failed'));
        } else if (!validSession(result.data)) {
          setError(t('harness.invalidSession'));
        } else {
          setSession(result.data);
        }
      } catch {
        if (active && !controller.signal.aborted) setError(t('harness.failed'));
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void prepare();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [lessonId, locale]);

  useEffect(() => {
    if (!session || loaded || error) return;
    const timeout = window.setTimeout(() => setError(t('harness.frameFailed')), 60_000);
    return () => window.clearTimeout(timeout);
  }, [session, loaded, error, t]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white" aria-label={t('harness.title')}>
      <div className="relative min-h-0 flex-1">
        {session && !error && (
          <iframe
            src={session.url}
            title={t('harness.title')}
            className={`absolute inset-0 h-full w-full border-0 ${loaded ? '' : 'invisible'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(t('harness.frameFailed'))}
          />
        )}
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p role="alert" className="text-sm text-slate-500">{error}</p>
            <Button size="sm" variant="flat" color="primary" startContent={<RefreshCw size={14} />} onPress={retry}>{t('harness.retry')}</Button>
          </div>
        ) : !loaded && (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Spinner size="sm" />
            <p className="text-sm text-slate-500">{t(session ? 'harness.loadingInterface' : 'harness.loading')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
