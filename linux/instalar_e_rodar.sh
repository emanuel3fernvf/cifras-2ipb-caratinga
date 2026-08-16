#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

cd "$PROJECT_ROOT"

python_ok() {
  command -v python3 >/dev/null 2>&1 &&
    python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1
}

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v pkexec >/dev/null 2>&1; then
    pkexec "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

install_python() {
  echo "Python 3.10 ou superior não foi encontrado."
  if command -v apt-get >/dev/null 2>&1; then
    echo "Tentando instalar Python pelo apt..."
    run_privileged apt-get update &&
      run_privileged apt-get install -y python3 python3-venv
  elif command -v dnf >/dev/null 2>&1; then
    echo "Tentando instalar Python pelo dnf..."
    run_privileged dnf install -y python3
  elif command -v pacman >/dev/null 2>&1; then
    echo "Tentando instalar Python pelo pacman..."
    run_privileged pacman -Sy --needed --noconfirm python
  else
    return 1
  fi
}

if ! python_ok; then
  install_python || {
    echo "ERRO: instale Python 3.10 ou superior e execute este arquivo novamente." >&2
    exit 1
  }
fi

if ! python_ok; then
  echo "ERRO: a versão disponível do Python é anterior à 3.10." >&2
  exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "Criando ambiente local..."
  if ! python3 -m venv "$VENV_DIR"; then
    echo "Não foi possível criar o ambiente virtual." >&2
    echo "No Ubuntu/Debian, instale o pacote python3-venv." >&2
    exit 1
  fi
fi

echo "Abrindo Cifras 2IPB Caratinga..."
exec "$VENV_DIR/bin/python" "$PROJECT_ROOT/local_app_launcher.py" \
  --root "$PROJECT_ROOT" --port 8000
