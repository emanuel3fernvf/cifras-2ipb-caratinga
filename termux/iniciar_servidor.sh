#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PYTHON="${PREFIX:-/data/data/com.termux/files/usr}/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "Python não foi encontrado no Termux. Instale com: pkg install python" >&2
  exit 1
fi

if ! command -v ip >/dev/null 2>&1; then
  echo "A ferramenta de rede não foi encontrada no Termux. Instale com: pkg install iproute2" >&2
  exit 1
fi

if ! "$PYTHON" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "O servidor exige Python 3.10 ou superior." >&2
  exit 1
fi

PORT="${PORT:-8000}"
exec "$PYTHON" "$PROJECT_ROOT/local_editor_server.py" \
  --root "$PROJECT_ROOT" --port "$PORT" --lan "$@"
