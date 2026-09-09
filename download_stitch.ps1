# Stitch Asset Helper Script for PocketKirana
# Downloads and organizes UI design references and code artifacts cleanly.

param (
    [string]$DestinationDir = "stitch_downloads"
)

if (-not (Test-Path -Path $DestinationDir)) {
    New-Item -ItemType Directory -Path $DestinationDir | Out-Null
    Write-Host "Created directory: $DestinationDir"
}

Write-Host "Stitch helper ready. All variables configured cleanly."
