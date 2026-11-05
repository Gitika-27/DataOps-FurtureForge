param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("lab_a", "lab_b")]
    [string]$Lab,
    [switch]$SkipTrivy
)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Runner = Join-Path $PSScriptRoot "run_scan.py"
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$Arguments = @($Runner, "--lab", $Lab)
if ($SkipTrivy) {
    $Arguments += "--skip-trivy"
}

Push-Location $RepoRoot
try {
    if (Test-Path $VenvPython) {
        & $VenvPython @Arguments
    }
    else {
        py -3 @Arguments
    }
    $RunExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $RunExitCode
