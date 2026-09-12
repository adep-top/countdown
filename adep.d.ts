/**
 * AgentDeploy \u4E91\u51FD\u6570\u5F00\u53D1\u73AF\u5883\u7C7B\u578B\u58F0\u660E\uFF08\u90E8\u7F72\u5305 / adep init \u751F\u6210\uFF0C\u8BF7\u52FF\u624B\u6539\uFF09\u3002
 *
 * \u672C\u6587\u4EF6\u662F @adep/types \u7684\u6E90\u7801\u6587\u672C\u955C\u50CF\uFF1A\u4E3A\u51FD\u6570\u6E90\u7801\u91CC\u7684 ctx \u63D0\u4F9B method/path/query/
 * headers/body/files/user \u4E0E cloud.db / cloud.storage / cloud.fetch / cloud.realtime \u7684\u5B8C\u6574\u8865\u5168\u3002
 * \u5168\u5C40 ctx \u4E0E AdepContext \u662F\u5F00\u53D1\u671F\u4E0A\u4E0B\u6587\uFF08\u7F16\u8F91\u5668\u8865\u5168\u7528\uFF09\uFF1B\u51FD\u6570\u8FD0\u884C\u671F\u7ECF\u53C2\u6570\u6CE8\u5165\uFF0C\u4E0D\u8BFB\u53D6\u5168\u5C40\u3002
 * \u7C7B\u578B\u5951\u7EA6\u7684\u5355\u4E00\u771F\u76F8\u6E90\u89C1 packages/types\uFF08\u4EFB\u52A1\u5355 CORE-006\uFF09\u3002
 */

/* ---------- HTTP \u89E6\u53D1\u4E0A\u4E0B\u6587\uFF08FunctionContext \u955C\u50CF\uFF09 ---------- */

type AdepHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/* ---------- \u6587\u4EF6\u4E0E\u5B58\u50A8\uFF08CloudStorage \u955C\u50CF\uFF09 ---------- */

/** multipart \u4E0A\u4F20\u7684\u6587\u4EF6\uFF08\u51FD\u6570 HTTP \u89E6\u53D1\u65F6 ctx.files \u4E2D\u7684\u5355\u4E2A\u6587\u4EF6\uFF09\u3002 */
interface AdepFunctionFile {
  /** \u5BA2\u6237\u7AEF\u63D0\u4F9B\u7684\u6587\u4EF6\u540D\uFF08\u542B\u6269\u5C55\u540D\uFF09\u3002 */
  name: string
  /** MIME \u7C7B\u578B\u3002 */
  type: string
  /** \u5B57\u8282\u6570\u3002 */
  size: number
  data: Uint8Array
}

/** \u4E0A\u4F20\u6570\u636E\uFF1A\u6587\u672C\u3001\u4E8C\u8FDB\u5236\u3001\u6216\u76F4\u63A5\u900F\u4F20\u8BF7\u6C42\u91CC\u7684\u6587\u4EF6\u5BF9\u8C61\u3002 */
type AdepStorageUploadData = string | Uint8Array | ArrayBuffer | AdepFunctionFile

type AdepFileVisibility = 'public' | 'private'

/** \u4E0A\u4F20 / \u5217\u4E3E\u8FD4\u56DE\u7684\u6587\u4EF6\u5143\u6570\u636E\uFF08\u4E0D\u542B\u5185\u5BB9\uFF09\u3002 */
interface AdepStoredFile {
  /** \u6876\u5185\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u5982 avatars/avatar.png\u3002 */
  path: string
  size: number
  contentType?: string
  visibility: AdepFileVisibility
  /** ISO 8601 \u65F6\u95F4\u6233\u3002 */
  updatedAt?: string
}

interface AdepCloudStorage {
  /** \u4E0A\u4F20 / \u8986\u76D6\u6587\u4EF6\uFF1B\u8DEF\u5F84\u975E\u6CD5\uFF08\u7A7F\u8D8A\u3001\u8D85\u9650\uFF09\u7531\u5B9E\u73B0\u629B\u9519\u3002 */
  upload(path: string, data: AdepStorageUploadData): Promise<AdepStoredFile>
  /** \u8BFB\u53D6\u6587\u4EF6\u5185\u5BB9\uFF1B\u4E0D\u5B58\u5728\u65F6\u629B STORAGE_NOT_FOUND\u3002 */
  get(path: string): Promise<Uint8Array>
  /** \u5220\u9664\u6587\u4EF6\uFF1B\u4E0D\u5B58\u5728\u65F6\u629B STORAGE_NOT_FOUND\u3002 */
  remove(path: string): Promise<void>
  /** \u6309\u524D\u7F00\u5217\u4E3E\uFF08\u7F3A\u7701\u5168\u6876\uFF09\u3002 */
  list(prefix?: string): Promise<AdepStoredFile[]>
  /** \u751F\u6210\u7B7E\u540D URL\uFF08private \u6587\u4EF6\u7684\u5916\u53D1\u901A\u9053\uFF09\uFF1B\u7F3A\u7701 TTL 15 \u5206\u949F\u3002 */
  getSignedUrl(path: string, ttlSeconds?: number): Promise<string>
}

/* ---------- \u6570\u636E\u5E93\uFF08CloudDb \u955C\u50CF\uFF09 ---------- */

/** \u53EF\u7ED1\u5B9A\u5230 SQLite \u7684\u53C2\u6570\u503C\u3002 */
type AdepSqlValue = string | number | bigint | boolean | null | Uint8Array

/** where(col, op, value) \u652F\u6301\u7684\u6BD4\u8F83\u7B26\u3002 */
type AdepSqlOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'in' | 'not in'

/** \u4E00\u884C\u67E5\u8BE2\u7ED3\u679C\u3002\u5217\u7C7B\u578B\u7F16\u8BD1\u671F\u672A\u77E5\uFF08\u8FD0\u884C\u65F6\u5EFA\u8868\uFF09\uFF0C\u7531\u7528\u6237\u4EE3\u7801\u81EA\u884C\u6536\u7A84\u3002 */
type AdepRow = Record<string, unknown>

/** owned \u8868\u53D8\u66F4\u64CD\u4F5C\u7C7B\u578B\u3002 */
type AdepChangeOp = 'insert' | 'update' | 'delete'

/** owned \u8868 __changes \u53D8\u66F4\u6D41\u8BB0\u5F55\uFF08\u8FFD\u52A0\u5F0F\u3001\u53EF\u91CD\u653E\uFF1Bbefore/after \u4E3A\u6574\u884C\uFF0C\u672A\u6D89\u53CA\u4FA7\u4E3A null\uFF09\u3002 */
interface AdepChangeRecord {
  /** \u8868\u5185\u81EA\u589E\u5E8F\u53F7\uFF08\u65F6\u95F4\u5347\u5E8F\uFF0C\u91CD\u653E\u987A\u5E8F\u4F9D\u636E\uFF09\u3002 */
  seq: number
  /** \u53D8\u66F4\u65F6\u95F4\uFF08ISO 8601\uFF09\u3002 */
  ts: string
  op: AdepChangeOp
  /** \u884C\u4E3B\u952E\uFF08ULID\uFF09\u3002 */
  id: string
  /** \u884C\u5F52\u5C5E\u5206\u533A\uFF08null = \u672A\u5F52\u5C5E\uFF09\u3002 */
  ownerKey: string | null
  /** \u53D8\u66F4\u524D\u6574\u884C\uFF08insert \u4E3A null\uFF09\u3002 */
  before: AdepRow | null
  /** \u53D8\u66F4\u540E\u6574\u884C\uFF08delete \u4E3A null\uFF09\u3002 */
  after: AdepRow | null
}

/** cloud.db.changes(table, query) \u7684\u8FC7\u6EE4\u6761\u4EF6\uFF08\u5168\u90E8\u53EF\u9009\uFF09\u3002 */
interface AdepChangeQuery {
  /** \u53EA\u53D6 seq > afterSeq\uFF08\u589E\u91CF\u62C9\u53D6 / \u6536\u4EF6\u6279\u6B21\uFF09\u3002 */
  afterSeq?: number
  /** \u53EA\u53D6\u67D0\u5206\u533A\u884C\uFF1Bnull = \u53EA\u53D6\u672A\u5F52\u5C5E\u884C\uFF08\u7F3A\u7701\u4E0D\u8FC7\u6EE4\uFF09\u3002 */
  ownerKey?: string | null
  /** \u6700\u591A\u8FD4\u56DE\u6761\u6570\uFF08\u914D\u5408 afterSeq \u505A\u5206\u9875\uFF09\u3002 */
  limit?: number
}

/**
 * \u5355\u8868\u94FE\u5F0F Builder\u3002\u6240\u6709\u94FE\u5F0F\u65B9\u6CD5\u8FD4\u56DE\u65B0 Builder\uFF08\u4E0D\u53EF\u53D8\uFF09\uFF0C\u7EC8\u503C\u65B9\u6CD5
 * \uFF08get/first/count/insert/update/delete\uFF09\u8FD4\u56DE Promise\u3002\u590D\u7528\u540C\u4E00 Builder
 * \u5B9E\u4F8B\u6D3E\u751F\u591A\u4E2A\u67E5\u8BE2\u662F\u5B89\u5168\u7684\uFF08\u5B9E\u73B0\u4E0D\u5F97\u6709\u5171\u4EAB\u53EF\u53D8\u72B6\u6001\uFF09\u3002
 */
interface AdepCloudDbTable {
  /** \u9650\u5B9A\u8FD4\u56DE\u5217\uFF1B\u4E0D\u8C03\u5373 select *\u3002 */
  select(...columns: string[]): AdepCloudDbTable
  /** \u58F0\u660E\u4E3A owned \u8868\uFF08DB-006\uFF09\uFF1A\u5199\u5165\u81EA\u52A8\u751F\u6210 ULID \u4E3B\u952E + \u8FFD\u52A0 __changes \u53D8\u66F4\u6D41\u3002 */
  owned(): AdepCloudDbTable
  /** \u7B49\u503C\u8FC7\u6EE4\uFF1Awhere('status', 'active')\u3002 */
  where(column: string, value: AdepSqlValue): AdepCloudDbTable
  /** \u5E26\u64CD\u4F5C\u7B26\u8FC7\u6EE4\uFF1Awhere('age', '>', 18)\u3002 */
  where(
    column: string,
    operator: AdepSqlOperator,
    value: AdepSqlValue | readonly AdepSqlValue[]
  ): AdepCloudDbTable
  orderBy(column: string, direction?: 'asc' | 'desc'): AdepCloudDbTable
  limit(n: number): AdepCloudDbTable
  offset(n: number): AdepCloudDbTable
  /** \u7ED3\u679C\u6570\u7EC4\uFF08\u53EF\u80FD\u4E3A\u7A7A\uFF09\u3002 */
  get(): Promise<AdepRow[]>
  /** \u9996\u884C\u6216 null\u3002 */
  first(): Promise<AdepRow | null>
  /** \u884C\u6570\uFF08\u5FFD\u7565 select/orderBy\uFF09\u3002 */
  count(): Promise<number>
  /** \u63D2\u5165\u4E00\u884C\uFF1Bwhere \u5BF9\u63D2\u5165\u65E0\u610F\u4E49\u3002 */
  insert(row: Record<string, AdepSqlValue>): Promise<void>
  /** \u6279\u91CF\u63D2\u5165\u3002 */
  insertMany(rows: ReadonlyArray<Record<string, AdepSqlValue>>): Promise<void>
  /** \u66F4\u65B0\uFF08\u5FC5\u987B\u5148 where\uFF0C\u5426\u5219 DB_UNSAFE_OP\uFF09\uFF1B\u8FD4\u56DE\u53D7\u5F71\u54CD\u884C\u6570\u3002 */
  update(values: Record<string, AdepSqlValue>): Promise<number>
  /** \u5220\u9664\uFF08\u5FC5\u987B\u5148 where\uFF0C\u5426\u5219 DB_UNSAFE_OP\uFF09\uFF1B\u8FD4\u56DE\u53D7\u5F71\u54CD\u884C\u6570\u3002 */
  delete(): Promise<number>
}

/** \u9879\u76EE\u6570\u636E\u5E93\u53E5\u67C4\uFF08\u95ED\u5305\u5C01\u88C5\uFF1A\u4E0D\u66B4\u9732\u8FDE\u63A5\u4E32\u3001schema \u540D\uFF09\u3002 */
interface AdepCloudDb {
  /** \u6253\u5F00\u5355\u8868 Builder\u3002\u8868\u540D\u7531\u8FD0\u884C\u65F6\u767D\u540D\u5355\u6821\u9A8C\u3002 */
  table(name: string): AdepCloudDbTable
  /** \u4E8B\u52A1\uFF1Afn \u6536\u5230\u540C\u5F62\u72B6\u7684\u53D7\u63A7\u4E8B\u52A1\u53E5\u67C4\uFF1B\u629B\u9519\u5373\u6574\u4F53\u56DE\u6EDA\u3002\u4E8B\u52A1\u5185\u7981\u6B62\u4E8B\u52A1\u5916\u53E5\u67C4\u5199\u672C\u5E93\u3002 */
  transaction<T>(fn: (tx: AdepCloudDb) => Promise<T>): Promise<T>
  /** \u53D7\u63A7\u88F8 SQL\uFF1Bparams \u5FC5\u586B\uFF08\u65E0\u53C2\u4F20 []\uFF09\uFF0C\u5355\u8BED\u53E5\uFF0C\u7981\u591A\u8BED\u53E5\u5806\u53E0\u3002 */
  query(sql: string, params: readonly AdepSqlValue[]): Promise<AdepRow[]>
  /** \u8BFB\u53D6 owned \u8868 __changes \u53D8\u66F4\u6D41\uFF08\u6309 seq \u5347\u5E8F\uFF0C\u53EF\u91CD\u653E\uFF09\u3002 */
  changes(table: string, query?: AdepChangeQuery): Promise<AdepChangeRecord[]>
}

/* ---------- \u53D7\u63A7\u7F51\u7EDC\uFF08CloudFetch \u955C\u50CF\uFF09 ---------- */

/** cloud.fetch \u8BF7\u6C42\u9009\u9879\uFF08\u53D7\u63A7\u5B50\u96C6\uFF0Cbody \u9650\u5236\u4E3A\u5B57\u7B26\u4E32/JSON\uFF0C\u4E8C\u8FDB\u5236\u4E0A\u4F20\u4E0D\u5728\u672C\u80FD\u529B\u8303\u56F4\uFF09\u3002 */
interface AdepCloudFetchInit {
  method?: string
  /** \u8BF7\u6C42\u5934\uFF08\u5C0F\u5199\u5316\u540E\u9010\u6761\u900F\u4F20\uFF09\u3002 */
  headers?: Record<string, string>
  body?: string
  /** \u8C03\u7528\u65B9\u4E2D\u6B62\u4FE1\u53F7\uFF08\u4E0E\u5E73\u53F0\u8D85\u65F6\u53E0\u52A0\uFF0C\u4E8C\u8005\u4EFB\u4E00\u89E6\u53D1\u5373\u4E2D\u6B62\uFF09\u3002 */
  signal?: AbortSignal
}

/** cloud.fetch \u7684\u7ED3\u6784\u5316\u54CD\u5E94\uFF08\u6587\u672C/JSON/\u4E8C\u8FDB\u5236\u8BFB\u53D6\u53D7\u54CD\u5E94\u4F53\u4E0A\u9650\u7EA6\u675F\uFF09\u3002 */
interface AdepCloudFetchResponse {
  ok: boolean
  status: number
  statusText: string
  /** \u5F52\u4E00\u5316\u54CD\u5E94\u5934\uFF08\u952E\u5C0F\u5199\uFF09\u3002 */
  headers: Record<string, string>
  text(): Promise<string>
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
}

/** cloud.fetch\uFF1A\u53D7\u63A7\u7684 HTTPS \u8BF7\u6C42\u3002URL \u4E3B\u673A\u4E0D\u5728\u767D\u540D\u5355\u5219\u629B FN_FETCH_FORBIDDEN\u3002 */
type AdepCloudFetch = (url: string, init?: AdepCloudFetchInit) => Promise<AdepCloudFetchResponse>

/* ---------- \u5B9E\u65F6\u901A\u9053\uFF08CloudRealtime \u955C\u50CF\uFF09 ---------- */

/** \u4E00\u6761\u901A\u9053\u6D88\u606F\uFF08\u4E0E @adep/types \u7684 RealtimeChannelMessage \u5BF9\u9F50\uFF09\u3002 */
interface AdepRealtimeChannelMessage {
  channel: string
  seq: number
  data: unknown
  publishedAt: string
  publisher?: string
}

/** publish \u56DE\u6267\uFF1Adelivered = \u5B9E\u9645\u547D\u4E2D\u7684\u8BA2\u9605\u8FDE\u63A5\u6570\uFF08\u5C3D\u529B\u6295\u9012\uFF0C0 \u662F\u5408\u6CD5\u7ED3\u679C\uFF09\u3002 */
interface AdepCloudRealtimeReceipt {
  delivered: number
}

/** subscribe \u56DE\u6267\uFF1Asubscription \u662F\u540E\u7EED receive / unsubscribe \u7684\u53E5\u67C4\u3002 */
interface AdepCloudRealtimeSubscription {
  subscription: string
  channel: string
}

/**
 * cloud.realtime\uFF1A\u51FD\u6570\u5185\u6536\u53D1\u5B9E\u65F6\u901A\u9053\u6D88\u606F\u3002
 * \u26A0\uFE0F subscribe / receive \u662F\u8F6E\u8BE2\u53D6\u4EF6\u800C\u975E\u56DE\u8C03\u8BA2\u9605\uFF08RPC \u53C2\u6570\u8D70\u7ED3\u6784\u5316\u514B\u9686\uFF0C\u4F20\u4E0D\u4E86\u51FD\u6570\uFF09\u3002
 */
interface AdepCloudRealtime {
  /** except \u4EC5\u7EBF\u4E0A\u652F\u6301\uFF08\u4E0D\u56DE\u53D1\u7ED9\u8BE5\u8FDE\u63A5\uFF09\uFF1B\u672C\u5730 adep dev \u4F20\u7B2C\u4E09\u53C2\u4F1A fail loud\u3002 */
  publish(channel: string, data: unknown, except?: string): Promise<AdepCloudRealtimeReceipt>
  subscribe(channel: string): Promise<AdepCloudRealtimeSubscription>
  receive(subscription: string): Promise<AdepRealtimeChannelMessage[]>
  unsubscribe(subscription: string): Promise<{ removed: true }>
}

/* ---------- \u80FD\u529B\u6302\u8F7D\u70B9\uFF08Cloud / CapabilityRegistry \u955C\u50CF\uFF09 ---------- */

/** \u5DF2\u6CE8\u518C\u80FD\u529B\u540D \u2192 \u5B9E\u73B0\u5951\u7EA6\u7684\u6620\u5C04\u3002\u8BBF\u95EE\u672A\u6CE8\u518C\u80FD\u529B\u8FD0\u884C\u65F6\u629B\u5E26\u53EF\u64CD\u4F5C\u63D0\u793A\u7684\u9519\u8BEF\u3002 */
interface AdepCapabilityRegistry {
  db: AdepCloudDb
  storage: AdepCloudStorage
  /** \u6C99\u7BB1\u53D7\u63A7\u7F51\u7EDC\uFF08GAME-007\uFF09\uFF1A\u672A\u914D\u7F6E\u767D\u540D\u5355\u65F6\u4E0D\u6CE8\u5165\uFF08\u65E0\u7F51\u7EDC\u5B89\u5168\u9ED8\u8BA4\uFF09\u3002 */
  fetch: AdepCloudFetch
  /** \u5B9E\u65F6\u901A\u9053\uFF08FN-020\uFF09\uFF1A\u9879\u76EE\u88C5\u914D realtime \u57DF\u5373\u6CE8\u5165\uFF1B\u8F6E\u8BE2\u8BED\u4E49\u89C1 AdepCloudRealtime\u3002 */
  realtime: AdepCloudRealtime
}

/** \u7528\u6237\u51FD\u6570\u4FA7\u7684 ctx.cloud\uFF1A\u53EA\u80FD\u8BBF\u95EE\u80FD\u529B\u3002\u5DF2\u77E5\u80FD\u529B\u6709\u7CBE\u786E\u8865\u5168\uFF1B\u81EA\u5B9A\u4E49\u80FD\u529B\u7ECF\u7D22\u5F15\u7B7E\u540D\u8BBF\u95EE\u3002 */
type AdepCloud = {
  readonly [K in keyof AdepCapabilityRegistry]: AdepCapabilityRegistry[K]
} & {
  // \u547D\u540D\u5C5E\u6027\u7ED9\u51FA\u7CBE\u786E\u8865\u5168\uFF1B\u7D22\u5F15\u7B7E\u540D\u653E\u884C\u81EA\u5B9A\u4E49\u80FD\u529B\u8BBF\u95EE\uFF08\u8FD0\u884C\u65F6\u672A\u6CE8\u518C\u5373\u629B\u9519\uFF09\u3002
  readonly [capability: string]: unknown
}

/* ---------- \u8C03\u7528\u8005\u8EAB\u4EFD\uFF08ExecutorUser \u955C\u50CF\uFF09 ---------- */

/** \u6267\u884C\u8005\u8EAB\u4EFD\u6295\u5F71\uFF1A\u7F51\u5173\u89E3\u6790\u4F1A\u8BDD\u540E\u6CE8\u5165\uFF1Bnull = \u533F\u540D / \u672A\u6CE8\u5165\uFF08\u900F\u4F20\u4FE1\u606F\uFF0C\u975E\u5F3A\u5236\u95E8\uFF09\u3002 */
interface AdepExecutorUser {
  /** \u5E73\u53F0\u7528\u6237 id\uFF08= better-auth session.user.id\uFF09\u3002 */
  id: string
  email?: string
  name?: string
}

/* ---------- \u5168\u5C40 ctx\uFF08FunctionContext \u955C\u50CF\uFF09 ---------- */

interface AdepContext {
  /** \u8BF7\u6C42\u65B9\u6CD5\u3002 */
  readonly method: AdepHttpMethod
  /** \u89E6\u53D1\u8DEF\u5F84\uFF08\u4E0D\u542B host\uFF09\uFF0C\u5982 /hello\u3002 */
  readonly path: string
  /** \u89E3\u6790\u540E\u7684 query\uFF1B\u540C\u540D\u591A\u503C\u6536\u4E3A\u6570\u7EC4\u3002 */
  readonly query: Readonly<Record<string, string | readonly string[]>>
  /** \u8BF7\u6C42\u5934\uFF08\u952E\u4E3A\u5C0F\u5199\uFF09\u3002 */
  readonly headers: Readonly<Record<string, string>>
  /** \u8BF7\u6C42\u4F53\uFF1B\u5F62\u72B6\u7531\u7528\u6237\u7528\u7C7B\u578B\u65AD\u8A00\u6536\u7A84\uFF08\u5982 ctx.body as { name: string }\uFF09\u3002 */
  readonly body: unknown
  /** multipart \u4E0A\u4F20\u7684\u6587\u4EF6\uFF08\u65E0\u6587\u4EF6\u65F6\u4E3A\u7A7A\u6570\u7EC4\uFF09\u3002 */
  readonly files: readonly AdepFunctionFile[]
  /** \u5E73\u53F0\u80FD\u529B\u6302\u8F7D\u70B9\uFF1Acloud.db / cloud.storage / cloud.fetch / cloud.realtime\u3002 */
  readonly cloud: AdepCloud
  /** \u8C03\u7528\u8005\u8EAB\u4EFD\u6295\u5F71\uFF1Bnull = \u533F\u540D / \u672A\u6CE8\u5165\u3002 */
  readonly user: AdepExecutorUser | null
}

/** \u5168\u5C40\u5F00\u53D1\u671F\u4E0A\u4E0B\u6587\uFF08\u7F16\u8F91\u5668\u8865\u5168\u7528\uFF1B\u51FD\u6570\u8FD0\u884C\u671F\u7ECF\u53C2\u6570\u6CE8\u5165\uFF0C\u4E0D\u8BFB\u53D6\u5168\u5C40\uFF09\u3002 */
declare const ctx: AdepContext
