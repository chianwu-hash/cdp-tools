$ErrorActionPreference = "Stop"
$cli = Join-Path $PSScriptRoot "..\cli\cdp-status.js"
& node $cli @args
exit $LASTEXITCODE
