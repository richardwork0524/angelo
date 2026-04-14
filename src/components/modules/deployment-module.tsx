'use client';

import { timeAgo } from '@/lib/constants';

interface DeploymentRow {
  id: string;
  project_key: string;
  module_code: string | null;
  module_slug: string | null;
  git_repo: string | null;
  vercel_project: string | null;
  custom_domain: string | null;
  last_deploy: string | null;
}

interface DeploymentModuleProps {
  deployments: DeploymentRow[];
}

export function DeploymentModule({ deployments }: DeploymentModuleProps) {
  if (!deployments || deployments.length === 0) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
      <h3 className="text-[13px] font-semibold text-[var(--text)] mb-3">Deployments</h3>

      <div className="space-y-2">
        {deployments.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between py-2 px-3 rounded-[var(--r-sm)] bg-[var(--card2)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {d.module_code && (
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-dim)] px-1.5 py-0.5 rounded shrink-0">
                    {d.module_code}
                  </span>
                )}
                <span className="text-[13px] text-[var(--text)] font-medium truncate">
                  {d.module_slug || d.git_repo?.split('/').pop() || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {d.custom_domain && (
                  <span className="text-[11px] text-[var(--green)]">{d.custom_domain}</span>
                )}
                {d.git_repo && (
                  <span className="text-[11px] text-[var(--text3)] truncate">{d.git_repo}</span>
                )}
              </div>
            </div>
            {d.last_deploy && (
              <span className="text-[11px] text-[var(--text3)] shrink-0 ml-2">
                {timeAgo(d.last_deploy)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
