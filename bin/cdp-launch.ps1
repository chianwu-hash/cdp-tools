$ErrorActionPreference = "Stop"
$cli = Join-Path $PSScriptRoot "..\cli\cdp-launch.js"
& node $cli @args
exit $LASTEXITCODE
