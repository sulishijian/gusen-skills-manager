param(
    [Parameter(Mandatory)]
    [ValidateSet('Hot', 'Release')]
    [string]$Mode
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sharedRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)

if (-not $IsWindows) {
    throw 'These shortcuts target Windows. Use npm run tauri:dev to develop on macOS.'
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    if (-not (Test-Path -LiteralPath (Join-Path $cargoBin 'cargo.exe') -PathType Leaf)) {
        throw 'Cargo was not found. Install Rust with rustup or add Cargo to PATH.'
    }
    $env:PATH = "$cargoBin;$env:PATH"
}

$existingCache = Join-Path $sharedRoot '.cargo-skills-manager-cache'
if (-not $env:CARGO_HOME -and (Test-Path -LiteralPath $existingCache -PathType Container)) {
    $env:CARGO_HOME = $existingCache
}
if (-not $env:CARGO_BUILD_JOBS) { $env:CARGO_BUILD_JOBS = '1' }
if (-not $env:CMAKE_BUILD_PARALLEL_LEVEL) { $env:CMAKE_BUILD_PARALLEL_LEVEL = '1' }

$buildTemp = Join-Path $sharedRoot '.skills-manager-build-tools\temp'
if (Test-Path -LiteralPath $buildTemp -PathType Container) {
    $env:TEMP = $buildTemp
    $env:TMP = $buildTemp
}

Push-Location -LiteralPath $projectRoot
try {
    if ($Mode -eq 'Hot') {
        $env:SKILLS_MANAGER_PREVIEW_DIR = Join-Path $env:LOCALAPPDATA 'SkillsManagerBuild\preview-data'
        npm run tauri -- dev --release --config src-tauri/tauri.dev.conf.json
        exit $LASTEXITCODE
    }

    $config = Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
        $keys = Join-Path $env:LOCALAPPDATA 'SkillsManagerSigning'
        $key = Join-Path $keys 'sulishijian-skills-manager.key'
        $password = Join-Path $keys 'signing-password.dpapi'
        foreach ($file in @($key, "$key.pub", $password)) {
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
                throw 'Local updater signing material is missing. Set TAURI_SIGNING_PRIVATE_KEY and its password for this build.'
            }
        }
        if ((Get-Content -LiteralPath "$key.pub" -Raw).Trim() -cne $config.plugins.updater.pubkey) {
            throw 'The local signing key does not match the configured updater public key.'
        }
        $secret = ConvertTo-SecureString ((Get-Content -LiteralPath $password -Raw).Trim())
        $env:TAURI_SIGNING_PRIVATE_KEY = $key
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
    }

    npm run tauri -- build --bundles nsis --ci
    if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed.' }

    $metadata = cargo metadata --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw 'Could not locate the Cargo target directory.' }
    $target = ($metadata | ConvertFrom-Json).target_directory
    $installer = Join-Path $target "release\bundle\nsis\skills-manager_$($config.version)_x64-setup.exe"
    if (-not (Test-Path -LiteralPath "$installer.sig" -PathType Leaf)) {
        throw "Updater signature is missing: $installer.sig"
    }
    npm run release:feed -- $installer
    if ($LASTEXITCODE -ne 0) { throw 'Updater manifest generation failed.' }
    Write-Output "Windows installer: $installer"
} finally {
    Pop-Location
}
