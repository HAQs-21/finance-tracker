param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidHome = $env:ANDROID_HOME,
    [switch]$SkipWebBuild,
    [switch]$DebugBuild
)

$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $workspace

if (-not $JavaHome) {
    $candidate = 'C:\Program Files\Java\jdk-21.0.11'
    if (Test-Path -LiteralPath (Join-Path $candidate 'bin\java.exe')) { $JavaHome = $candidate }
}
if (-not $AndroidHome) {
    $candidate = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (Test-Path -LiteralPath $candidate) { $AndroidHome = $candidate }
}
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) {
    throw 'Java 21 is required. Set JAVA_HOME or pass -JavaHome with your JDK directory.'
}
if (-not $AndroidHome -or -not (Test-Path -LiteralPath $AndroidHome)) {
    throw 'An Android SDK is required. Set ANDROID_HOME or pass -AndroidHome.'
}
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome

if (-not $DebugBuild) {
    if (-not $env:MORROW_KEYSTORE_FILE) {
        $signingDirectory = Join-Path $workspace '.android-tools\signing'
        $configurationPath = Join-Path $signingDirectory 'morrow-signing.json'
        if (-not (Test-Path -LiteralPath $configurationPath)) {
            throw 'Release signing configuration is missing. Restore your signing folder or provide MORROW_KEYSTORE_FILE, MORROW_STORE_PASSWORD, MORROW_KEY_ALIAS, and MORROW_KEY_PASSWORD. Use -DebugBuild only for local development.'
        }
        $signing = Get-Content -LiteralPath $configurationPath -Raw | ConvertFrom-Json
        $env:MORROW_KEYSTORE_FILE = Join-Path $signingDirectory 'morrow-release.jks'
        $env:MORROW_STORE_PASSWORD = $signing.storePassword
        $env:MORROW_KEY_ALIAS = $signing.keyAlias
        $env:MORROW_KEY_PASSWORD = $signing.keyPassword
        $signing = $null
    }
    foreach ($variable in @('MORROW_KEYSTORE_FILE','MORROW_STORE_PASSWORD','MORROW_KEY_ALIAS','MORROW_KEY_PASSWORD')) {
        if (-not [Environment]::GetEnvironmentVariable($variable)) { throw "Missing signing configuration: $variable" }
    }
    if (-not (Test-Path -LiteralPath $env:MORROW_KEYSTORE_FILE)) { throw 'The Morrow release keystore file is missing.' }
}

if (-not $SkipWebBuild) {
    & npm.cmd run build:android
    if ($LASTEXITCODE -ne 0) { throw 'The Android web build failed.' }
}
& node node_modules\@capacitor\cli\bin\capacitor sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }

Push-Location -LiteralPath (Join-Path $workspace 'android')
try {
    $variant = if ($DebugBuild) { 'Debug' } else { 'Release' }
    & .\gradlew.bat ":app:assemble$variant" ":app:lint$variant" --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'The Android build or lint failed.' }
} finally { Pop-Location }

$outputDirectory = Join-Path $workspace 'dist-apk'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$apkName = if ($DebugBuild) { 'Morrow-1.0.0-development.apk' } else { 'Morrow-1.0.0.apk' }
$apkPath = Join-Path $outputDirectory $apkName
$variantDirectory = $variant.ToLowerInvariant()
$builtApk = Join-Path $workspace "android\app\build\outputs\apk\$variantDirectory\app-$variantDirectory.apk"
if (-not (Test-Path -LiteralPath $builtApk)) { throw 'A signed installable APK was not produced.' }
Copy-Item -LiteralPath $builtApk -Destination $apkPath -Force
$sha256 = [Security.Cryptography.SHA256]::Create()
$apkStream = [IO.File]::OpenRead($apkPath)
try {
    $checksum = [BitConverter]::ToString($sha256.ComputeHash($apkStream)).Replace('-', '').ToLowerInvariant()
} finally {
    $apkStream.Dispose()
    $sha256.Dispose()
}
[IO.File]::WriteAllText("$apkPath.sha256", "$checksum  $apkName`n")
Write-Output "Installable APK: $apkPath"
Write-Output "SHA-256: $checksum"
