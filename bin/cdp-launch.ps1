[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Name = "chatgpt",

  [int]$Port = 9222,

  [string]$Url = "https://chatgpt.com/",

  [string]$ProfileRoot = "D:\chrome-cdp-profiles",

  [switch]$AllowExtensions,

  [switch]$NoLaunchIfRunning
)

$ErrorActionPreference = "Stop"

function Find-Chrome {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  throw "Chrome executable was not found."
}

function Get-ListeningProcessOnPort([int]$Port) {
  Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq "127.0.0.1" -and $_.LocalPort -eq $Port } |
    Select-Object -First 1
}

$profileName = ($Name -replace "[^a-zA-Z0-9._-]", "-").Trim("-")
if (-not $profileName) {
  throw "Profile name cannot be empty."
}

if (-not (Test-Path -LiteralPath $ProfileRoot)) {
  New-Item -ItemType Directory -Path $ProfileRoot | Out-Null
}

$profilePath = Join-Path $ProfileRoot $profileName
if (-not (Test-Path -LiteralPath $profilePath)) {
  New-Item -ItemType Directory -Path $profilePath | Out-Null
}

$listener = Get-ListeningProcessOnPort $Port
if ($listener) {
  $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  $message = "CDP port $Port is already listening"
  if ($process) {
    $message += " in process $($process.ProcessName) [$($process.Id)]"
  }
  Write-Host $message
  if ($NoLaunchIfRunning) {
    exit 0
  }
  throw "Refusing to launch another Chrome on the same CDP port."
}

$chrome = Find-Chrome
$args = @(
  "--remote-debugging-port=$Port",
  "--remote-debugging-address=127.0.0.1",
  "--user-data-dir=$profilePath",
  "--no-first-run",
  "--new-window",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows"
)

if (-not $AllowExtensions) {
  $args += "--disable-extensions"
}

$args += $Url

Start-Process -FilePath $chrome -ArgumentList $args | Out-Null
Write-Host "Launched Chrome CDP"
Write-Host "  Name: $Name"
Write-Host "  URL:  $Url"
Write-Host "  CDP:  http://127.0.0.1:$Port"
Write-Host "  Dir:  $profilePath"
