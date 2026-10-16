# TacPAC 真机触觉推理

本文对应 [TacPAC 论文](https://arxiv.org/abs/2609.05266)中的异步触觉修正流程。
GPU 端运行模型服务，机器人端通过 InferSystem 的 ZMQ/msgpack 协议发送观测，
执行动作块，并利用新触觉帧修正尚未执行的动作。

环境安装见 [安装指南](../INSTALL.md)，模型和两阶段训练见
[项目说明](../../README-zh.md)。以下命令均从仓库根目录执行。

## 启动模型服务

使用第二阶段 `WanMoTJointTacExpert` checkpoint：

```bash
conda activate tacpac

CKPT=results/Checkpoints/vla/<tacpac-run>/final_model/pytorch_model.pt \
PORT=5556 \
bash deployment/local_infer-wan-tac.sh
```

启动脚本为 Flexiv 触觉模型提供以下默认值，可通过环境变量覆盖：

| 变量 | 默认值 / 含义 |
| --- | --- |
| `CKPT` | 必填，TacPAC checkpoint 路径 |
| `STAT_KEY` | `flexiv_tac`，用于选择动作和状态归一化统计 |
| `PORT` | `5556`，ZMQ 服务端口 |
| `CAMERA_ORDER` | 以下四个视角的逗号分隔列表 |

```text
observation.images.third_view
observation.images.left_wrist_view
observation.images.left_wrist_left_tactile
observation.images.left_wrist_right_tactile
```

客户端的相机名称与顺序必须匹配 `CAMERA_ORDER`，状态和动作的维度、顺序及单位
必须与 checkpoint 的训练数据一致。论文使用 Flexiv Rizon 4、两个 RGB 视角和两个
InTac S1 触觉视角；具体机器人控制和硬件驱动由机器人端提供。

## `prepare` / `refine` 协议

两种请求都使用 `cmd="predict"`，在 `stateful_tactile` 中指定操作：

| 字段 | 用途 |
| --- | --- |
| `request_id` | 请求标识；同一次请求重试时复用，每次新请求使用新标识 |
| `stateful_tactile.op` | `prepare` 或 `refine` |
| `stateful_tactile.plan_id` | 当前动作块的标识，新计划使用新标识 |
| `stateful_tactile.action_offset` | 触觉帧对应的已执行动作数；`prepare` 使用 `0` |
| `stateful_tactile.tactile_seq` | 触觉帧序号 |
| `actions` | `refine` 时提供实际已执行的动作前缀，使用机器人动作空间 |

请求还包含 `state`、`prompt` 和按相机名编码的图像。完整请求构造及响应检查见
[`test_infersystem_stateful_tactile.py`](../../scripts/test/test_infersystem_stateful_tactile.py)。

执行顺序如下：

1. `prepare` 调用基础模型生成动作块，服务端记录 `plan_id` 和规划时的观测。
2. 服务端先返回动作块，随后执行 `prefill_tactile_cache()`。机器人可立即开始执行。
3. 新触觉帧到达后，客户端以同一 `plan_id` 发送 `refine`，携带执行偏移与实际执行前缀。
4. 触觉专家通过 `correct_action()` 读取固定的 tactile-action KV cache，单次前向计算
   输出修正，不重新运行基础模型的去噪过程。
5. 服务端返回完整动作块。客户端仅更新收到结果时仍未执行的部分，并计入通信和计算延迟。
   动作块耗尽后，重新发送 `prepare`。

每次修正基于原始计划的剩余动作计算，实际已执行的前缀作为条件；修正不会逐次累加。
服务端使用 `prepare` 时的观测反归一化，避免规划期间机器人状态变化导致动作参考系跳变。

服务端返回的 `plan` 包含 `plan_id`、`op`、`action_offset`、`tactile_seq` 和
`action_horizon`。不匹配当前计划的 `refine` 会被拒绝。使用 `cmd="reset"`
开始新 episode 时，服务端清空当前计划、请求重放缓存和触觉预处理基准。

## 触觉预处理

机器人端发送原始触觉图像。服务端根据 checkpoint 的配置和数据混合定义识别触觉视角，
应用与训练一致的 raw、相对第 0 帧 residual 或 stress 处理，并区分 RGB 与触觉的图像尺寸。
客户端无需再次进行 residual 或 stress 变换。

实现见 [`tactile_stress.py`](../../TacPAC/dataloader/vla/tactile_stress.py) 和
[`server_infersystem.py`](../../deployment/model_server/server_infersystem.py)。

## 验证

先运行不连接机器人的协议单元测试：

```bash
python -m unittest \
  scripts.test.test_infersystem_protocol \
  scripts.test.test_infersystem_stateful_tactile \
  scripts.test.test_infersystem_prefill_order
```

GPU 端到端验证入口是
[`smoke_stateful_tactile_server_gpu.py`](../../scripts/test/smoke_stateful_tactile_server_gpu.py)。
执行真机动作前，确认 checkpoint、统计 key、相机与动作接口匹配，首次验证使用低速和短动作块。
