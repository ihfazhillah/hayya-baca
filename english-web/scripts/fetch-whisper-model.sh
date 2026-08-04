#!/usr/bin/env bash
# Download the Whisper base.en ONNX model (Spec 065) for self-hosting, so the
# SPA loads it from OUR nginx (/models/) instead of the HuggingFace CDN —
# keeping english-web offline-first and dependency-free.
#
# Usage:
#   ./scripts/fetch-whisper-model.sh [TARGET_DIR]
# Default TARGET_DIR = ./models/whisper-base.en (gitignored). On the server run
# with TARGET_DIR=/home/ihfazh/english-web/models/whisper-base.en
set -euo pipefail

REPO="Xenova/whisper-base.en"
BASE="https://huggingface.co/${REPO}/resolve/main"
DEST="${1:-$(dirname "$0")/../models/whisper-base.en}"

# Config/tokenizer + ONNX weights for both backends:
#   *_quantized → WASM (dtype q8),  *_fp16 → WebGPU (dtype fp16)
FILES=(
  "config.json"
  "generation_config.json"
  "preprocessor_config.json"
  "tokenizer.json"
  "tokenizer_config.json"
  "onnx/encoder_model_quantized.onnx"
  "onnx/decoder_model_merged_quantized.onnx"
  "onnx/encoder_model_fp16.onnx"
  "onnx/decoder_model_merged_fp16.onnx"
  # q4 decoder — stable on WebGPU (fp16 decoder truncates). Paired with fp16
  # encoder (WebGPU) or q8 encoder (WASM). See whisperWorker.ts dtype.
  "onnx/encoder_model_q4.onnx"
  "onnx/decoder_model_merged_q4.onnx"
)

echo "==> Downloading ${REPO} → ${DEST}"
for f in "${FILES[@]}"; do
  mkdir -p "${DEST}/$(dirname "$f")"
  echo "  - $f"
  curl -fsSL "${BASE}/${f}" -o "${DEST}/${f}"
done
echo "==> Done. $(du -sh "${DEST}" | cut -f1) in ${DEST}"
