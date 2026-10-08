"""Validate and capture the isolated graphics study on PAL and NTSC MSX1."""
from pathlib import Path
import hashlib, os, re, subprocess
root=Path(__file__).resolve().parents[1]
output=root/'out/art-study'
rom=root/'out/artstudy.rom'
symbols=dict(re.findall(r'^\s+([0-9A-F]{8})\s+_(\w+)\s+artstudy', (root/'out/artstudy.map').read_text(), re.M))
for machine,refresh in [('C-BIOS_MSX1',60),('C-BIOS_MSX1_EU',50)]:
 report=output/f'{machine}-report.txt'
 report.unlink(missing_ok=True)
 env=dict(os.environ,VILLAGE_ART_REPORT=str(report),VILLAGE_ART_OUTPUT=str(output),VILLAGE_ART_MACHINE=machine,VILLAGE_ART_REFRESH=str(refresh))
 for address,name in symbols.items(): env['VILLAGE_ART_VAR_'+name]=str(int(address,16))
 result=subprocess.run([os.environ.get('VILLAGE_OPENMSX','openmsx'),'-setting',str(root/'tests/headless.xml'),'-machine',machine,'-cart',str(rom),'-romtype','ASCII8','-script',str(root/'tests/art-study.tcl')],env=env,capture_output=True,text=True,timeout=60)
 (output/f'{machine}.log').write_text(result.stdout+result.stderr)
 text=report.read_text() if report.exists() else 'FAIL missing report'
 print(machine,text.strip(),flush=True)
 if result.returncode or not text.startswith('PASS ') or 'FAIL' in text: raise SystemExit(1)
(output/'rom-sha256.txt').write_text(hashlib.sha256(rom.read_bytes()).hexdigest()+'  artstudy.rom\n')
