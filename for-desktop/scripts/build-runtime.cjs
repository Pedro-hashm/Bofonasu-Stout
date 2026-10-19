/* eslint-disable @typescript-eslint/no-var-requires -- Standalone build bootstrap. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

// Lingui needs >=22.19; cross-zip still relies on APIs removed in Node 25.
module.exports = async function buildRuntime() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if ((major === 22 && minor >= 19) || major === 24) return process.execPath;
  const version = "22.23.3";
  const name = `node-v${version}-win-${process.arch}`;
  const cache = path.resolve(__dirname, "../../tooling/node-runtime");
  const executable = path.join(cache, name, "node.exe");
  if (fs.existsSync(executable)) return executable;
  if (!["x64", "arm64"].includes(process.arch))
    throw new Error("Arquitetura sem runtime de build compatível.");
  fs.mkdirSync(cache, { recursive: true });
  const base = `https://nodejs.org/dist/v${version}/`;
  const filename = `${name}.zip`;
  console.log(`Preparando Node ${version} para o build em ${cache}…`);
  const responses = await Promise.all([
    fetch(`${base}SHASUMS256.txt`, { signal: AbortSignal.timeout(120000) }),
    fetch(`${base}${filename}`, { signal: AbortSignal.timeout(120000) }),
  ]);
  if (responses.some((response) => !response.ok))
    throw new Error("Não foi possível baixar o runtime oficial do Node.");
  const expected = (await responses[0].text())
    .split("\n")
    .find((line) => line.trim().endsWith(`  ${filename}`))
    ?.split(/\s+/)[0];
  const archive = Buffer.from(await responses[1].arrayBuffer());
  const actual = crypto.createHash("sha256").update(archive).digest("hex");
  if (!expected || expected !== actual)
    throw new Error("O download do Node não corresponde ao SHA-256 oficial.");
  const archivePath = path.join(cache, filename);
  fs.writeFileSync(archivePath, archive);
  execFileSync(
    path.join(process.env.SystemRoot, "System32", "tar.exe"),
    ["-xf", archivePath, "-C", cache],
    { windowsHide: true },
  );
  if (!fs.existsSync(executable))
    throw new Error("O runtime de build não foi extraído corretamente.");
  return executable;
};
