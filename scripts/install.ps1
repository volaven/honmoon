param(
  [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')][string]$Repository,
  [ValidatePattern('^(latest|v?[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?)$')][string]$Version='latest',
  [string]$InstallDir=(Join-Path $env:LOCALAPPDATA 'Programs\HONMOON'),
  [string]$ArchivePath,
  [string]$ManifestPath,
  [switch]$AddToPath
)
$ErrorActionPreference='Stop'
$installRoot=[IO.Path]::GetFullPath($InstallDir)
if ($installRoot -match '[%"\r\n]') { throw 'Unsupported installation path.' }
if (-not $ArchivePath) {
  if (-not $Repository) { throw 'Specify -Repository owner/repository, or local -ArchivePath and -ManifestPath.' }
  $api=if ($Version -eq 'latest') { "https://api.github.com/repos/$Repository/releases/latest" } else { "https://api.github.com/repos/$Repository/releases/tags/$Version" }
  $release=Invoke-RestMethod -Uri $api -Headers @{'User-Agent'='HONMOON-Installer'}
  $temporary=Join-Path ([IO.Path]::GetTempPath()) ('honmoon-install-'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temporary | Out-Null
  $manifestAsset=@($release.assets | Where-Object name -eq 'honmoon-release.json')
  if ($manifestAsset.Count -ne 1) { throw 'Release manifest missing.' }
  $ManifestPath=Join-Path $temporary 'honmoon-release.json'
  Invoke-WebRequest -Uri $manifestAsset[0].browser_download_url -OutFile $ManifestPath
  $manifest=Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  if ($manifest.asset -notmatch '^HONMOON-[0-9A-Za-z.-]+-win-x64\.zip$') { throw 'Invalid asset name.' }
  $asset=@($release.assets | Where-Object name -eq $manifest.asset)
  if ($asset.Count -ne 1) { throw 'Windows package missing.' }
  $ArchivePath=Join-Path $temporary $manifest.asset
  Invoke-WebRequest -Uri $asset[0].browser_download_url -OutFile $ArchivePath
}
if (-not $ManifestPath) { throw '-ManifestPath is required for a local archive.' }
$manifest=Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$') { throw 'Invalid release version.' }
if ($manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid SHA-256.' }
if ((Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Package SHA-256 mismatch. Nothing installed.' }
$destination=[IO.Path]::GetFullPath((Join-Path $installRoot ('versions\'+$manifest.version)))
if (-not $destination.StartsWith($installRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid installation destination.' }
if (Test-Path -LiteralPath $destination) { throw "Version already exists: $destination. Existing installation was not changed." }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($ArchivePath))
try {
  foreach ($entry in $zip.Entries) {
    $target=[IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
    if (-not $target.StartsWith($destination+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive contains an unsafe path.' }
  }
} finally { $zip.Dispose() }
Expand-Archive -LiteralPath $ArchivePath -DestinationPath $destination
$executable=Join-Path $destination 'HONMOON-win32-x64\HONMOON.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Package layout is invalid.' }
$launcher=Join-Path $installRoot 'honmoon.cmd'
$launcherText="@echo off`r`nset ELECTRON_RUN_AS_NODE=`r`nstart `"`" `"$executable`" %*`r`n"
[IO.File]::WriteAllText($launcher,$launcherText,[Text.Encoding]::Default)
if ($AddToPath) {
  $userPath=[Environment]::GetEnvironmentVariable('Path','User')
  if ($installRoot -notin ($userPath -split ';')) { [Environment]::SetEnvironmentVariable('Path',($userPath.TrimEnd(';')+';'+$installRoot),'User') }
}
Write-Output "Installed HONMOON $($manifest.version): $executable"
Write-Output "Launch: $launcher"
if ($AddToPath) { Write-Output 'Open a new terminal and run honmoon.' }
