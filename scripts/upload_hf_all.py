"""Upload the full set of GLB assets using the current Hugging Face login."""
from pathlib import Path
from huggingface_hub import HfApi

REPO_ID = 'bzhou010/DexGraspFlow-assets'
ASSETS = Path(__file__).resolve().parents[1] / 'static' / 'assets'
PATTERNS = ['uncond/**/*.glb', 'cond/**/*.glb', 'zero_shot/**/*.glb']

if __name__ == '__main__':
    api = HfApi()
    info = api.repo_info(repo_id=REPO_ID, repo_type='dataset')
    print(f'Uploading to existing dataset {info.id}', flush=True)
    api.upload_large_folder(
        repo_id=REPO_ID,
        repo_type='dataset',
        folder_path=ASSETS,
        allow_patterns=PATTERNS,
        num_workers=4,
        print_report_every=60,
    )
    local = {str(f.relative_to(ASSETS)): f.stat().st_size
             for mode in ('uncond', 'cond', 'zero_shot')
             for f in (ASSETS / mode).rglob('*.glb')}
    remote = {f.path: f.size for f in api.list_repo_tree(
        repo_id=REPO_ID, repo_type='dataset', recursive=True) if hasattr(f, 'size')}
    missing = [path for path, size in local.items() if remote.get(path) != size]
    if missing:
        raise RuntimeError(f'{len(missing)} missing or size-mismatched assets: {missing[:10]}')
    print(f'VERIFIED: all {len(local)} GLB assets are present with matching sizes.', flush=True)
