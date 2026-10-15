"""Upload only the initial 8 models and 3 switching examples after `hf auth login`."""
from pathlib import Path
from huggingface_hub import HfApi

REPO_ID = "bzhou010/DexGraspFlow-assets"
ASSETS = Path(__file__).resolve().parents[1] / "static" / "assets"
FILES = ['uncond/Barrett/contactdb+rubber_duck/0.glb', 'uncond/Allegro/contactdb+rubber_duck/0.glb', 'uncond/Shadowhand/contactdb+rubber_duck/0.glb', 'zero_shot/allegro_wo_f3/contactdb+rubber_duck/0.glb', 'zero_shot/shadowhand_wo_ff/contactdb+rubber_duck/0.glb', 'cond/Barrett/contactdb+rubber_duck/front_0.glb', 'cond/Allegro/contactdb+rubber_duck/front_0.glb', 'cond/Shadowhand/contactdb+rubber_duck/front_0.glb', 'uncond/Barrett/contactdb+rubber_duck/1.glb', 'cond/Barrett/contactdb+rubber_duck/back_0.glb', 'zero_shot/allegro_wo_f2/contactdb+rubber_duck/0.glb']

if __name__ == "__main__":
    api = HfApi()
    # Require the repository to exist; do not create it or change its visibility.
    api.repo_info(repo_id=REPO_ID, repo_type="dataset")
    for relative_path in FILES:
        if not (ASSETS / relative_path).is_file():
            raise FileNotFoundError(relative_path)
    api.upload_folder(
        repo_id=REPO_ID,
        repo_type="dataset",
        folder_path=str(ASSETS),
        allow_patterns=FILES,
        commit_message="Add 11 models for project page loading tests",
    )
