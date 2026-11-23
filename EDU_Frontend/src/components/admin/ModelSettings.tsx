import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FlaskConical, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { PageDialog } from '@/components/common/PageDialog';
import { adminSettingsService, type ModelSettings as ModelConfig, type ModelSettingsInput } from '@/services/adminSettings';

const presets = [
  { id: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { id: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com' },
  { id: 'minimax', label: 'MiniMax', url: 'https://api.minimax.io/v1' },
  { id: 'glm', label: 'GLM', url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'qwen', label: 'Qwen', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'custom', label: '', url: '' },
];
const initial: ModelSettingsInput = { provider: 'openai', baseUrl: presets[0].url, model: '', apiKey: '', version: 0 };
const fieldClass = 'w-full min-w-0 rounded-lg border border-default-200 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary-500 disabled:opacity-60';

export default function ModelSettings() {
  const { t, i18n } = useTranslation('modelSettings');
  const [saved, setSaved] = useState<ModelConfig | null>(null);
  const [form, setForm] = useState<ModelSettingsInput>(initial);
  const [busy, setBusy] = useState<'load' | 'save' | 'test' | 'clear' | null>('load');
  const [failure, setFailure] = useState<{ code?: string; error?: string } | null>(null);
  const [notice, setNotice] = useState<'saved' | 'cleared' | ''>('');
  const [tested, setTested] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const mounted = useRef(true);

  const apply = (value: ModelConfig) => {
    setSaved(value);
    setForm({ provider: value.provider, baseUrl: value.baseUrl, model: value.model, apiKey: '', version: value.version });
  };
  const load = async () => {
    setBusy('load'); setFailure(null); setNotice(''); setTested(null);
    const response = await adminSettingsService.getModelSettings();
    if (!mounted.current) return;
    if (response.success && response.data) apply(response.data);
    else setFailure({ code: response.code, error: response.error });
    setBusy(null);
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, []);

  const change = (patch: Partial<ModelSettingsInput>) => {
    setForm((old) => ({ ...old, ...patch })); setTested(null); setNotice(''); setFailure(null);
  };
  const sameService = saved?.provider === form.provider && saved?.baseUrl.replace(/\/+$/, '') === form.baseUrl.trim().replace(/\/+$/, '');
  const canRetainKey = sameService && saved?.configured;
  const valid = form.model.trim() && form.baseUrl.trim() && (form.apiKey.trim() || canRetainKey);
  const dirty = !!saved && (form.provider !== saved.provider || form.baseUrl !== saved.baseUrl || form.model !== saved.model || !!form.apiKey);

  const run = async (action: 'save' | 'test' | 'clear') => {
    if (!saved || busy) return;
    setBusy(action); setFailure(null); setNotice(''); setTested(null);
    const input = action === 'clear'
      ? { provider: saved.provider, baseUrl: saved.baseUrl, model: saved.model, version: saved.version, apiKey: '', clearKey: true }
      : form;
    if (action === 'test') {
      const response = await adminSettingsService.testModelSettings(input);
      if (!mounted.current) return;
      if (response.success && response.data) setTested(response.data.latencyMs);
      else setFailure({ code: response.code, error: response.error });
    } else {
      const response = await adminSettingsService.saveModelSettings(input);
      if (!mounted.current) return;
      if (response.success && response.data) { apply(response.data); setNotice(action === 'clear' ? 'cleared' : 'saved'); setConfirmClear(false); }
      else { setFailure({ code: response.code, error: response.error }); setConfirmClear(false); }
    }
    setBusy(null);
  };

  return (
    <section className="py-4" aria-labelledby="model-settings-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 id="model-settings-heading" className="text-lg font-bold text-foreground">{t('title')}</h3>
        <button type="button" title={dirty ? t('discard') : t('refresh')} disabled={!!busy} onClick={() => void load()} className="inline-flex items-center gap-2 text-sm text-default-600 disabled:opacity-50">
          <RefreshCw size={16} className={busy === 'load' ? 'animate-spin' : ''} />{dirty ? t('discard') : t('refresh')}
        </button>
      </div>
      {failure && <p role="alert" className="mb-4 text-sm text-danger-600">{failure.code && i18n.exists(`modelSettings:errors.${failure.code}`) ? t(`errors.${failure.code}`) : failure.error || t('failed')}</p>}
      {busy === 'load' && !saved && <div aria-label={t('loading')} className="h-48 animate-pulse rounded-lg bg-default-100" />}
      {saved && (
        <form onSubmit={(event) => { event.preventDefault(); if (valid) void run('save'); }} className="max-w-4xl">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-md px-2 py-1 ${saved.configured ? 'bg-success-50 text-success-700' : 'bg-default-100 text-default-600'}`}>{t(saved.configured ? 'configured' : 'notConfigured')}</span>
            <span className="text-default-500">{t(`source.${saved.source}`)}</span>
            {dirty && <span className="text-warning-700">{t('unsaved')}</span>}
          </div>
          <fieldset disabled={!!busy} className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-sm font-medium">{t('provider')}
              <select value={form.provider} onChange={(e) => { const preset = presets.find((p) => p.id === e.target.value)!; change({ provider: preset.id, baseUrl: preset.url, model: '', apiKey: '' }); }} className={fieldClass}>
                {presets.map((p) => <option key={p.id} value={p.id}>{p.label || t('custom')}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium">{t('model')}
              <input required maxLength={200} value={form.model} onChange={(e) => change({ model: e.target.value })} autoComplete="off" spellCheck={false} className={fieldClass} />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium md:col-span-2">{t('baseUrl')}
              <input type="url" required maxLength={2048} value={form.baseUrl} onChange={(e) => change({ baseUrl: e.target.value })} placeholder="https://api.example.com/v1" autoComplete="off" spellCheck={false} className={fieldClass} />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium md:col-span-2">{t('apiKey')}
              <input type="password" maxLength={8192} value={form.apiKey} onChange={(e) => change({ apiKey: e.target.value })} placeholder={canRetainKey ? t('retainKey') : t('enterKey')} autoComplete="new-password" spellCheck={false} className={fieldClass} />
            </label>
          </fieldset>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!!busy || !valid || !dirty && saved.source === 'managed'} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{t('save')}
            </button>
            <button type="button" disabled={!!busy || !valid} onClick={() => void run('test')} className="inline-flex items-center gap-2 rounded-lg border border-default-200 px-4 py-2.5 text-sm disabled:opacity-50">
              {busy === 'test' ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}{t('test')}
            </button>
            <button type="button" disabled={!!busy || !saved.configured} onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-danger disabled:opacity-50">
              <Trash2 size={16} />{t('clear')}
            </button>
          </div>
          <div aria-live="polite" className="mt-3 min-h-6 text-sm text-success-700">
            {(notice || tested !== null) && <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} />{notice ? t(notice) : t('tested', { ms: tested })}</span>}
          </div>
        </form>
      )}
      <PageDialog isOpen={confirmClear} onClose={() => { if (!busy) setConfirmClear(false); }} panelClassName="max-w-md">
        <div className="p-6">
          <h4 className="text-lg font-semibold">{t('clear')}</h4>
          <p className="mt-3 text-sm text-default-600">{t('clearConfirm')}</p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" disabled={!!busy} onClick={() => setConfirmClear(false)} className="rounded-lg px-4 py-2 text-sm">{t('cancel')}</button>
            <button type="button" disabled={!!busy} onClick={() => void run('clear')} className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm text-white disabled:opacity-50">{busy === 'clear' && <Loader2 size={16} className="animate-spin" />}{t('clear')}</button>
          </div>
        </div>
      </PageDialog>
    </section>
  );
}
