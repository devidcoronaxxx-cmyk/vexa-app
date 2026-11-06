"""Fine-tune Qwen3-8B on roblox_luau_dataset.jsonl via LoRA.

Requires (install once, ~5 GB):
  pip install torch transformers peft trl datasets accelerate bitsandbytes

Hardware: GPU with >= 12 GB VRAM recommended (LoRA + 4-bit quantization).
  - RTX 3060 12GB: ~60-90 min for 12K examples
  - RTX 4090: ~20-30 min
  - CPU only: days (not recommended)

Usage:
  python finetune-qwen-luau.py --dataset ../../roblox_luau_dataset.jsonl
  python finetune-qwen-luau.py --dataset ../../roblox_luau_dataset.jsonl --epochs 2 --lr 2e-4
"""
import argparse
import json
import os
import sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, help="Path to roblox_luau_dataset.jsonl")
    ap.add_argument("--base", default="Qwen/Qwen3-8B", help="Base model HF id")
    ap.add_argument("--out", default="./qwen3-8b-roblox-luau-lora", help="Output dir for LoRA adapter")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--grad-accum", type=int, default=8)
    ap.add_argument("--max-seq", type=int, default=1024)
    args = ap.parse_args()

    # Lazy imports so the script can be syntax-checked without deps.
    try:
        import torch
        from datasets import Dataset
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer, SFTConfig
    except ImportError as e:
        print("Missing dependency:", e)
        print("Install with: pip install torch transformers peft trl datasets accelerate bitsandbytes")
        sys.exit(1)

    print(f"Loading dataset: {args.dataset}")
    rows = []
    with open(args.dataset, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            o = json.loads(line)
            rows.append({"text": f"### Instruction:\n{o['instruction']}\n\n### Input:\n{o.get('input','')}\n\n### Output:\n{o['output']}"})
    print(f"Examples: {len(rows)}")
    ds = Dataset.from_list(rows)

    print(f"Loading base model: {args.base} (4-bit)")
    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16)
    tok = AutoTokenizer.from_pretrained(args.base, trust_remote_code=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.base, quantization_config=bnb, device_map="auto", trust_remote_code=True)
    model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
                      target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    cfg = SFTConfig(
        output_dir=args.out,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        max_seq_length=args.max_seq,
        logging_steps=20,
        save_strategy="epoch",
        bf16=True,
        optim="paged_adamw_8bit",
        report_to="none",
    )
    trainer = SFTTrainer(model=model, args=cfg, train_dataset=ds, tokenizer=tok, dataset_text_field="text")
    print("Training...")
    trainer.train()
    trainer.save_model(args.out)
    tok.save_pretrained(args.out)
    print(f"LoRA adapter saved to: {args.out}")
    print("To use: load base Qwen3-8B + this adapter via peft.")

if __name__ == "__main__":
    main()
