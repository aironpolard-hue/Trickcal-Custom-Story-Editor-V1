# DSL 与运行时现状

## 声明素材

新项目在清单中启用 `strictAssets`，角色、图片和音频必须先声明再使用；名称区分大小写，且不能重复。路径相对于项目目录，限定在 `assets` 中。没有启用该选项、且没有显式声明的旧剧本继续使用项目清单中的素材；只要使用了任意显式声明，也会启用声明检查。早期 `asset` 语法仍可编译，但新剧本推荐使用下面的形式。

```trickcal
image ner_avatar = "assets/herohead/ner.png"
define ner = Spine("assets/spine/standing/ner", name="内尔", avatar=ner_avatar, avatarBg="#9fc766")
image station = "assets/bg/elf_city_night.png"
define audio.rain = "assets/audio/silent.wav"

scene bg station
show ner at left pose Idle_1
audio play rain loop
ner think "雨还没有停。"
audio stop rain fadeOut 1s
```

`Spine(...)` 是本引擎的扩展，不是 Ren'Py 原生语句或 Python 求值；它同时注册舞台模型及说话者名称。Spine 文件夹目前需要恰好一组同名 `.skel.bytes` 和 `.atlas.txt`，以及 atlas 引用的贴图。`name` 是显示名称，可省略。图片可以用作背景或 `spawn image station as picture at 960,540`。`audio` 命令在下一条可播放剧情上执行；教程里的音频是静音占位文件。

Spine 声明使用播放器同版本的 atlas 解析器检查贴图页及路径：缺失贴图、空 atlas 和越过项目 `assets` 的路径会在声明行报错；导入素材时贴图必须位于所选文件夹内，避免复制后丢失。检查不解析骨骼数据、不校验图片内容或 Spine 版本，也不覆盖依赖清单的旧式项目。

头像先以 `image` 声明，再通过角色的 `avatar` 指定；`avatarBg` 设置独白头像底色。台词可写 `name "名称" avatar ner_avatar avatarBg "#75a659"` 单句覆盖。漫画箭头尾巴可用预设参数或行内 `tail bl/br/tl/tr` 及中文方向指定。

变量用受限表达式，不执行任意代码。`default` 支持数字、布尔值和双引号字符串初值；`set` 支持 `=` 与数值复合赋值；`if`/`else` 支持比较、`and`、`or`、`not`、括号及基础算术。choice 选项可追加 `if 表达式`，条件不成立时不可选。变量必须先声明，编译器会检查未知变量和类型不匹配。编辑器跳转预览能恢复已访问行的变量快照；未访问路线从默认初值开始，不会猜测用户尚未作出的分支选择。当前没有变量存档文件或用户自定义代码求值。

导入按钮会把素材复制到项目并登记清单；使用上述显式声明模式时，还需在剧本中写对应声明。引擎自带 UI 贴图和字体目前仍由运行时加载，不属于这些用户素材声明。

本 DSL 只借鉴 Ren'Py 的部分写法，尚不兼容其通用表达式、`Character()`、多属性图片、初始化时求值或 `play music` 等语句。这里的声明按源文件顺序生效。

## 已有预设

项目的 `presets` 目录包含普通、云朵、爆炸、独白、漫画气泡、思考气泡、紫色内心气泡、紫色内心独白框、章节开场、地点标识、新闻框、全屏文字和转场等预设。对话预设用于下一条支持预设的对话；章节开场、地点标识、新闻、全屏文字和转场预设分别用于对应语句，不负责替用户生成这些剧情语句。例如：

```trickcal
preset 紫色内心气泡
ner manga "……又迟到了。" bubble 820,520
preset 紫色内心独白框
ner clear "今晚会很漫长。"
```

漫画气泡支持宽度、文字宽度、最小和最大高度，并提供增长、缩字、滚动和裁切模式；增长超过高度上限时会滚动。滚动区域支持鼠标滚轮与触摸拖动，完整用法及缩字下限见《新手使用手册》。

`manga` 使用箭头尾巴；`think` 使用圆点尾巴。紫色内心漫画气泡预设应搭配 `manga`。

`news anchor "..."`、`news summary "..."`、`fullscreen "..."` 和 `transition` 均可使用对应预设；新闻与全屏文字支持文字、逐字速度、变换，新闻另支持阴影。转场支持样式和时长，但属于引擎绘制。

两个新闻框共用游戏资源中的 `Dialogue_NewsText_Entry` 根缩放曲线，当前由 Canvas 播放器重放；`preset 新闻框·主播 entryDuration 0.8` 可单次改变入场播放时长。具体证据及近似范围见《UI 动画资源核对》。

## 目前的边界

- 普通对话框、气泡和逐字效果按剧情行使用。独立 `ui` 对象实验命令仅为旧项目兼容保留，不再开发，也不纳入当前教程。
- `parallel`（别名 `同时`）支持一条角色台词（可直接写 `ner normal "..."`，也兼容 `say ner normal "..."`）、`narration`、`cloud` 或 `sfx`，以及移动、镜头及画面效果的设置和部分补间、角色 `anim`/`skin`、背景即时切换/交叉淡化、着色器、音频和等待；这些语句可用 `after 0.5s:` 或 `after 500ms:` 延迟。背景渐变使用 `scene bg <名称> in 500ms ease Linear`，默认缓动为 `OutCubic`。`preset` 按书写顺序作用于块内下一条兼容对话；没有对话时不会泄漏至块外。无台词时也可等待并自动继续。它尚不支持任意语句、多条同时显示的台词或控制流语句并发；不适合把 `choice`、`jump`、`label` 等控制流塞进并行块。提前翻页的具体规则见《新手使用手册》。
- 内置着色器仅支持 `heat`、`dream`、`gray`、`glitch`、`wave`。自定义片元着色器必须是项目 `assets/shaders/` 下的 `.frag` 文件；编译检查验证相对路径与文件存在。加载或 WebGL 编译失败时会显示非致命效果警告并继续剧情。
- `parallel` 还支持延时角色和图片的 `show`、`hide`、`bind` 与 `unbind`；图片显示支持位置、缩放、旋转、透明度、亮度和层级，绑定偏移使用父级本地坐标。正常播放提前翻页后，已发生的舞台及环境状态可沿条件、选项、跳转和转场继续；未访问段预览、复杂绑定与移动混合及多个同时显示的对话仍有边界。
- 已声明的 Spine 素材可用 `oneshot spine 名称 anim 动画` 在并行块里播放一次性表情，可用 `after` 延时；自动等待动画结束，手动翻页会停止表情。动画名不存在时目前回退到素材第一个动画；加载错误记录在控制台。
- Windows 使用 Electron，Android 使用 Capacitor/WebView；它们是可安装的桌面和手机应用，但渲染与逻辑不是平台原生实现。真正原生运行时需要独立技术选型和移植。
- UI 动画以提取资源与数据为依据在 Canvas 中重放，不等于直接运行 Unity 动画；部分效果仍为近似，详见素材来源说明。
- 构建先在临时目录完成，再将同平台的旧输出移至 `build/archive/<平台>/` 并发布新输出；构建失败时原输出保留。归档不会自动删除，可能占用较多空间。源文件和已有构建不会因为编辑剧本而自动更新；请从编辑器重新构建。

## Android 构建签名

未配置正式签名时，Android 构建生成 `TrickcalStory-debug.apk`，供本地安装测试，不适合发布。正式发布需自行安全保管签名密钥，并在启动引擎的环境中同时设置 `TRICKCAL_ANDROID_KEYSTORE`、`TRICKCAL_ANDROID_STORE_PASSWORD`、`TRICKCAL_ANDROID_KEY_ALIAS`、`TRICKCAL_ANDROID_KEY_PASSWORD`。四项均有效时才生成 `TrickcalStory-release.apk`；配置不完整会报错，不会静默降级。密钥文件不会被复制到新构建目录或 APK。

旧的 Android 构建可能已经包含原来的共享密钥与硬编码密码，不能作为安全的正式签名配置，也不要将整个旧构建目录作为发布包。已存在的用户文件不会自动删除；已有正式发布签名的更新兼容性需要使用原有签名密钥确认。

默认 Android 应用 ID 由项目 `id` 稳定生成，避免不同剧情互相覆盖；需要固定 ID 时，可在项目清单中设置 `"android": { "applicationId": "com.example.story" }`。要覆盖安装旧版本，应用 ID 和签名都必须与旧版本一致；更改其中任意一项都会影响升级路径。
