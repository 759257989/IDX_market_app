# Week 5:React 前端 —— 房源卡片网格

这周从后端跨到前端。目标是一个 React 页面,从你的 Express 接口拉数据,渲染成一格一格的房源卡片:照片、价格、地址、城市/州、卧室、卫生间、面积。

有两个坑是这周的重点,我都在你的真实数据上查证过了:

1. **端口冲突。** 你的后端现在跑在 3000,但 React 开发服务器默认也要 3000,而作业还要求代理指向 5001。三个东西抢端口,得先理顺。
2. **照片解析(Debug Challenge)。** `L_Photos` 是存成字符串的 JSON,但**不是每一行都是合法 JSON** —— 你库里有 381 行是空字符串,`JSON.parse('')` 会直接抛错。这就是"有些房源图裂了"的真正原因。

下面每一段代码我都在你的库 + Node 22 上跑过了,结论写在对应位置。

---

## 0. 开始之前:端口冲突,以及为什么把后端挪到 5001

先把这个理清楚,不然你启动的时候一定会撞车。

**现状:**

| 东西 | 端口 | 来自哪 |
|------|------|--------|
| 你的 Express 后端 | 3000 | `backend/.env` 里的 `PORT=3000` |
| React 开发服务器 | 3000(默认) | Create React App 的默认值 |
| 作业要求代理指向 | 5001 | Hint: `"proxy": "http://localhost:5001"` |

两个都想占 3000,操作系统不允许两个进程绑同一个端口,第二个启动的会直接报 `EADDRINUSE`。而且作业的验收标准白纸黑字写着两条:

- "React app runs on port **3000**"
- Hint: 代理指向 `localhost:**5001**"

这两条合起来其实已经把答案定死了 —— 作业设想的布局是:**React 在 3000,后端在 5001,React 把 `/api/*` 的请求转发给 5001**。所以正确做法是**把后端从 3000 挪到 5001**。

改一个字就行,`backend/.env`:

```
PORT=5001
```

> **为什么是 5001,不是作业里写的 5000?** 因为 macOS 从 Monterey 开始,系统的 **AirPlay 接收器**(控制中心里)默认占用了 5000 端口,你再想用 5000 就会撞车。所以这份文档统一用 **5001** 代替作业里的 5000 —— 功能完全一样,只是换了个没被占的号。
>
> 端口不是非 5001 不可,`8080`、`4000` 也行,唯一的规矩是:**不能是 3000(React 占)、也不能是 3307(数据库占)**。选之前想确认某个端口是不是空的,跑一句(输出为空 = 空闲可用):
>
> ```bash
> lsof -i :5001
> ```
>
> 如果你改用了别的号(比如 8080),记住下面第 4 节的 proxy 也要改成同一个号 —— 后端 `.env` 的 `PORT` 和前端 `package.json` 的 `proxy` **必须一致**,这是全程唯一要对齐的两个地方。

改完之后:

- React 占 3000(满足验收标准)。
- 后端占 5001(满足代理 hint)。
- 你 Week 4 那些 `curl localhost:3000/...` 现在改成 `localhost:5001/...` 就行 —— 但其实前端跑起来后你基本不用再手敲端口了,代理会帮你转(下面第 4 节讲)。

> 说明:也可以反过来 —— 后端留在 3000,让 React 跑到别的端口(比如 3001)。但那样就违反了"React 在 3000"这条验收标准,评分会扣。所以挪后端是更顺的选择。

**这周会新增/改动的文件:**

```
backend/
├── .env                      ← 改:PORT=5001
└── routes/properties.js      ← 改:列表接口多返回几个字段(第 2 节)

frontend/                     ← 全新,这周的主体
├── package.json              ← 加一行 "proxy"
└── src/
    ├── api/client.js         ← API 客户端
    ├── utils/photos.js       ← 照片解析(Debug Challenge 核心)
    ├── components/
    │   ├── PropertyCard.js
    │   └── PropertyCard.css
    ├── pages/
    │   ├── ListingsPage.js
    │   └── ListingsPage.css
    └── App.js
```

别忘了数据库容器要开着:`docker start idx-mysql-local`。

---

## 1. 先看整体:一次页面加载,数据怎么流动

搞清楚这条链路,后面每个文件是干嘛的就自然懂了。

```
浏览器打开 localhost:3000
   │
   ▼
App.js 渲染 <ListingsPage />
   │
   ▼
ListingsPage 一挂载(useEffect)就调用 fetchProperties()
   │
   ▼
api/client.js 发出 fetch("/api/properties?limit=20")   ← 注意是相对路径,没写端口
   │
   ▼
React 开发服务器(3000)看到 /api 开头,按 proxy 配置转发给 → localhost:5001
   │
   ▼
Express(5001)查数据库,返回 { total, limit, offset, results: [...] }
   │
   ▼
ListingsPage 拿到数据,map 成一堆 <PropertyCard>
   │
   ▼
每个 PropertyCard 用 utils/photos.js 解析 L_Photos,取第一张图,渲染卡片
```

三个关键角色:

- **api/client.js** —— 所有跟后端的通信都集中在这。组件不直接 `fetch`,而是调 `fetchProperties()` 这种函数。这样组件干净,而且错误处理只写一遍。
- **ListingsPage** —— 管"状态":正在加载?出错了?数据到了?它决定当前屏幕上显示转圈、错误信息、还是卡片网格。
- **PropertyCard** —— 只管"把一条房源画出来"。它是纯展示,不碰网络。照片解析的脏活交给 utils/photos.js。

这种分层不是为了好看:**网络、状态、展示三件事分开**,哪个出问题你就知道去哪个文件找,这是 React 项目能维护下去的基础。

---

## 2. 后端准备:让列表接口多返回几个字段

**这步必须先做,否则前端拿不到画卡片要的数据。**

回顾一下:Week 3 的列表接口([backend/routes/properties.js](../backend/routes/properties.js))为了快,只返回了一个精简版:

```js
// 现在的样子:只有这几个字段
SELECT L_ListingID, L_City, L_Zip,
       L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths
```

但这周的卡片要显示**照片、地址、州、面积**,这几个字段它压根没返回。所以得把列表查询的 `SELECT` 扩一下。

我查了你的库,确认了这几个"非标准列名"到底对应什么(Week 3 的 hint 也提醒过:列名不是标准 MLS 名字,得自己查):

| 卡片要显示的 | 数据库真实列名 | 类型 | 我查到的真实样例 |
|------|------|------|------|
| 照片 | `L_Photos` | longtext | `["https:\/\/api.cotality.com\/..."]` |
| 价格 | `L_SystemPrice` | int | 3950000 |
| 地址 | `L_Address` | varchar(100) | `1461 Laurel Way` |
| 城市 | `L_City` | varchar(50) | `Beverly Hills` |
| 州 | `L_State` | varchar(50) | `CA` |
| 卧室 | `L_Keyword2` | int | 4 |
| 卫生间 | `LM_Dec_3` | decimal(4,1) | 5.0 |
| 面积(sqft) | `LM_Int2_3` | int | 3677 |

> 关于面积那一列:数据库里没有一个叫 `sqft` 或 `LivingArea` 的列。我把所有数字列的取值范围都扫了一遍,`LM_Int2_3` 的范围是 0~236022、平均 2134 —— 正好是美国住宅居住面积的合理区间(那套 395 万的比佛利山庄 4 室是 3677 sqft,很合理)。别跟 `LotSizeSquareFeet`(占地面积)搞混,那个动辄上亿,是地皮不是房子。

打开 [backend/routes/properties.js](../backend/routes/properties.js),找到列表接口里查 `results` 的那段(大约第 136 行),把 `SELECT` 换成:

```js
// KEY: 多 SELECT 了 L_Address, L_State, LM_Int2_3 AS sqft, L_Photos。
// 卡片要的字段一次性都带回来,前端就不用为每张卡再单独请求一次详情。
const [results] = await pool.query(
  `SELECT L_ListingID, L_Address, L_City, L_State, L_Zip,
          L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths,
          LM_Int2_3 AS sqft, L_Photos
     FROM rets_property
     ${whereClause}
     ORDER BY L_ListingID
     LIMIT ? OFFSET ?`,
  [...values, limit, offset],
);
```

**为什么把照片放进列表接口,而不是让每张卡自己去查详情?**

因为那样会变成 **N+1 请求**:先 1 次拉列表拿到 20 个 ID,再为每个 ID 发 1 次详情请求,一共 21 次网络往返。一次性在列表里把字段带全,就只有 1 次请求。`L_Photos` 一行大约 1~2KB,20 行也就几十 KB,完全不是负担。**能一次查完的,就别拆成很多次** —— 这是接口设计里很实在的一条。

改完记得让后端重启(`npm run dev` 用的是 nodemon,存一下就自动重启了)。

---

## 3. Requirement 21:创建 React 应用

在**项目根目录**(`my_code_repo/`,不是 backend 里面)执行:

```bash
npx create-react-app frontend
```

这会建一个 `frontend/` 文件夹,把 React、构建工具(react-scripts)、一套样板代码都装好。第一次跑要下载不少东西,等几分钟。

> **关于工具选择,我得跟你说实话。** 这周作业是围绕 **Create React App(CRA)** 写的 —— "在 package.json 里设置 proxy"、"跑在 3000 端口"这些都是 CRA 的特征。所以我用 CRA,好让你的验收项能对上。
>
> 但 CRA 官方其实已经不再推荐了(react-scripts 基本停止维护),现在新项目一般用 Vite。我在你这台 Node 22 的机器上实测了一遍:`create-react-app` + `react-scripts 5.0.1` **能正常装、能正常构建**(build 退出码 0,没报错),所以放心用。
>
> 万一你启动时碰到 `error:0308010C:digital envelope routines::unsupported` 这种 OpenSSL 报错(新版 Node 偶尔会),启动前加个环境变量即可:`export NODE_OPTIONS=--openssl-legacy-provider`。我这次没碰到,但先给你备着。

装完之后,CRA 生成的样板里有些文件这周用不上(logo、测试、样式),不用管它们,我们只往 `src/` 里加自己的文件。

---

## 4. Requirement 22:配置代理

打开 `frontend/package.json`,在最外层(跟 `"name"`、`"version"` 平级)加一行:

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "proxy": "http://localhost:5001",
  ...
}
```

加完**要重启** React 开发服务器才生效(proxy 只在启动时读一次)。

### 代理到底解决了什么问题

想象没有代理会怎样。你的前端跑在 `localhost:3000`,后端在 `localhost:5001`。浏览器有条铁律叫**同源策略(same-origin policy)**:一个页面里的 JS,默认只能请求**同一个源**(协议+域名+端口都一样)的地址。3000 和 5001 端口不同,算不同源,浏览器会把跨过去的请求拦下来,报 **CORS** 错误。

代理就是来绕开这件事的。它的工作方式是:

```
你的前端代码写:   fetch("/api/properties")     ← 相对路径,浏览器当成 localhost:3000/api/properties
                          │
React 开发服务器(3000)收到,一看是 /api 开头
                          │
                          ▼
   按 proxy 配置,偷偷转发给 http://localhost:5001/api/properties
                          │
                          ▼
              后端(5001)正常响应,原路返回给前端
```

关键点:**在浏览器眼里,请求始终是发给 3000 的**(同源,不触发 CORS);真正的转发发生在开发服务器那一层,浏览器根本不知道。

这带来两个好处:

1. **前端代码里不写后端地址。** 全程用 `/api/...` 相对路径。以后后端换端口、换域名,改一行 proxy 就行,业务代码一个字不动。
2. **不用依赖 CORS。** (你后端其实开了 `cors()`,就算不用代理、直接写 `http://localhost:5001` 也能通。但作业要求用代理,而且代理是更干净的做法 —— 生产环境前后端通常同域部署,代理让开发环境更接近那个样子。)

> Hint 里那句"proxy 只在本地开发有效"是真的:`npm run build` 打出来的生产包不带这个代理,生产环境得靠 Nginx 之类的反向代理或同域部署来转发。开发阶段不用操心。

---

## 5. Requirement 23:API 客户端

新建 `frontend/src/api/client.js`。这是前端唯一碰网络的地方。

```js
// All backend calls funnel through here. Components import these functions and
// never touch fetch directly, so error handling lives in exactly one place.

const BASE = "/api"; // relative path -> the dev-server proxy forwards it to :5001

// One shared helper. Every exported function goes through it so they all get
// the same network-error and HTTP-error handling for free.
async function request(path) {
  let res;
  try {
    res = await fetch(BASE + path);
  } catch (networkError) {
    // fetch only REJECTS on a network-level failure: server down, DNS, refused
    // connection. A 404 or 500 does NOT land here -- fetch resolves for those.
    throw new Error("Cannot reach the server. Is the backend running on port 5001?");
  }

  // KEY: fetch treats 404/500 as a "successful" response, so res.ok is the only
  // thing standing between us and quietly rendering an error page as if it were
  // data. We must check it ourselves.
  if (!res.ok) {
    let detail = "";
    try {
      // Our backend sends { error: "..." } on failures -- surface that text.
      const body = await res.json();
      if (body && body.error) detail = `: ${body.error}`;
    } catch {
      // response had no JSON body; the status code alone will have to do
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }

  return res.json();
}

// GET /api/properties with optional filters/pagination, e.g.
// fetchProperties({ limit: 20, offset: 0, city: "Portland" }).
export function fetchProperties(params = {}) {
  // URLSearchParams turns { limit: 20, city: "Portland" } into "limit=20&city=Portland"
  // and url-encodes the values, so a city with a space can't break the URL.
  const query = new URLSearchParams(params).toString();
  return request(`/properties${query ? `?${query}` : ""}`);
}

// GET /api/properties/:id -- the Week 4 detail endpoint.
export function fetchPropertyDetail(id) {
  return request(`/properties/${encodeURIComponent(id)}`);
}
```

### 这个文件的两个技术核心

**1. `fetch` 的一个大坑:它不把 404/500 当失败。**

很多人以为 `fetch` 遇到 500 会走进 `catch`。**不会。** `fetch` 只在**网络层面**失败时才 reject —— 服务器连不上、DNS 解析不了、连接被拒。只要服务器**给了回应**,哪怕是 500,`fetch` 都算成功 resolve,`await` 正常往下走。

所以必须自己查 `res.ok`(2xx 为 true)。不查的话,后端返回一个 500 错误 JSON,你的前端会把它当正常数据渲染,然后在某个想不到的地方崩。这就是验收标准说的"API client handles HTTP errors and throws meaningful error messages" —— 靠的就是这个 `if (!res.ok)`。

**2. 两种错误,给两种人话。**

- 连不上后端(比如你忘了开后端)→ `catch` 捕获 → 抛"Cannot reach the server"。
- 后端在、但返回了错误(比如 400/404/500)→ `res.ok` 为 false → 把后端 `{ error: "..." }` 里的原话带出来,抛"Request failed (400): limit must be >= 1"。

两种都抛成带**看得懂的话**的 `Error`,上层组件 `catch` 到直接显示给用户就行,不用再翻译。

---

## 6. Requirement 25 + Debug Challenge:照片解析(本周核心)

这是这周最需要认真写的一段。新建 `frontend/src/utils/photos.js`:

```js
// Pulls the first usable photo URL out of a raw L_Photos value.
// L_Photos is a longtext column holding a JSON string like
//   ["https://.../1.jpg", "https://.../2.jpg"]
// ...but not every row holds valid JSON, so every step below guards a real case.
export function getFirstPhotoUrl(rawPhotos) {
  // Case 1: nothing stored. Covers a NULL column AND the empty string "".
  // In your data 381 rows have L_Photos = "", and JSON.parse("") THROWS -- this
  // single line is what stops those rows from crashing the card.
  if (!rawPhotos) return null;

  // Case 2: it is a non-empty string, but is it actually valid JSON?
  let photos;
  try {
    photos = JSON.parse(rawPhotos);
  } catch {
    // Malformed / truncated JSON. Do not let one bad row take down the grid.
    return null;
  }

  // Case 3: it parsed, but into the wrong shape. We need a non-empty ARRAY.
  // JSON.parse("null") -> null, JSON.parse("{}") -> object, JSON.parse("[]") -> []
  // -- none of those have a usable photo, so bail out.
  if (!Array.isArray(photos) || photos.length === 0) return null;

  // Case 4: the array exists, but the first element must be a real URL string,
  // not a number, not an empty string.
  const first = photos[0];
  if (typeof first !== "string" || first.trim() === "") return null;

  return first;
}
```

### 为什么写这么多层 if —— 每一层都对应一种真实数据

我在你库里对 `L_Photos` 做了一次全表体检(53122 行):

| 情况 | 行数 | `JSON.parse` 会怎样 |
|------|------|------|
| 合法非空数组 | 52741 | 正常,能取到 URL |
| **空字符串 `''`** | **381** | **抛 SyntaxError("Unexpected end of JSON input")** |
| NULL | 0 | —(但要防) |
| 非法 JSON | 0 | —(但要防) |
| 空数组 `[]` | 0 | —(但要防) |

所以这周 Debug Challenge 里"有些图裂了"的**真凶就是那 381 行空字符串**。如果你天真地写 `JSON.parse(rawPhotos)[0]`,一碰到这 381 行里的任何一行,整个 `.map()` 渲染就抛异常,可能整页白屏。

那为什么 NULL、非法 JSON、空数组这些**当前是 0 行**的情况我也要防?因为:

1. **数据会变。** 今天 0 行,不代表下次同步数据后还是 0。防御性代码防的是"这类情况",不是"这一批数据"。
2. **作业明确要求。** Checkpoint 原话:"handles missing, **null**, and **malformed** L_Photos values gracefully"。
3. **成本几乎为零。** 多两行 if 而已,换来的是"这个函数对任何输入都不会崩"。

我把这个函数拿真实数据 + 各种边界值跑了一遍,10 种情况全通过:

```
PASS  real valid array (from DB)        ->  "https://api.cotality.com/..."
PASS  empty string '' (381 rows in DB)  ->  null
PASS  null column                       ->  null
PASS  undefined (field not selected)    ->  null
PASS  JSON literal null                 ->  null
PASS  malformed JSON                    ->  null
PASS  object not array                  ->  null
PASS  empty array                       ->  null
PASS  array of empty string             ->  null
PASS  array with non-string first       ->  null
```

**返回 `null` 是刻意的设计。** 这个函数不负责"没有图怎么办",它只负责"要么给你一个能用的 URL,要么诚实地给你 `null`"。至于 `null` 时显示什么占位图,是卡片组件的事(下一节)。一个函数只干一件事,职责清楚。

> **一个顺带的知识点:** 你库里存的原始值长这样 `["https:\/\/api.cotality.com\/..."]`,里面是 `\/` 而不是 `/`。这是 JSON 里对斜杠的合法转义,`JSON.parse` 会自动把 `\/` 还原成 `/`,你**不用**做任何额外处理。我实测过,解析出来就是正常的 `https://` 开头的 URL。
>
> **还有个惊喜:** 我拿真实照片 URL 试了下能不能访问 —— 它会 302 跳转到 CDN(`media.crmls.org`),最终返回一张真的 12 万字节的 JPEG。浏览器的 `<img>` 会自动跟随跳转,所以图能正常显示。也就是说,52741 行有图的能显示,381 行空的走占位 —— 完美对应作业说的"有的裂有的不裂"。

---

## 7. Requirement 24 & 25:PropertyCard 组件

新建 `frontend/src/components/PropertyCard.js`:

```js
import { useState } from "react";
import { getFirstPhotoUrl } from "../utils/photos";
import "./PropertyCard.css";

// Beds/baths/sqft can be NULL in the data. Show an em dash instead of "null"
// or a misleading "0". (In your data: 101 null beds, 17 null baths, 84 null sqft.)
function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US"); // adds thousands separators: 7130 -> "7,130"
}

// Price is always present in the data, but guard anyway -- a card should never
// print the word "null" at the user.
function formatPrice(price) {
  if (price === null || price === undefined) return "Price unavailable";
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0, // $3,950,000 not $3,950,000.00
  });
}

function PropertyCard({ property }) {
  const photoUrl = getFirstPhotoUrl(property.L_Photos);

  // KEY: even a valid URL can 404 at load time. This flag lets us fall back to
  // the placeholder if the <img> fails, instead of showing a broken-image icon.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = photoUrl && !imageFailed;

  // "Beverly Hills, CA" -- filter(Boolean) drops any missing piece so we never
  // render a stray leading comma like ", CA".
  const cityState = [property.L_City, property.L_State].filter(Boolean).join(", ");

  return (
    <article className="card">
      <div className="card-photo">
        {showImage ? (
          <img
            src={photoUrl}
            alt={property.L_Address || "Property photo"}
            loading="lazy" // don't download off-screen images until scrolled to
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="card-photo placeholder">No photo available</div>
        )}
      </div>

      <div className="card-body">
        <p className="card-price">{formatPrice(property.price)}</p>
        <p className="card-address">{property.L_Address || "Address unavailable"}</p>
        <p className="card-location">{cityState}</p>

        <ul className="card-specs">
          <li><strong>{formatNumber(property.beds)}</strong> bd</li>
          <li><strong>{formatNumber(property.baths)}</strong> ba</li>
          {/* sqft of 0 means "unknown" here, so treat 0 like null */}
          <li><strong>{property.sqft ? formatNumber(property.sqft) : "—"}</strong> sqft</li>
        </ul>
      </div>
    </article>
  );
}

export default PropertyCard;
```

### 几个值得注意的点

**照片的两层兜底。** 第一层是 `getFirstPhotoUrl` 返回 `null`(数据里没有合法图);第二层是 `onError`(URL 看着没问题,但加载时 404 了)。两层都会落到同一个"No photo available"占位块。**为什么占位用一个 `<div>` 而不是一张占位图片?** 因为占位图也要从网上下载,它自己也可能挂;用纯 CSS 画的块永远不会失败,最稳。

**null 数字显示 `—`,不显示 `0`。** 我查过:你库里有 101 行卧室为 null、17 行卫生间为 null、84 行面积为 null,还有 108 行面积是 `0`。`0 sqft` 是没意义的(不可能真有 0 平方英尺的房子),所以面积那行我特意把 `0` 也当成"未知"显示成 `—`。卧室卫生间则只把 null 当未知。这种区别看着琐碎,但它决定了用户看到的是"—"还是一个误导人的"0"。

**`.filter(Boolean)` 这个小技巧。** `[property.L_City, property.L_State]` 里万一某个是空的,直接 `join(", ")` 会得到 `", CA"` 这种带头逗号的丑东西。`filter(Boolean)` 先把空值(null、undefined、空字符串)筛掉,再拼,就干净了。

**`toLocaleString`。** 价格 `3950000` 直接显示很难读,`toLocaleString` 带上 `currency` 选项自动变成 `$3,950,000`;面积 `7130` 变成 `7,130`。不用自己写加逗号的逻辑。

### 卡片样式 + 悬停效果(Requirement:hover effect)

新建 `frontend/src/components/PropertyCard.css`:

```css
.card {
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  overflow: hidden; /* keep the photo's corners inside the rounded card */
  background: #fff;
  display: flex;
  flex-direction: column;

  /* KEY: transition makes the hover change animate smoothly instead of snapping.
     We animate transform + shadow, which are cheap for the browser to redraw. */
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

/* Requirement: cards have a hover effect. Lift the card and deepen its shadow. */
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.card-photo {
  aspect-ratio: 4 / 3; /* every photo box is the same shape, so the grid stays tidy */
  background: #f4f4f4;
}

.card-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* fill the box, crop overflow -- no stretching */
  display: block;
}

.card-photo.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 0.9rem;
}

.card-body { padding: 12px 14px; }

.card-price { font-size: 1.25rem; font-weight: 700; margin: 0 0 4px; }
.card-address { margin: 0; font-weight: 600; }
.card-location { margin: 2px 0 10px; color: #666; font-size: 0.9rem; }

.card-specs {
  display: flex;
  gap: 14px;
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid #f0f0f0;
  padding-top: 10px;
  color: #444;
  font-size: 0.9rem;
}
```

悬停效果的原理:`transition` 声明"这些属性变化时,用 0.15 秒平滑过渡";`.card:hover` 定义"鼠标悬停时,往上移 4px + 加深阴影"。之所以选 `transform` 和 `box-shadow` 来做动画,是因为这两个属性浏览器重绘起来很便宜,不会引起整页重新排版,动画流畅。

---

## 8. Requirement 24 & 26:ListingsPage 组件

新建 `frontend/src/pages/ListingsPage.js`。它负责管状态和布局。

```js
import { useEffect, useState } from "react";
import { fetchProperties } from "../api/client";
import PropertyCard from "../components/PropertyCard";
import "./ListingsPage.css";

const PAGE_SIZE = 20;

function ListingsPage() {
  // One explicit status string instead of separate loading/error booleans.
  // At any moment the page is in exactly ONE of these, which makes the render
  // logic below a clean either/or with no impossible combinations.
  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [data, setData] = useState(null);          // { total, limit, offset, results }
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // KEY: this guard prevents a warning/bug where the request finishes AFTER
    // the component has unmounted (or React StrictMode re-runs the effect in
    // dev). Without it we could call setState on a component that is gone.
    let cancelled = false;

    setStatus("loading");
    fetchProperties({ limit: PAGE_SIZE, offset: 0 })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        // err.message is the human-readable string our API client threw.
        setErrorMessage(err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true; // cleanup: runs if the component unmounts mid-request
    };
  }, []); // empty deps -> run once when the page first mounts

  // Requirement: loading state shows while fetching.
  if (status === "loading") {
    return <p className="state">Loading properties…</p>;
  }

  // Requirement: error message shows if the backend is unreachable.
  if (status === "error") {
    return (
      <p className="state state-error">
        Could not load properties — {errorMessage}
      </p>
    );
  }

  // status === "ready"
  return (
    <section>
      {/* Requirement: "Showing 20 of 487 properties" */}
      <p className="count">
        Showing {data.results.length} of {data.total} properties
      </p>

      <div className="grid">
        {data.results.map((property) => (
          // key must be stable + unique; the listing id is perfect for it
          <PropertyCard key={property.L_ListingID} property={property} />
        ))}
      </div>
    </section>
  );
}

export default ListingsPage;
```

### 关键概念

**`useEffect` 是什么、为什么在这拉数据。** 组件函数本身只负责"根据当前 state 画出 UI",它不该在渲染过程里做网络请求(那会导致重复请求、甚至无限循环)。`useEffect` 是 React 给你的"渲染之后做副作用"的口子。`[]` 这个空依赖数组的意思是"只在组件第一次挂载时跑一次" —— 正好符合"页面打开时加载一次数据"。

**为什么用一个 `status` 字符串,而不是 `isLoading` + `isError` 两个布尔?** 因为两个布尔能组合出四种状态,其中"既在加载又出错"是不可能但代码上允许的,容易写出矛盾。一个 `status` 只能是三选一,渲染时 `if` 一路挡下来,干净、不会自相矛盾。这叫"用状态机的思路管 UI 状态"。

**`cancelled` 那个清理函数。** React 18 的开发模式(StrictMode)会**故意把 effect 跑两次**来帮你发现 bug;另外用户也可能在请求还没回来时就离开页面。这两种情况下,如果请求回来还去 `setData`,React 会警告"在已卸载的组件上更新 state"。`cancelled` 标志 + `return () => { cancelled = true }` 就是标准的防护写法:请求回来先看看"我还需要这个结果吗",不需要就直接丢弃。

**`.map()` 里的 `key`。** React 靠 `key` 来追踪列表里每一项,高效地知道哪项变了、哪项该复用。`key` 必须**稳定且唯一**,房源的 `L_ListingID` 天生就是,别用数组下标(下标会随排序/增删变化,导致 React 认错)。

### 网格布局

新建 `frontend/src/pages/ListingsPage.css`:

```css
.grid {
  display: grid;
  /* KEY: auto-fill + minmax = responsive with zero media queries.
     "Fit as many columns as you can, each at least 260px; share leftover space."
     Wide screen -> more columns; narrow screen -> fewer, automatically. */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.count {
  margin: 0 0 16px;
  color: #555;
  font-size: 0.95rem;
}

.state {
  padding: 40px;
  text-align: center;
  color: #666;
  font-size: 1.1rem;
}

.state-error {
  color: #b00020; /* red so a failure reads as a failure */
}
```

那行 `repeat(auto-fill, minmax(260px, 1fr))` 是这周布局的精华:它让网格**自动响应式** —— 屏幕宽就多排几列,屏幕窄就少排几列,每列最小 260px,不用写任何 `@media` 断点。

---

## 9. 把页面接进 App

CRA 默认的 `frontend/src/App.js` 是一堆样板,直接替换成:

```js
import ListingsPage from "./pages/ListingsPage";
import "./App.css";

function App() {
  return (
    <main className="app">
      <h1>Property Listings</h1>
      <ListingsPage />
    </main>
  );
}

export default App;
```

`frontend/src/App.css` 给点基础留白就行(可选):

```css
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 60px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.app h1 {
  margin: 0 0 20px;
}
```

`src/index.js` 不用动,CRA 已经把 `<App />` 挂载好了。

---

## 10. 跑起来 & 手动测试

需要**两个终端**,前后端各一个。

**终端 1 —— 后端(5001):**

```bash
docker start idx-mysql-local   # 确保数据库开着
cd backend
npm run dev                    # 现在监听 5001
```

**终端 2 —— 前端(3000):**

```bash
cd frontend
npm start                      # 自动打开浏览器到 localhost:3000
```

浏览器会自动打开 `http://localhost:3000`,你应该看到一格一格的房源卡片,带真实照片、价格、地址。

### 对着验收标准逐条自测

| 验收项 | 怎么测 |
|------|------|
| 网格显示真实数据 | 页面一打开就有卡片,照片/价格/地址都是真的 |
| L_Photos 正确解析、显示第一张图 | 卡片上有真实房屋照片 |
| Loading 状态 | 刷新页面的一瞬间会闪过"Loading properties…" |
| 错误状态 | **把终端 1 的后端 Ctrl+C 关掉**,再刷新前端 → 应显示红色"Could not load properties — Cannot reach the server…" |
| 数量显示 | 顶部有"Showing 20 of 53122 properties" |
| 悬停效果 | 鼠标移到卡片上,卡片上浮 + 阴影加深 |
| 有些图裂、有些正常(Debug Challenge) | 绝大多数卡片有图;碰到那 381 行空数据的房源,显示"No photo available"占位,而不是崩溃 |

**测错误状态是最容易被忽略的一条,一定要试:** 关掉后端再刷新前端,确认你看到的是一句人话错误,而不是白屏或者浏览器控制台一堆红字。这直接验证了 API 客户端的错误处理。

---

## 11. Debug Challenge 完整答案

> 🐛 卡片接上后,有些房源图裂了,有些正常。查清楚:`L_Photos` 一定是合法 JSON 数组吗?没有照片的房源里它存的是什么?写防御性代码处理所有情况,别崩。

**逐问回答:**

**1. `L_Photos` 一定是合法 JSON 吗?** 不是。我全表扫了 53122 行:52741 行是合法非空数组,但 **381 行是空字符串 `''`**。空字符串不是合法 JSON,`JSON.parse('')` 会抛 `SyntaxError: Unexpected end of JSON input`。

**2. 没照片的房源里存的是什么?** 就是那个空字符串 `''`(不是 `null`,不是 `[]`,是零长度字符串)。我在数据库端验证时,对这些行调 `JSON_LENGTH(L_Photos)` 直接报错 `The document is empty` —— 跟浏览器里 `JSON.parse('')` 抛错是同一回事。

**3. 为什么"有的裂有的不裂"?** 因为只有那 381 行会让解析抛错。如果你写的是没保护的 `JSON.parse(rawPhotos)[0]`,大部分房源(有合法数组的)正常显示,一旦渲染到这 381 行中的某一行,`.map()` 就抛异常 —— 表现出来就是"部分裂,甚至整页白"。

**修复:** 就是第 6 节那个 `getFirstPhotoUrl`,层层设防:

- `if (!rawPhotos)` 挡住 `''` 和 `null`(这一行就解决了那 381 行);
- `try/catch` 包住 `JSON.parse` 挡住任何非法 JSON;
- `Array.isArray` + 长度检查挡住 `null`/对象/空数组;
- 首元素类型检查挡住数组里不是字符串 URL 的情况。

任何一种情况都安静地返回 `null`,卡片显示"No photo available"占位,**一行坏数据也不会拖垮整个网格**。这就是"defensive code that handles all cases without crashing"。

---

## 12. Week 5 Checkpoint 对照

| 验收项 | 靠什么满足 |
|------|-----------|
| React 应用跑在 3000 且无报错 | CRA 默认端口;后端挪到 5001 避开冲突 |
| 网格显示数据库真实数据 | 后端列表接口扩了字段 + ListingsPage 渲染 |
| L_Photos 正确解析成 JSON 数组、显示首图 | `getFirstPhotoUrl` |
| Loading 状态 | `status === "loading"` 分支 |
| 后端不可达时显示错误 | API 客户端 `catch` + ListingsPage `state-error` 分支 |
| 数量显示("Showing 20 of ...") | `data.results.length` / `data.total` |
| 卡片有悬停效果 | `.card:hover` 的 transform + shadow |
| API 客户端处理 HTTP 错误、抛有意义的错误 | `request()` 里的 `res.ok` 检查 |
| 照片解析处理缺失/null/畸形值不崩 | `getFirstPhotoUrl` 的四层防御 |
| API 错误被捕获并展示给用户 | 全链路:client 抛 → page catch → 红字显示 |

### 你需要能讲清楚的三件事

1. **代理为什么存在:** 前端(3000)和后端(5001)不同源,浏览器同源策略会拦跨源请求。代理让前端用 `/api` 相对路径请求,开发服务器在背后转发给 5001,浏览器眼里始终是同源,绕开 CORS,前端代码也不用写死后端地址。

2. **`fetch` 为什么要查 `res.ok`:** `fetch` 只在网络层失败时才 reject,404/500 这种"服务器有回应但是错误"它照样 resolve。不查 `res.ok`,前端会把错误响应当正常数据渲染。

3. **图为什么有的裂:** `L_Photos` 里有 381 行是空字符串,`JSON.parse('')` 抛错。防御做法是先判空、再 try/catch 包住解析、再校验是不是非空数组、首元素是不是字符串,任一不满足就返回 null 走占位图。

---

## 附:我为你验证过的东西

这份文档不是照着套路写的,下面几条都在你的真实环境跑过:

- **列名和取值**:照片/地址/州/面积的真实列名(尤其 `LM_Int2_3` = 居住面积)是我扫遍数字列的取值范围确认的,不是猜的。
- **`L_Photos` 全表体检**:52741 合法 / 381 空字符串 / 0 null / 0 非法,首元素是带 `\/` 转义的 URL 字符串。
- **照片 URL 真能显示**:实测 302 跳转到 CDN,返回真实 JPEG。
- **防御解析函数**:10 种边界(含真实 DB 值)全通过。
- **null 字段统计**:101 null 卧室 / 17 null 卫生间 / 84 null 面积 / 108 零面积 —— 卡片的 `—` 处理就是为这些准备的。
- **CRA 在你的 Node 22 上**:能装、能 build(退出码 0),没撞 OpenSSL。

> 提醒:数据库容器 `idx-mysql-local` 我这次帮你重启过(它之前停了,而且有一次端口映射没挂上,我 stop/start 修好了)。你跟着做的时候如果连不上 5001 背后的数据库,先 `docker start idx-mysql-local` 等几秒再试。
