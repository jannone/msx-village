import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function ensureDependency(name) {
  const dependency = JSON.parse(readFileSync(resolve(root, 'dependencies.json'), 'utf8'))[name];
  const path = resolve(root, dependency.path);
  mkdirSync(dirname(path), { recursive:true });
  const fresh = !existsSync(resolve(path,'.git'));
  if (fresh) execFileSync('git',['clone','--no-checkout',dependency.repository,path],{stdio:'inherit'});
  const git = args => execFileSync('git',['-C',path,...args],{encoding:'utf8'}).trim();
  try { git(['cat-file','-e',dependency.commit]); } catch { git(['fetch','origin',dependency.commit]); }
  if (fresh || git(['rev-parse','HEAD']) !== dependency.commit) git(['checkout','--detach',dependency.commit]);
  return path;
}
