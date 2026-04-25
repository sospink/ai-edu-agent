import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { adminRbacApi, type RBACPoliciesPayload } from '@/services/adminRbac';

const RBACPoliciesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<RBACPoliciesPayload | null>(null);

  const load = async () => {
    setLoading(true);
    const response = await adminRbacApi.getPolicies();
    setPayload(response.success ? response.data || null : null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">权限矩阵</h2>
          <p className="mt-1 text-sm text-default-500">只读展示当前 Casbin 角色继承与路由策略</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-default-200 bg-white px-4 py-2 text-sm font-medium text-default-600 transition hover:bg-default-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card-surface rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">角色继承</h3>
              <p className="text-xs text-default-500">当前生效的继承关系</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {payload?.inheritance.map(item => (
              <div key={`${item.from}-${item.to}`} className="card-surface-muted rounded-lg px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{item.from}</span>
                <span className="mx-2 text-default-400">→</span>
                <span className="text-default-600">{item.to}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 text-xs text-default-400">策略文件：{payload?.policyPath || '—'}</div>
        </div>

        <div className="card-surface rounded-xl">
          <div className="border-b border-default-200 px-5 py-4">
            <h3 className="font-semibold text-foreground">路由策略</h3>
            <p className="mt-1 text-xs text-default-500">按角色、对象路径和 HTTP 方法展示</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-default-500">
                  <th className="px-5 py-3 font-medium">角色</th>
                  <th className="px-5 py-3 font-medium">路径</th>
                  <th className="px-5 py-3 font-medium">方法</th>
                </tr>
              </thead>
              <tbody>
                {payload?.policies.map((item, index) => (
                  <tr key={`${item.role}-${item.object}-${index}`} className="border-t border-default-100">
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{item.role}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-foreground">{item.object}</td>
                    <td className="px-5 py-4 text-default-600">{item.action}</td>
                  </tr>
                ))}
                {!loading && !payload?.policies.length && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-default-400">暂无权限策略数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RBACPoliciesPage;
