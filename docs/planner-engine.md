# Planner Engine

## Goal

把 itinerary 的 mutation pipeline 落成一个真正可接 API 的服务层：

- 读取 canonical trip
- 执行结构化 planner commands
- 重算 routes / conflicts / markdown
- 返回 preview
- apply 时做 version check 并持久化

## 当前代码结构

```text
server/
  planner/
    types.ts
    errors.ts
    ids.ts
    time.ts
    repositories.ts
    diff.ts
    derivations.ts
    command-executor.ts
    planner-service.ts
    index.ts
```

## 入口

`PlannerService` 在 [planner-service.ts](/Users/jameszhao/MyDocument/vscode/FullTime/planner/server/planner/planner-service.ts#L16)。

它现在已经支持：

- `previewCommand`
- `applyPreview`
- `rejectPreview`

并且要求每次 mutation 都带 `baseVersion`。

## 执行链

### Preview

1. 从 `TripRepository` 读取 trip
2. 校验 `baseVersion`
3. 把 `utterance` 转成 commands，或者直接使用显式 commands
4. 在 working copy 上执行 command
5. 调 `recomputeDerivedState`
6. 生成 diff
7. 存到 `PreviewRepository`

### Apply

1. 再次读取 canonical trip
2. 校验 preview 对应的 `baseVersion`
3. 写入 preview 里的 itinerary
4. 追加 change log
5. 删除 preview cache

## 当前已支持的 command 行为

在 [command-executor.ts](/Users/jameszhao/MyDocument/vscode/FullTime/planner/server/planner/command-executor.ts#L30)：

- `lock_item`
- `unlock_item`
- `move_item`
- `delete_item`
- `replace_place`
- `insert_item`
- `fill_meal`
- `set_transport_mode`
- `compress_day`
- `relax_day`
- `optimize_day`
- `resolve_conflict`
- `regenerate_markdown`

`optimize_day` 目前先复用 `compress_day` 的保守实现，还不是 route-matrix 驱动的真正重排。

## Derived Recompute

`recomputeDerivedState` 在 [derivations.ts](/Users/jameszhao/MyDocument/vscode/FullTime/planner/server/planner/derivations.ts#L21)。

这一步会统一重算：

- 每天 item 排序和 duration
- 相邻 item 之间的 route
- slack
- conflicts
- markdown sections

这保证 map、timeline、markdown 始终从同一份 itinerary state 派生。

## 当前限制

- 还没有真正的数据库实现，只有 in-memory repository contract
- 还没有把 free-form utterance 接上 LLM command translator
- `optimize_day` 还没接 `computeRouteMatrix`
- 没有正式 TypeScript typecheck，因为当前 repo 里还没有 `tsconfig` / package setup

## 下一步

最自然的下一层是：

1. 给 `commands/preview` / `commands/apply` 写 API handler
2. 接一个 `TripRepository` 的 Postgres 实现
3. 把 `replace_place` / `fill_meal` 的候选选择做成 preview diff
4. 用 `computeRouteMatrix` 做真正的 day optimize
