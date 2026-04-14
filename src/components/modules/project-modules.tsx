'use client';

import { SummaryModule } from './summary-module';
import { PhaseTrackerModule } from './phase-tracker-module';
import { SpecChainModule } from './spec-chain-module';
import { RulesModule } from './rules-module';
import { GameStatsModule } from './game-stats-module';
import { DeploymentModule } from './deployment-module';

interface ModuleData {
  id: string;
  module_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
}

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

interface ProjectModulesProps {
  modules: ModuleData[];
  deployments?: DeploymentRow[];
}

export function ProjectModules({ modules, deployments }: ProjectModulesProps) {
  const hasModules = modules.length > 0;
  const hasDeployments = deployments && deployments.length > 0;

  if (!hasModules && !hasDeployments) return null;

  return (
    <div className="px-4 pt-3 space-y-2">
      <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.07em] mb-1">Context</h2>

      {modules.map((mod) => {
        switch (mod.module_type) {
          case 'summary':
            return <SummaryModule key={mod.id} title={mod.title} body={mod.body} />;

          case 'phase_tracker':
            return (
              <PhaseTrackerModule
                key={mod.id}
                title={mod.title}
                body={mod.body}
                phases={(mod.metadata.phases as { name: string; status: string }[]) || []}
              />
            );

          case 'spec_chain':
            return (
              <SpecChainModule
                key={mod.id}
                title={mod.title}
                body={mod.body}
                specs={(mod.metadata.specs as { id: string; name: string; status: string }[]) || []}
              />
            );

          case 'rules':
            return (
              <RulesModule
                key={mod.id}
                title={mod.title}
                body={mod.body}
                metadata={mod.metadata as { rule_count?: number; categories?: string[]; recent_changes?: string[] }}
              />
            );

          case 'game_stats':
            return (
              <GameStatsModule
                key={mod.id}
                title={mod.title}
                body={mod.body}
                metadata={mod.metadata}
              />
            );

          default:
            // Fallback: generic card
            return (
              <div key={mod.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
                <h3 className="text-[13px] font-semibold text-[var(--text)] mb-1">{mod.title}</h3>
                {mod.body && <p className="text-[12px] text-[var(--text3)]">{mod.body}</p>}
              </div>
            );
        }
      })}

      {hasDeployments && <DeploymentModule deployments={deployments!} />}
    </div>
  );
}
