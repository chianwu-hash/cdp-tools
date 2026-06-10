@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0cdp-status.ps1" %*
