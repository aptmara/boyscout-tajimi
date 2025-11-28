@echo off
setlocal
cd /d "%~dp0"

set "PWSH_EXE="
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" (
    set "PWSH_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
) else (
    for %%I in (pwsh.exe) do (
        if not defined PWSH_EXE set "PWSH_EXE=%%~$PATH:I"
    )
)

if not defined PWSH_EXE (
    echo PowerShell 7 (pwsh.exe) が見つかりません。https://aka.ms/PSWindows からインストールしてください。
    pause
    exit /b 1
)

set COMMIT_AND_PUSH_KEEP_OPEN=1
start "" cmd /k "\"%PWSH_EXE%\" -ExecutionPolicy Bypass -NoProfile -STA -File \"%~dp0tools\\commit-and-push.ps1\" ^& echo. ^& echo 終了コード: %%ERRORLEVEL%% ^& echo ログを確認したらこのウィンドウを閉じてください。 ^& pause"
exit /b 0
