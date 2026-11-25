import { useEffect, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { getErrorMessage } from "../lib/error";
import { normalizeSkillSearch, skillSearchMatches } from "../lib/skillSearch";
import { getSkillSourceInfo } from "../lib/skillSource";
import { cancelGitPreview, previewGitInstall, type GitSkillPreview } from "../lib/tauri";
import { StatusBanner } from "./StatusBanner";

interface GitSkillSourceProps {
  repository: string;
  query: string;
  installBusy: boolean;
  onInstall: (repoUrl: string, relPath: string) => void;
}

export function GitSkillSource({ repository, query, installBusy, onInstall }: GitSkillSourceProps) {
  const { t } = useTranslation();
  const { managedSkills } = useApp();
  const repositoryUrl = `https://github.com/${repository}`;
  const repoUrl = `${repositoryUrl}.git`;
  const [catalog, setCatalog] = useState<{ skills: GitSkillPreview[] } | { error: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let stale = false;

    async function loadCatalog() {
      try {
        const preview = await previewGitInstall(repoUrl);
        await cancelGitPreview(preview.temp_dir);
        if (!stale) setCatalog({ skills: preview.skills });
      } catch (error: unknown) {
        if (!stale) setCatalog({ error: getErrorMessage(error, t("common.error")) });
      }
    }

    void loadCatalog();
    return () => { stale = true; };
  }, [repoUrl, reloadKey, t]);

  if (!catalog) {
    return (
      <div role="status" className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  if ("error" in catalog) {
    return (
      <StatusBanner
        compact
        title={t("common.requestFailed")}
        description={catalog.error}
        actionLabel={t("common.retry")}
        onAction={() => {
          setCatalog(null);
          setReloadKey((key) => key + 1);
        }}
        tone="danger"
      />
    );
  }

  const normalizedQuery = normalizeSkillSearch(query);
  const skills = catalog.skills.filter((skill) =>
    skillSearchMatches(normalizedQuery, [skill.name, skill.description, skill.rel_path])
  );
  const installedPaths = new Set(
    managedSkills
      .filter((skill) => getSkillSourceInfo(skill).key === `repo:github.com/${repository.toLowerCase()}`)
      .map((skill) => skill.source_subpath?.replace(/\\/g, "/"))
  );

  return (
    <div className="space-y-2.5 pb-8">
      {skills.length === 0 ? (
        <p className="app-panel px-6 py-14 text-center text-[13px] text-muted">
          {t(normalizedQuery ? "install.customSource.noMatches" : "install.gitPreview.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {skills.map((skill) => {
            const installed = installedPaths.has(`skills/${skill.rel_path}`) ||
              installedPaths.has(skill.rel_path);
            const installLabel = t("install.customSource.installSkill", { name: skill.name });

            return (
              <div key={skill.rel_path} className="app-panel flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words text-[13px] font-semibold text-secondary">{skill.name}</h3>
                  {installed ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("install.installed")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onInstall(repoUrl, skill.rel_path)}
                      disabled={installBusy}
                      title={installLabel}
                      aria-label={installLabel}
                      className="shrink-0 rounded-md border border-accent-border bg-accent-dark p-1 text-white transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {skill.description && <p className="text-[13px] leading-5 text-muted">{skill.description}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
