from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, os, subprocess, sys
root=Path(__file__).resolve().parents[1]
fixture=sys.argv[1] if len(sys.argv)>1 else 'startup'
if fixture not in ('startup','interaction'): raise SystemExit('Unknown test fixture')
output=root/'out/tests';output.mkdir(parents=True,exist_ok=True)

def check(case):
 machine,kind,slot=case
 rom=root/f'out/village-{kind}.rom';report=output/f'{machine}-{kind}-{fixture}.txt'
 report.unlink(missing_ok=True)
 env=dict(os.environ,VILLAGE_REPORT=str(report),VILLAGE_OWN_SLOT=str(slot))
 executable=os.environ.get('VILLAGE_OPENMSX','openmsx')
 proc=subprocess.run([executable,'-setting',str(root/'tests/headless.xml'),'-machine',machine,'-cart',str(rom),'-romtype','ASCII8','-script',str(root/f'tests/{fixture}.tcl')],env=env,capture_output=True,text=True,timeout=90)
 (output/f'{machine}-{kind}-{fixture}.log').write_text(proc.stdout+proc.stderr)
 result=report.read_text() if report.exists() else 'FAIL missing report'
 print(machine,kind,result.strip(),hashlib.sha256(rom.read_bytes()).hexdigest(),flush=True)
 return not proc.returncode and result.startswith('PASS ') and 'FAIL' not in result
cases=[(machine,kind,slot) for machine in ['C-BIOS_MSX1','C-BIOS_MSX1_EU'] for kind,slot in [('demo',40),('visitor',255)]]
if os.environ.get('VILLAGE_TEST_CASE'): cases=[case for case in cases if f'{case[0]}-{case[1]}'==os.environ['VILLAGE_TEST_CASE']]
with ThreadPoolExecutor(max_workers=4) as pool:
 passed=list(pool.map(check,cases))
if not all(passed): raise SystemExit(1)
