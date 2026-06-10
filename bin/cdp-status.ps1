[CmdletBinding()]
param(
  [int[]]$Ports = @(9222, 9223, 9333),

  [switch]$ShowCommandLine
)

$ErrorActionPreference = "SilentlyContinue"

function Get-ProcessSummary([int]$ProcessId) {
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  if (-not $process -and -not $wmi) {
    return $null
  }

  $commandLine = if ($wmi -and $ShowCommandLine) { $wmi.CommandLine } else { $null }

  [pscustomobject]@{
    Id = $ProcessId
    Parent = if ($wmi) { $wmi.ParentProcessId } else { $null }
    Name = if ($process) { $process.ProcessName } else { $wmi.Name }
    WS_MB = if ($process) { [math]::Round($process.WorkingSet64 / 1MB, 1) } else { $null }
    CPU_s = if ($process -and $process.CPU -ne $null) { [math]::Round($process.CPU, 1) } else { $null }
    CommandLine = $commandLine
  }
}

function Get-RemoteDebuggingPort([string]$CommandLine) {
  if ($CommandLine -match "--remote-debugging-port=([0-9]+)") {
    return [int]$Matches[1]
  }
  return $null
}

function Get-UserDataDirLabel([string]$CommandLine) {
  if ($CommandLine -match "--user-data-dir=(?:""([^""]+)""|'([^']+)'|([^ ]+))") {
    $value = @($Matches[1], $Matches[2], $Matches[3]) | Where-Object { $_ } | Select-Object -First 1
    return Split-Path -Leaf $value
  }
  return $null
}

Write-Host "-- CDP listeners and clients --"
$connections = Get-NetTCPConnection -ErrorAction SilentlyContinue |
  Where-Object { $Ports -contains $_.LocalPort -or $Ports -contains $_.RemotePort } |
  Sort-Object LocalPort, RemotePort, State

$connections |
  Select-Object State, LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess,
    @{n = "Process"; e = { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName }} |
  Format-Table -AutoSize

Write-Host "-- Owning/client processes --"
$pids = $connections |
  Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } |
  Select-Object -ExpandProperty OwningProcess -Unique

$summaries = foreach ($processId in $pids) {
  Get-ProcessSummary $processId
}

if ($ShowCommandLine) {
  $summaries |
    Where-Object { $_ } |
    Sort-Object Name, Id |
    Select-Object Id, Parent, Name, WS_MB, CPU_s, CommandLine |
    Format-List
} else {
  $summaries |
    Where-Object { $_ } |
    Sort-Object Name, Id |
    Select-Object Id, Parent, Name, WS_MB, CPU_s |
    Format-List
}

Write-Host "-- Chrome remote debugging roots --"
$roots = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "chrome.exe" -and
    $_.CommandLine -match "remote-debugging-port" -and
    $_.CommandLine -notmatch "--type="
  }

$roots |
  ForEach-Object {
    $rootProcess = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($_.ProcessId)" -ErrorAction SilentlyContinue
    $childIds = $children | Select-Object -ExpandProperty ProcessId
    $childWorkingSet = 0
    foreach ($childId in $childIds) {
      $childProcess = Get-Process -Id $childId -ErrorAction SilentlyContinue
      if ($childProcess) {
        $childWorkingSet += $childProcess.WorkingSet64
      }
    }

    $commandLine = if ($ShowCommandLine) { $_.CommandLine } else { $null }

    [pscustomobject]@{
      Id = $_.ProcessId
      Parent = $_.ParentProcessId
      Name = $_.Name
      Port = Get-RemoteDebuggingPort $_.CommandLine
      Profile = Get-UserDataDirLabel $_.CommandLine
      RootWS_MB = if ($rootProcess) { [math]::Round($rootProcess.WorkingSet64 / 1MB, 1) } else { $null }
      ChildCount = @($children).Count
      ChildWS_MB = [math]::Round($childWorkingSet / 1MB, 1)
      CommandLine = $commandLine
    }
  } |
  Sort-Object Id |
  Format-List
