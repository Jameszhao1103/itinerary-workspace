# Google 接口设计

## 目标

把 Google Maps Platform 这一层收敛成两个后端 adapter:

- `GooglePlacesAdapter`
- `GoogleRoutesAdapter`

前端地图只负责渲染，不直接承担 itinerary 计算。Places 和 Routes 的调用都应由后端 planner engine 统一发起，再把结构化结果回填到 itinerary。

## 边界划分

### 前端负责

- 加载 `Maps JavaScript API`
- 渲染地图、marker、polyline
- 响应点击、hover、选中状态

### 后端负责

- 地点搜索
- 地点详情补全
- 路线时间、距离、polyline 计算
- 营业时间冲突检查
- itinerary 节点之间的 transit 生成

这条边界要严格执行。否则你很快会出现：

- 地图上显示的 route 和 timeline 不一致
- 前端和后端分别算了一次时长
- 不同页面拿到的 place 字段不一致

## 设计原则

- Adapter 只做 Google 协议适配，不做业务排程。
- Planner engine 只调用抽象接口，不依赖 Google 原始响应结构。
- 所有请求都使用 field mask，只拿必要字段。
- 所有返回值先映射为你自己的领域对象，再进入 itinerary。
- 搜索结果和路线结果都允许缓存。

## 推荐目录

```text
server/
  integrations/
    google/
      config.ts
      create-google-adapters.ts
      index.ts
      shared/
        http-client.ts
        errors.ts
      places/
        index.ts
        types.ts
        field-masks.ts
        google-places-adapter.ts
      routes/
        index.ts
        types.ts
        field-masks.ts
        google-routes-adapter.ts
```

## 初始化方式

建议在服务启动时统一创建 adapter，不要在业务逻辑里到处 new client：

```ts
import { createGoogleAdapters } from "./server/integrations/google";

const { placesAdapter, routesAdapter } = createGoogleAdapters({
  apiKey: process.env.GOOGLE_MAPS_API_KEY!,
  timeoutMs: 10_000,
});
```

如果你不显式传 `apiKey`，工厂会尝试读取：

- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_API_KEY`

可选覆盖项：

- `GOOGLE_PLACES_BASE_URL`
- `GOOGLE_ROUTES_BASE_URL`
- `GOOGLE_API_TIMEOUT_MS`

`computeRouteMatrix` 这层要注意一件事：Google 官方文档明确写的是“返回一个 stream of route information”，所以 adapter 最好按“元素流”来解析，而不是假定服务端永远回一个统一数组 envelope。`computeRoutes` 则可以按普通 JSON 对象处理。来源：[computeRouteMatrix](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix)

## 统一领域类型

这些类型是 adapter 对 planner engine 的稳定输出，不应该直接把 Google 原始 JSON 往上透传。

```ts
export type LatLng = {
  lat: number;
  lng: number;
};

export type TravelMode =
  | "walk"
  | "drive"
  | "taxi"
  | "transit"
  | "flight";

export type PlaceCategory =
  | "airport"
  | "hotel"
  | "restaurant"
  | "museum"
  | "park"
  | "shopping"
  | "landmark"
  | "station"
  | "other";

export type OpeningHoursWindow = {
  weekday:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  open: string;
  close: string;
};
```

## Places Adapter

## 职责

- 按文本搜索候选地点
- 用 place id 拉详情
- 把 Google `Place` 映射成内部 `PlaceSnapshot`

## 接口定义

```ts
export type PlaceSearchRequest = {
  query: string;
  locationBias?: {
    center: LatLng;
    radiusMeters: number;
  };
  includedTypes?: string[];
  openNow?: boolean;
  minRating?: number;
  maxPriceLevel?: number;
  languageCode?: string;
  regionCode?: string;
  maxResultCount?: number;
};

export type PlaceCandidate = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  location: LatLng;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  regularOpeningHours?: OpeningHoursWindow[];
  currentOpenNow?: boolean;
};

export type PlaceDetailsRequest = {
  placeId: string;
  languageCode?: string;
  regionCode?: string;
};

export type PlaceSnapshot = {
  placeId: string;
  provider: "google_places";
  name: string;
  formattedAddress?: string;
  location: LatLng;
  category: PlaceCategory;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  regularOpeningHours?: OpeningHoursWindow[];
  currentOpeningHoursText?: string[];
  types: string[];
};

export interface PlacesAdapter {
  searchByText(input: PlaceSearchRequest): Promise<PlaceCandidate[]>;
  getPlaceDetails(input: PlaceDetailsRequest): Promise<PlaceSnapshot>;
}
```

## 推荐 field mask

### 文本搜索

搜索阶段不要拉太重的字段，优先拿候选列表：

```text
places.id,
places.displayName,
places.formattedAddress,
places.location,
places.primaryType,
places.rating,
places.userRatingCount,
places.priceLevel
```

如果你要在搜索阶段直接过滤营业时间，再额外加：

```text
places.currentOpeningHours,
places.regularOpeningHours
```

### 地点详情

详情阶段建议用这组字段：

```text
id,
displayName,
formattedAddress,
location,
types,
googleMapsUri,
rating,
userRatingCount,
priceLevel,
currentOpeningHours,
regularOpeningHours
```

## Google 响应到内部对象的映射

```ts
function mapGooglePlaceToSnapshot(place: GooglePlaceDetailsResponse): PlaceSnapshot {
  return {
    placeId: place.id,
    provider: "google_places",
    name: place.displayName?.text ?? "Unknown place",
    formattedAddress: place.formattedAddress,
    location: {
      lat: place.location.latitude,
      lng: place.location.longitude,
    },
    category: mapGoogleTypesToCategory(place.types),
    googleMapsUri: place.googleMapsUri,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    priceLevel: place.priceLevel,
    regularOpeningHours: mapOpeningHours(place.regularOpeningHours),
    currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
    types: place.types ?? [],
  };
}
```

## 使用建议

- `searchByText()` 用于“补一个午餐”“换个评分高的餐厅”
- `getPlaceDetails()` 用于最终确认被选中的地点，并写入 itinerary
- 不建议把 Place Search 的原始结果直接持久化成 itinerary 节点

## Routes Adapter

## 职责

- 计算两个 itinerary 节点之间的 route leg
- 在重排一天行程时批量算 route matrix
- 把 Google route 响应映射成内部 `RouteSnapshot`

## 接口定义

```ts
export type RouteWaypoint = {
  placeId?: string;
  location: LatLng;
};

export type ComputeLegRequest = {
  origin: RouteWaypoint;
  destination: RouteWaypoint;
  travelMode: Exclude<TravelMode, "flight">;
  departureTime?: string;
  arrivalTime?: string;
  languageCode?: string;
  regionCode?: string;
  includeSteps?: boolean;
  routingPreference?: "traffic_unaware" | "traffic_aware";
};

export type RouteStepSnapshot = {
  instruction?: string;
  travelMode?: TravelMode;
  distanceMeters?: number;
  durationMinutes?: number;
  polyline?: string;
};

export type RouteSnapshot = {
  provider: "google_routes";
  mode: Exclude<TravelMode, "flight">;
  distanceMeters: number;
  durationMinutes: number;
  staticDurationMinutes?: number;
  polyline?: string;
  warnings: string[];
  steps: RouteStepSnapshot[];
};

export type RouteMatrixRequest = {
  origins: RouteWaypoint[];
  destinations: RouteWaypoint[];
  travelMode: Exclude<TravelMode, "flight">;
  departureTime?: string;
  routingPreference?: "traffic_unaware" | "traffic_aware";
};

export type RouteMatrixElement = {
  originIndex: number;
  destinationIndex: number;
  distanceMeters?: number;
  durationMinutes?: number;
  status: "ok" | "error";
};

export interface RoutesAdapter {
  computeLeg(input: ComputeLegRequest): Promise<RouteSnapshot>;
  computeMatrix(input: RouteMatrixRequest): Promise<RouteMatrixElement[]>;
}
```

## travel mode 映射

Google 的模式和你自己的 itinerary mode 不应该直接混用，建议统一做一层转换：

```ts
function toGoogleTravelMode(mode: Exclude<TravelMode, "flight">): string {
  switch (mode) {
    case "walk":
      return "WALK";
    case "drive":
    case "taxi":
      return "DRIVE";
    case "transit":
      return "TRANSIT";
  }
}
```

其中 `taxi` 在 Google Routes 层通常还是按 `DRIVE` 算，只是在 UI 和费用模型里把它表现为出租车。

## 推荐 field mask

### `computeRoutes`

最小字段集合：

```text
routes.distanceMeters,
routes.duration,
routes.staticDuration,
routes.polyline.encodedPolyline,
routes.warnings
```

如果你要做更细的路线展示，再加：

```text
routes.legs.distanceMeters,
routes.legs.duration,
routes.legs.staticDuration,
routes.legs.polyline.encodedPolyline,
routes.legs.steps.distanceMeters,
routes.legs.steps.staticDuration,
routes.legs.steps.polyline.encodedPolyline,
routes.legs.steps.travelMode,
routes.legs.steps.navigationInstruction.instructions
```

### `computeRouteMatrix`

优化当天顺序时建议只拿：

```text
originIndex,
destinationIndex,
distanceMeters,
duration,
status,
condition
```

## Google 响应到内部对象的映射

```ts
function mapComputeRoutesResponse(
  response: GoogleComputeRoutesResponse,
  mode: Exclude<TravelMode, "flight">
): RouteSnapshot {
  const route = response.routes?.[0];
  if (!route) throw new Error("No route returned");

  return {
    provider: "google_routes",
    mode,
    distanceMeters: route.distanceMeters ?? 0,
    durationMinutes: parseDurationToMinutes(route.duration),
    staticDurationMinutes: route.staticDuration
      ? parseDurationToMinutes(route.staticDuration)
      : undefined,
    polyline: route.polyline?.encodedPolyline,
    warnings: route.warnings ?? [],
    steps: (route.legs ?? []).flatMap((leg) =>
      (leg.steps ?? []).map((step) => ({
        instruction: step.navigationInstruction?.instructions,
        travelMode: mapGoogleStepMode(step.travelMode),
        distanceMeters: step.distanceMeters,
        durationMinutes: step.staticDuration
          ? parseDurationToMinutes(step.staticDuration)
          : undefined,
        polyline: step.polyline?.encodedPolyline,
      }))
    ),
  };
}
```

## Planner Engine 如何调用

## 1. 生成初稿

- 用 `PlacesAdapter.searchByText()` 找活动和餐厅候选
- 用 `PlacesAdapter.getPlaceDetails()` 固化被选中的地点
- 用 `RoutesAdapter.computeLeg()` 补齐相邻节点之间的 transit

## 2. 替换地点

- 先 `searchByText()`
- 再 `getPlaceDetails()`
- 用新地点重算前后两段 route
- 重新跑 opening hours validation

## 3. 重新优化当天

- 对候选地点集合调用 `computeMatrix()`
- 先用 matrix 做排序/筛选
- 最终顺序确定后，再对相邻节点调用 `computeLeg()`

## 缓存策略

## Places

- `searchByText`: 短缓存，按 `query + locationBias + type` 作为 key
- `getPlaceDetails`: 长缓存，按 `placeId + fieldProfile + languageCode` 作为 key

## Routes

- `computeLeg`: 中缓存，按 `origin + destination + mode + departureBucket` 作为 key
- `computeMatrix`: 很短缓存，按节点集合 hash 作为 key

交通是时间敏感的，所以 route 缓存应比 place 缓存更保守。

## 错误模型

不要把 Google 原始错误直接往上抛，adapter 应统一成内部错误码：

```ts
export type GoogleIntegrationErrorCode =
  | "place_not_found"
  | "place_ambiguous"
  | "route_unavailable"
  | "quota_exceeded"
  | "upstream_timeout"
  | "upstream_bad_response";
```

这样 planner engine 才能做可预测的降级处理。

## 前端不要直接做的事

- 不要在浏览器直接调用 Place Details 来生成 itinerary 节点
- 不要在前端直接算 route duration 再写入 timeline
- 不要把 Google 原始 `Place` 或 `Route` 对象放进 Zustand store

前端只应该拿你自己整理过的：

- `PlaceSnapshot`
- `RouteSnapshot`
- `Conflict`
- `Itinerary`

## MVP 最小实现

如果你要先收敛范围，我建议 Google 层第一版只实现这 4 个方法：

```ts
interface PlacesAdapter {
  searchByText(input: PlaceSearchRequest): Promise<PlaceCandidate[]>;
  getPlaceDetails(input: PlaceDetailsRequest): Promise<PlaceSnapshot>;
}

interface RoutesAdapter {
  computeLeg(input: ComputeLegRequest): Promise<RouteSnapshot>;
  computeMatrix(input: RouteMatrixRequest): Promise<RouteMatrixElement[]>;
}
```

这已经足够支持：

- 选航班后的初稿生成
- 替换活动/餐厅
- 补一个附近推荐
- 重新优化当天
- 地图渲染和时间轴排程

## 官方文档

- Places Text Search (New): <https://developers.google.com/maps/documentation/places/web-service/text-search>
- Place Details (New): <https://developers.google.com/maps/documentation/places/web-service/place-details>
- Routes computeRoutes: <https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes>
- Routes field mask: <https://developers.google.com/maps/documentation/routes/choose_fields>
- Routes computeRouteMatrix: <https://developers.google.com/maps/documentation/routes/compute_route_matrix>
- Maps JavaScript Advanced Markers: <https://developers.google.com/maps/documentation/javascript/advanced-markers/add-marker>
