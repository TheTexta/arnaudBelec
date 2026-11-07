"""Explicit Arnaud-only backup and native restore; never restores production."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--confirm-production-read', action='store_true', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
os.umask(0o077)
out = args.output.resolve()
out.mkdir(mode=0o700, exist_ok=False)
root = Path(__file__).resolve().parents[2]
snapshot = (root / 'deploy/cms/source-snapshot.sql').read_bytes()
legacy = (root / 'supabase/migrations/20261030231725_create_arnaud_blog.sql').read_bytes()
production = 'supabase-db-qvorfovjsiinni7o8azmlluz'
temporary = 'arnaud-cms-restore-' + uuid.uuid4().hex[:16]
ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes', 'dextery@gmkserver.tail077753.ts.net']

def run(name, command, data=None, output=None):
    with (out / (name + '.log')).open('xb') as log:
        r = subprocess.run(ssh + [shlex.join(command)], input=data, stdout=output if output is not None else log, stderr=log, timeout=120)
    if r.returncode:
        raise RuntimeError(name + ' failed; inspect private log (not printed)')
    return (out / (name + '.log')).read_bytes() if output is None else None

def psql(container):
    return ['docker', 'exec', '-i', container, 'psql', '-XqAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']

image = json.loads(run('image', ['docker', 'inspect', '--format', '{{json .Image}}', production]))
before = run('source-before', psql(production), snapshot)
source = json.loads(before)
tables = ['posts', 'revisions', 'publications', 'media', 'publication_media']
with (out / 'arnaud-journal.dump').open('xb') as dump:
    run('backup', ['docker', 'exec', production, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--format=custom', '--data-only', '--lock-wait-timeout=5s'] + [arg for table in tables for arg in ['--table', 'public.arnaud_blog_' + table]], output=dump)
after = run('source-after', psql(production), snapshot)
if before != after:
    raise RuntimeError('Journal changed during backup; keep writing paused and retry into a new directory')
created = False
passed = False
cleanup_errors = []
try:
    created = True
    run('start', ['docker', 'run', '--detach', '--name', temporary, '--label', 'arnaud.cms.restore=' + temporary,
        '--network', 'none', '--memory', '512m', '--cpus', '1', '--user', '105:106',
        '--tmpfs', '/work:rw,size=512m,uid=105,gid=106,mode=0700', '--entrypoint', '/bin/sh', image, '-c',
        'initdb -D /work/db -U supabase_admin --auth=trust && exec postgres -D /work/db -c listen_addresses= -c unix_socket_directories=/work -c shared_preload_libraries='])
    private_psql = ['docker', 'exec', '-i', temporary, 'psql', '-h', '/work', '-XqAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    for attempt in range(30):
        r = subprocess.run(ssh + [shlex.join(['docker', 'exec', temporary, 'pg_isready', '-h', '/work', '-U', 'supabase_admin'])], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        if r.returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('Native isolated database did not start')
    run('schema', private_psql, b'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;\n' + legacy)
    run('restore', ['docker', 'exec', '-i', temporary, 'pg_restore', '-h', '/work', '-U', 'supabase_admin', '-d', 'postgres', '--exit-on-error', '--data-only'], (out / 'arnaud-journal.dump').read_bytes())
    restored = run('restored-snapshot', private_psql, snapshot)
    if restored != before:
        raise RuntimeError('Arnaud full-row restore mismatch')
    passed = True
finally:
    if created:
        try:
            label = run('cleanup-label', ['docker', 'inspect', '--format', '{{index .Config.Labels "arnaud.cms.restore"}}', temporary]).decode().strip()
            if label != temporary:
                raise RuntimeError('Restore container ownership mismatch')
            for name, command in [('logs', ['docker', 'logs', temporary]), ('stop', ['docker', 'stop', '--time', '10', temporary]), ('remove', ['docker', 'rm', temporary])]:
                try:
                    run('cleanup-' + name, command)
                except (RuntimeError, subprocess.TimeoutExpired):
                    cleanup_errors.append(name)
        except (RuntimeError, subprocess.TimeoutExpired):
            cleanup_errors.append('ownership-inspection')
    result = {'scope': 'five Arnaud journal tables only; no Auth credentials or other-site data', 'passed': passed and not cleanup_errors, 'native_image': image, 'counts': {key: len(source[key]) for key in tables}, 'full_rows_sha256': hashlib.sha256(before).hexdigest(), 'backup_sha256': hashlib.sha256((out / 'arnaud-journal.dump').read_bytes()).hexdigest(), 'cleanup_errors': cleanup_errors}
    (out / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
