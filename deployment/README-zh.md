# TacPAC 部署

TacPAC 通过 InferSystem 的 ZMQ/msgpack 协议提供动作规划和异步触觉修正。
使用第二阶段 checkpoint 启动服务：

```bash
conda activate tacpac

CKPT=results/Checkpoints/vla/<tacpac-run>/final_model/pytorch_model.pt \
PORT=5556 \
bash deployment/local_infer-wan-tac.sh
```

详细配置、四视角输入、`prepare` / `refine` 请求与验证方法见
[TacPAC 真机触觉推理指南](../docs/deployment/REAL-zh.md)。
安装与训练分别见 [安装指南](../docs/INSTALL.md)和[项目说明](../README-zh.md#训练)。
