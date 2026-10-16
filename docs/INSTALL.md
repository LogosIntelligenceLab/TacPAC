# TacPAC Installation

This guide covers the environment for TacPAC training and the InferSystem model
server. See the [project overview](../README.md) for the method and two-stage
training workflow, and the [deployment guide](deployment/REAL-zh.md) for tactile
action correction on the robot.

## Prerequisites

- Linux and Conda.
- Python 3.10.
- An NVIDIA GPU, driver, and CUDA toolkit compatible with the chosen PyTorch build.
- `git`, `cmake`, `make`, and `ffmpeg` for source builds and video processing.

Check the GPU environment before installing:

```bash
nvidia-smi
nvcc -V
```

## Python environment

```bash
git clone git@github.com:LogosRoboticsGroup/TacPAC.git
cd TacPAC

conda create -n tacpac python=3.10 -y
conda activate tacpac

pip install torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 \
    --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
pip install flash-attn --no-build-isolation --no-cache-dir
pip install -e .
```

The PyTorch command above uses the CUDA 12.8 build recorded by this repository.
FlashAttention must match the installed PyTorch and CUDA toolkit. The
`--no-cache-dir` option also avoids cross-device-link errors during its build.

The package is named `tacpac`; Python imports use `TacPAC`. The shared
`requirements.txt` includes deployment and hardware packages in addition to model
dependencies.

## Video decoding

The TacPAC training configuration enables `datasets.vla_data.use_decord`. Build
decord beside this checkout:

```bash
TACPAC_ROOT=$(pwd)
cd "$TACPAC_ROOT/.."
git clone --recursive https://github.com/dmlc/decord.git
cd decord
mkdir -p build
cd build
cmake .. -DUSE_CUDA=0 -DCMAKE_BUILD_TYPE=Release
make -j"$(nproc)"
cd ../python
pip install -e .
cd "$TACPAC_ROOT"
```

## Model weights and data

Download the Wan2.2 TI2V backbone and set the local paths in
[`starvla_wam.yaml`](../TacPAC/config/training/vla/starvla_wam.yaml):

- `framework.video_model.dit_path`
- `framework.video_model.vae_path`
- `framework.video_model.text_encoder_path`
- `framework.video_model.tokenizer_path`
- `framework.action_model.model_path` for the initial action-expert weights; see
  [`preprocess_action_expert_backbone.py`](../scripts/vla/preprocess_action_expert_backbone.py).

Register your LeRobot-format data in
[`mixtures.py`](../TacPAC/dataloader/vla/mixtures.py) and precompute the text
embeddings as described in [Data preparation](../README.md#-data-preparation).
The [training instructions](../README.md#training) launch `WanMoTJoint` first,
then load its checkpoint to train `WanMoTJointTacExpert` with the base model frozen.

## Verification

Run these commands from the repository root with `tacpac` activated:

```bash
python scripts/test/test_install_dependencies.py --groups core deploy
python -c "import decord; import flash_attn; import torch; print(torch.__version__, torch.cuda.is_available())"

python -m unittest \
  scripts.test.test_tactile_stress \
  scripts.test.test_tactile_expert \
  scripts.test.test_tactile_view_size \
  scripts.test.test_infersystem_stateful_tactile \
  scripts.test.test_infersystem_prefill_order
```

The dependency checker defaults to module-spec probing, which works on headless
servers without importing display-dependent packages. The unit tests cover tactile
preprocessing, cache geometry, image sizes, and the `prepare` / `refine` protocol.
GPU smoke tests are described in the [project test section](../README.md#-tests).
