Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path -Parent $PSScriptRoot
Push-Location $mobileRoot
try {
  flutter build apk `
    --release `
    --split-per-abi `
    --obfuscate `
    --split-debug-info=build/symbols

  $versionLine = Select-String -Path "pubspec.yaml" -Pattern "^version:" | Select-Object -First 1
  $version = ($versionLine.Line -replace "^version:\s*", "" -replace "\+.*$", "")
  $releaseDir = Join-Path $mobileRoot "build/release"
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

  $phoneApk = Join-Path $mobileRoot "build/app/outputs/flutter-apk/app-arm64-v8a-release.apk"
  $versionedApk = Join-Path $releaseDir "Healthezee-v$version.apk"
  Copy-Item -LiteralPath $phoneApk -Destination $versionedApk -Force
  Write-Host "Versioned phone APK: $versionedApk"
} finally {
  Pop-Location
}
