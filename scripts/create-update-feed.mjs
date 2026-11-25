import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const [installer] = process.argv.slice(2);
const name = installer && basename(installer);
const version = name && /^skills-manager_(\d+\.\d+\.\d+)_x64-setup\.exe$/.exec(name)?.[1];

if (!version) {
  throw new Error("Pass a signed skills-manager_<version>_x64-setup.exe");
}

if (!(await stat(installer)).isFile()) {
  throw new Error(`Installer is not a file: ${installer}`);
}

const signature = (await readFile(`${installer}.sig`, "utf8")).trim();
if (!signature) {
  throw new Error(`Installer signature is empty: ${installer}.sig`);
}

const feed = {
  version,
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/sulishijian/gusen-skills-manager/releases/download/v${version}/${name}`,
    },
  },
};

const output = join(dirname(installer), "latest.json");
await writeFile(output, `${JSON.stringify(feed, null, 2)}\n`);
console.log(output);
