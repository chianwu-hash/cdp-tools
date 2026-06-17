[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Name = "chatgpt",

  [int]$Port = 9222,

  [string]$Url = "https://chatgpt.com/",

  [string]$ProfileRoot = "D:\chrome-cdp-profiles",

  [switch]$AllowExtensions,

  [switch]$AllowNonStandardProfileRoot,

  [switch]$NoLaunchIfRunning
)

$ErrorActionPreference = "Stop"
$DefaultProfileRoot = "D:\chrome-cdp-profiles"

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

$resolvedProfileRoot = [System.IO.Path]::GetFullPath($ProfileRoot).TrimEnd("\")
$resolvedDefaultProfileRoot = [System.IO.Path]::GetFullPath($DefaultProfileRoot).TrimEnd("\")
if ($resolvedProfileRoot -ne $resolvedDefaultProfileRoot -and -not $AllowNonStandardProfileRoot) {
  throw "ProfileRoot must stay under $DefaultProfileRoot. Pass -AllowNonStandardProfileRoot only for a reviewed local exception."
}

if (-not (Test-Path -LiteralPath $ProfileRoot)) {
  New-Item -ItemType Directory -Path $ProfileRoot | Out-Null
}

$profilePath = Join-Path $ProfileRoot $profileName
if (-not (Test-Path -LiteralPath $profilePath)) {
  New-Item -ItemType Directory -Path $profilePath | Out-Null
}

# Ensure download.default_directory is set so "Show in folder" works.
$defaultDir = Join-Path $profilePath "Default"
$prefsFile = Join-Path $defaultDir "Preferences"
$downloadsPath = Join-Path $env:USERPROFILE "Downloads"
if (-not (Test-Path -LiteralPath $prefsFile)) {
  New-Item -ItemType Directory -Path $defaultDir -Force | Out-Null
  $prefs = @{ download = @{ default_directory = $downloadsPath; prompt_for_download = $false } } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($prefsFile, $prefs, [System.Text.Encoding]::UTF8)
} else {
  try {
    $prefs = Get-Content $prefsFile -Raw | ConvertFrom-Json
    if (-not $prefs.download -or -not $prefs.download.default_directory) {
      $prefs | Add-Member -MemberType NoteProperty -Name "download" -Value ([PSCustomObject]@{
        default_directory   = $downloadsPath
        prompt_for_download = $false
      }) -Force
      $prefs | ConvertTo-Json -Depth 20 -Compress | Set-Content $prefsFile -Encoding UTF8 -NoNewline
    }
  } catch {
    # Chrome Preferences may be too large for PS 5.1's ConvertFrom-Json; skip silently.
  }
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
