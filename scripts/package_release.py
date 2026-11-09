import os
import sys
import zipfile
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS_DIR = Path(r"C:\Users\PRANVE K\Downloads")
ARTIFACT_DIR = Path(r"C:\Users\PRANVE K\.gemini\antigravity\brain\4800a7cb-46a3-4526-9949-86292fbf38cc")

ZIP_NAME = "FutureForge-Complete.zip"
TARGET_DOWNLOADS_ZIP = DOWNLOADS_DIR / ZIP_NAME
TARGET_ARTIFACT_ZIP = ARTIFACT_DIR / ZIP_NAME

EXCLUDE_DIRS = {
    ".venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".git",
    ".cache",
    "data/runs",
    "runs",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".tsbuildinfo",
}

def should_exclude(rel_path: Path) -> bool:
    parts = rel_path.parts
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
        if part.startswith(".pytest_cache"):
            return True
        if part.startswith("__pycache__"):
            return True
    
    # Specific path match for data/runs
    if len(parts) >= 2 and parts[0] == "data" and parts[1] == "runs":
        return True
    if len(parts) >= 2 and parts[0] == "ui" and parts[1] == "node_modules":
        return True

    if rel_path.suffix in EXCLUDE_EXTENSIONS:
        return True

    return False

def build_zip():
    print(f"Packaging FutureForge from: {ROOT}")
    print(f"Target: {TARGET_DOWNLOADS_ZIP}")

    # Remove existing zip if present
    if TARGET_DOWNLOADS_ZIP.exists():
        TARGET_DOWNLOADS_ZIP.unlink()

    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(TARGET_DOWNLOADS_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in ROOT.rglob("*"):
            if not file_path.is_file():
                continue

            rel_path = file_path.relative_to(ROOT)

            if should_exclude(rel_path):
                continue

            # Prefix with repository folder name inside the zip for clean extraction
            archive_path = Path("FutureForge") / rel_path
            zf.write(file_path, arcname=str(archive_path).replace("\\", "/"))

            file_count += 1
            total_uncompressed_bytes += file_path.stat().st_size

    zip_size_mb = TARGET_DOWNLOADS_ZIP.stat().st_size / (1024 * 1024)
    uncompressed_mb = total_uncompressed_bytes / (1024 * 1024)

    print(f"Created {TARGET_DOWNLOADS_ZIP}")
    print(f"Total files: {file_count}")
    print(f"Archive size: {zip_size_mb:.2f} MB (uncompressed: {uncompressed_mb:.2f} MB)")

    # Copy to artifact directory if it exists
    if ARTIFACT_DIR.exists():
        shutil.copy2(TARGET_DOWNLOADS_ZIP, TARGET_ARTIFACT_ZIP)
        print(f"Copied to artifact directory: {TARGET_ARTIFACT_ZIP}")

if __name__ == "__main__":
    build_zip()
