@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set "APP_NAME=Cifras 2IPB Caratinga"
set "VENV_PYTHON=windows\venv\Scripts\python.exe"
set "VENV_PYTHONW=windows\venv\Scripts\pythonw.exe"

if exist "%VENV_PYTHONW%" (
  "%VENV_PYTHON%" -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>&1
  if not errorlevel 1 goto :iniciar
)

echo === %APP_NAME% ===
echo.
echo Preparando o aplicativo para uso offline...
call :localizar_python
if defined PYTHON_EXE goto :criar_venv

echo Python 3.10 ou superior nao foi encontrado.
echo Tentando instalar Python 3.12 com winget...
where winget >nul 2>&1
if errorlevel 1 goto :python_manual
winget install --id Python.Python.3.12 -e --scope user --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :python_manual

call :localizar_python
if not defined PYTHON_EXE call :localizar_python_instalado
if not defined PYTHON_EXE (
  echo Python foi instalado, mas ainda nao esta disponivel nesta sessao.
  echo Feche esta janela e execute windows\instalar_e_rodar.bat novamente.
  pause
  exit /b 1
)

:criar_venv
if not exist "%VENV_PYTHON%" (
  echo Criando ambiente local...
  "%PYTHON_EXE%" %PYTHON_ARGS% -m venv windows\venv
  if errorlevel 1 (
    echo ERRO: nao foi possivel criar o ambiente Python.
    pause
    exit /b 1
  )
)

"%VENV_PYTHON%" -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>&1
if errorlevel 1 (
  echo ERRO: o aplicativo requer Python 3.10 ou superior.
  pause
  exit /b 1
)

:iniciar
echo Abrindo %APP_NAME%...
start "" "%VENV_PYTHONW%" "local_app_launcher.py" --root "%CD%" --port 8000
if errorlevel 1 (
  echo ERRO: nao foi possivel iniciar o aplicativo.
  pause
  exit /b 1
)
exit /b 0

:localizar_python
set "PYTHON_EXE="
set "PYTHON_ARGS="
py -3 -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>&1
if not errorlevel 1 (
  set "PYTHON_EXE=py"
  set "PYTHON_ARGS=-3"
  exit /b 0
)
python -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>&1
if not errorlevel 1 set "PYTHON_EXE=python"
exit /b 0

:localizar_python_instalado
for /d %%D in ("%LocalAppData%\Programs\Python\Python3*") do (
  if exist "%%~fD\python.exe" set "PYTHON_EXE=%%~fD\python.exe"
)
exit /b 0

:python_manual
echo Nao foi possivel instalar Python automaticamente.
echo Baixe em: https://www.python.org/downloads/windows/
echo Durante a instalacao, marque "Add python.exe to PATH".
echo Depois, execute este arquivo novamente.
start "" "https://www.python.org/downloads/windows/"
pause
exit /b 1
