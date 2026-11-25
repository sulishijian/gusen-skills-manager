// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InstallSkills } from "./InstallSkills";
import { cancelGitPreview, confirmGitInstall, fetchLeaderboard, previewGitInstall, searchSkillssh } from "../lib/tauri";

const mocks = vi.hoisted(() => ({
  translate: (key: string, values?: { name?: string }) => values?.name ? `${key}:${values.name}` : key,
  refreshPresets: vi.fn(),
  refreshManagedSkills: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    managedSkills: [],
    refreshPresets: mocks.refreshPresets,
    refreshManagedSkills: mocks.refreshManagedSkills,
  }),
}));
vi.mock("../lib/tauri", () => ({
  fetchLeaderboard: vi.fn(),
  searchSkillssh: vi.fn(),
  previewGitInstall: vi.fn(),
  cancelGitPreview: vi.fn(),
  confirmGitInstall: vi.fn(),
}));

const repository = "sulishijian/gusen-skills";
const url = `https://github.com/${repository}.git`;
const skill = { rel_path: "wms/wms-inbound-checklist", name: "wms-inbound-checklist", description: null };
const otherSkill = { rel_path: "wms/other-skill", name: "other-skill", description: null };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function clickButton(label: string) {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    !candidate.closest('[aria-hidden="true"]') &&
    (candidate.getAttribute("aria-label") === label || candidate.textContent?.trim() === label)
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

it("loads only the Gusen repository by default and imports the chosen skill", async () => {
  vi.mocked(previewGitInstall)
    .mockResolvedValueOnce({ temp_dir: "browse-checkout", skills: [skill, otherSkill] })
    .mockResolvedValueOnce({ temp_dir: "install-checkout", skills: [otherSkill, skill] });

  await act(async () => root.render(<MemoryRouter><InstallSkills /></MemoryRouter>));
  expect(previewGitInstall).toHaveBeenCalledExactlyOnceWith(url);
  expect(fetchLeaderboard).not.toHaveBeenCalled();
  expect(searchSkillssh).not.toHaveBeenCalled();
  expect(container.textContent).toContain(`@${repository}`);
  expect(container.textContent).not.toContain("install.filters.allSources");
  expect(cancelGitPreview).toHaveBeenCalledExactlyOnceWith("browse-checkout");
  expect(container.querySelector('[placeholder="install.customSource.search"]')).not.toBeNull();

  expect(container.textContent).toContain(skill.name);
  await clickButton(`install.customSource.installSkill:${skill.name}`);
  await clickButton("install.gitPreview.confirm");

  expect(confirmGitInstall).toHaveBeenCalledExactlyOnceWith(url, "install-checkout", [
    { rel_path: skill.rel_path, name: skill.name },
  ]);
  expect(mocks.refreshManagedSkills).toHaveBeenCalledOnce();
});

it("opens a direct Git installation link without loading the repository catalog", async () => {
  await act(async () => root.render(
    <MemoryRouter initialEntries={["/install?tab=git"]}><InstallSkills /></MemoryRouter>
  ));

  expect(container.textContent).toContain("install.gitTitle");
  expect(previewGitInstall).not.toHaveBeenCalled();
});
