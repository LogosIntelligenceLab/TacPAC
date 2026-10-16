#!/usr/bin/env python
import argparse
import json
import os
from pathlib import Path

import torch
import torch.distributed as dist
from omegaconf import DictConfig, OmegaConf
from tqdm import tqdm
from transformers import AutoTokenizer

from TacPAC.dataloader.vla.mixtures import DATASET_NAMED_MIXTURES
from TacPAC.utils.text_embedding_cache import (
    DEFAULT_CONTEXT_LEN,
    DEFAULT_ENCODER_ID,
    format_text_prompt,
    text_cache_path,
)
from TacPAC.model.modules.wan_video.wan_dit import WanModelStateDictConverter
from TacPAC.model.modules.wan_video.wan_text_encoder import WanTextEncoder
from TacPAC.training.trainer_utils.trainer_tools import normalize_dotlist_args


def _init_distributed():
    world_size = int(os.environ.get("WORLD_SIZE", "1"))
    if world_size <= 1:
        return 0, 1, 0
    local_rank = int(os.environ.get("LOCAL_RANK", "0"))
    if torch.cuda.is_available():
        torch.cuda.set_device(local_rank)
    if not dist.is_initialized():
        dist.init_process_group("nccl" if torch.cuda.is_available() else "gloo")
    return dist.get_rank(), dist.get_world_size(), local_rank


def _parse_dtype(value) -> torch.dtype:
    name = str(value).lower()
    if name in {"bf16", "bfloat16", "torch.bfloat16"}:
        return torch.bfloat16
    if name in {"fp16", "float16", "torch.float16"}:
        return torch.float16
    return torch.float32


def _plain_dict(value) -> dict:
    if isinstance(value, DictConfig):
        return OmegaConf.to_container(value, resolve=True)
    return dict(value or {})


def _load_tokenizer(tokenizer_path: str):
    if os.path.exists(tokenizer_path):
        return AutoTokenizer.from_pretrained(tokenizer_path)
    if os.path.isabs(tokenizer_path) or os.path.sep in tokenizer_path:
        raise FileNotFoundError(f"Tokenizer path does not exist: {tokenizer_path}")
    return AutoTokenizer.from_pretrained(tokenizer_path)


def _dataset_roots(data_mix: str) -> list[str]:
    mixture = DATASET_NAMED_MIXTURES[data_mix]
    return [str(spec["data_root"]) for spec in mixture.values()]


def _read_prompts(
    data_roots: list[str],
    prompt_template: str | None = None,
    max_prompts: int | None = None,
    include_uncond: bool = False,
) -> list[str]:
    prompts = []
    seen = set()

    def add_prompt(prompt: str) -> bool:
        if prompt in seen:
            return False
        seen.add(prompt)
        prompts.append(prompt)
        return bool(max_prompts and len(prompts) >= max_prompts)

    if include_uncond and add_prompt(""):
        return prompts

    for data_root in data_roots:
        tasks_path = Path(data_root) / "meta" / "tasks.jsonl"
        with tasks_path.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                task = str(json.loads(line)["task"])
                if add_prompt(format_text_prompt(task, prompt_template=prompt_template)):
                    return prompts
    return prompts


def _build_wan_text_encoder(cfg, device: torch.device, dtype: torch.dtype):
    video_cfg = cfg.framework.video_model
    text_encoder = WanTextEncoder(**_plain_dict(video_cfg.text_encoder_kwargs)).to(device=device, dtype=dtype).eval()
    state_dict = WanModelStateDictConverter.load_state_dict(str(video_cfg.text_encoder_path))
    text_encoder.load_state_dict(state_dict, strict=False)
    tokenizer = _load_tokenizer(str(video_cfg.tokenizer_path))
    return text_encoder, tokenizer


def _encode_batch(
    text_encoder,
    tokenizer,
    prompts: list[str],
    device: torch.device,
    dtype: torch.dtype,
    context_len: int,
) -> tuple[torch.Tensor, torch.Tensor]:
    tokens = tokenizer(
        prompts,
        padding="max_length",
        max_length=context_len,
        truncation=True,
        add_special_tokens=True,
        return_tensors="pt",
    )
    input_ids = tokens.input_ids.to(device)
    mask = tokens.attention_mask.to(device=device, dtype=torch.bool)
    context = text_encoder(input_ids, mask=mask).to(dtype=dtype)
    context = context.masked_fill(~mask[:, :, None], 0)
    return context, mask


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config_yaml", default="TacPAC/config/training/vla/starvla_wam.yaml")
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--max_prompts", type=int, default=0)
    parser.add_argument(
        "--encoder_family", choices=["auto", "wan"], default="auto", help="auto selects the Wan text encoder"
    )
    parser.add_argument("--include_uncond", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args, overrides = parser.parse_known_args()

    cfg = OmegaConf.load(args.config_yaml)
    cfg = OmegaConf.merge(cfg, OmegaConf.from_dotlist(normalize_dotlist_args(overrides)))

    rank, world_size, local_rank = _init_distributed()
    device = torch.device(f"cuda:{local_rank}" if torch.cuda.is_available() else "cpu")
    dtype = _parse_dtype(getattr(cfg.framework, "torch_dtype", "bfloat16"))

    data_cfg = cfg.datasets.vla_data
    cache_dir = Path(str(data_cfg.text_embedding_cache_dir))
    context_len = int(getattr(data_cfg, "text_context_len", getattr(cfg.framework.video_model, "text_context_len", DEFAULT_CONTEXT_LEN)))
    encoder_id = str(getattr(data_cfg, "text_cache_encoder_id", DEFAULT_ENCODER_ID))
    prompt_template = getattr(
        data_cfg,
        "text_context_prompt_template",
        getattr(cfg.framework.video_model, "prompt_template", None),
    )

    prompts = _read_prompts(
        _dataset_roots(str(data_cfg.data_mix)),
        prompt_template=prompt_template,
        max_prompts=args.max_prompts if args.max_prompts > 0 else None,
        include_uncond=args.include_uncond,
    )
    local_prompts = prompts[rank::world_size]
    if rank == 0:
        print(f"Text prompts: family=wan total={len(prompts)} world_size={world_size} cache_dir={cache_dir}")

    text_encoder, tokenizer = _build_wan_text_encoder(cfg, device, dtype)
    written = 0
    skipped = 0
    iterator = range(0, len(local_prompts), args.batch_size)
    if rank == 0:
        iterator = tqdm(iterator, desc="Encoding text prompts", dynamic_ncols=True)

    with torch.inference_mode():
        for start in iterator:
            batch_prompts = local_prompts[start : start + args.batch_size]
            cache_paths = [text_cache_path(cache_dir, prompt, context_len, encoder_id) for prompt in batch_prompts]
            keep = [args.overwrite or not path.exists() for path in cache_paths]
            skipped += keep.count(False)
            if not any(keep):
                continue

            encode_prompts = [prompt for prompt, should_keep in zip(batch_prompts, keep) if should_keep]
            encode_paths = [path for path, should_keep in zip(cache_paths, keep) if should_keep]
            context, mask = _encode_batch(text_encoder, tokenizer, encode_prompts, device, dtype, context_len)

            for i, cache_path in enumerate(encode_paths):
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                torch.save(
                    {
                        "context": context[i].detach().cpu().contiguous(),
                        "mask": mask[i].detach().cpu().contiguous(),
                        "prompt": encode_prompts[i],
                        "encoder_id": encoder_id,
                        "family": "wan",
                    },
                    cache_path,
                )
                written += 1

    if world_size > 1:
        counts = torch.tensor([written, skipped], device=device, dtype=torch.long)
        dist.all_reduce(counts, op=dist.ReduceOp.SUM)
        written, skipped = int(counts[0].item()), int(counts[1].item())
    if rank == 0:
        print(f"Done. written={written} skipped={skipped}")
    if dist.is_initialized():
        dist.destroy_process_group()


if __name__ == "__main__":
    main()
