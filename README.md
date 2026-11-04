# Trickcal 剧情制作引擎

用于制作 Trickcal 同人剧情的非官方桌面工具。通过 `.trickcal` 剧本组织角色、对话、舞台动作和分支，在编辑器中检查与预览，再构建为 Web 页面、Windows 程序或 Android APK。

当前版本为 `0.1.0`，仍在开发中。编辑器使用 Electron + Monaco，播放器使用 Canvas / WebGL 与 Spine WebGL；部分界面和动画依据提取素材与数据重放，部分效果为引擎近似实现。

## AI 辅助制作声明

本项目由作者使用人工智能（AI）工具辅助制作，包括代码与文档的编写和修改，部分内容包含 AI 生成或辅助生成的成果。本声明用于说明制作方式，不改变项目许可及第三方素材的权利归属。完整声明见 [LICENSE.txt](LICENSE.txt)。

## 功能概览

- **剧本编辑**：代码编辑、保存、编译诊断与源行定位，附带离线使用手册和教程项目。
- **对话演出**：普通、云朵、爆炸、独白、漫画及思考气泡，以及旁白、新闻、全屏文字、拟声和动画字幕。
- **预设调整**：预设预览、参数编辑与插入，支持在剧本中覆盖单次演出的参数。
- **角色与舞台**：Spine 角色动作、皮肤、一次性表情，图片显示、层级、绑定、移动、透明度与亮度。
- **时间线**：通过 `parallel`、`after` 和 `wait` 组织台词、动作、镜头、背景、画面效果及音频；编辑器可查看事件并定位预览。
- **分支叙事**：变量、受限表达式、条件、选项、标签与跳转。
- **多端构建**：导出静态 Web 播放器、Windows 桌面播放器和 Android APK，保留同平台的旧构建归档。

## 快速开始

### 环境准备

当前工作流以 Windows 为主。源码运行需要 **Node.js 22.12.0 或更高版本**和 npm；版本要求来自当前 Electron 等依赖。其他桌面系统尚未完整验证。

在项目根目录执行：

```powershell
npm install
npm start
```

安装完成后，也可双击根目录的 `启动引擎.bat`。开发时可运行 `npm run dev`。

首次安装需要下载 npm 依赖及 Electron。日常编辑和本地预览使用本机服务，无需部署远端后端。

源码交付不包含已安装依赖、历史构建、临时预览、缓存、日志或签名密钥。获取源码后请先安装依赖；Android 壳工程的额外依赖见下文。

### 制作第一段剧情

1. 在启动器点击“新建项目”，填写标题、章节数和保存位置。引擎会复制《雨夜的末班车》教程模板并打开编辑器。
2. 也可点击“打开项目”，选择现有项目目录，例如 `projects/雨夜的末班车`。
3. 编辑 `story/main.trickcal`，按 `Ctrl+S` 保存，点击“检查”查看问题。
4. 点击“运行预览”从头播放。文字逐字显示时，首次点击显示全文，再次点击推进。
5. 在预设面板调整样式，或在“舞台”“时间轴”面板检查演出；完成后选择目标平台并点击“构建项目”。

完整教程见 [新手使用手册](docs/新手使用手册.md)。双击 `打开使用手册.bat`，或在启动器、编辑器点击“使用手册”，即可查看支持搜索、代码复制和完整案例的离线网页手册。

## 剧本示例

以下示例使用教程项目已有素材，可在新建项目中替换 `story/main.trickcal` 后预览：

```trickcal
# 素材路径相对于剧情项目根目录，名称区分大小写。
image station = "assets/bg/elf_city_night.png"
image ner_avatar = "assets/herohead/ner.png"
define ner = Spine("assets/spine/standing/ner", name="尼尔", avatar=ner_avatar, avatarBg="#9fc766")
default trust = 0

scene bg station
show ner at left pose Idle_1
narration "雨夜的站台上，末班车还没有来。"

# preset 仅作用于下一条兼容语句，不修改预设文件。
preset 漫画对话气泡 tail br bubbleWidth 800
ner manga "要再等一会儿吗？"

# 一个并行块最多包含一条台词。
parallel:
  ner normal "我去看看站台那边。"
  move ner x by 100 in 800ms ease InOutSine

choice "是否继续等待？"
  "继续等" -> stay
  "先去避雨" -> shelter

label stay:
  set trust += 1
  ner normal "好，我们一起等。"
  jump finish

label shelter:
  narration "她走向了候车厅。"

label finish:
  if trust >= 1:
    narration "远处终于传来了列车的声音。"
  else:
    narration "窗外的雨仍然没有停。"
  fullscreen "雨夜的末班车"
  end
```

语法借鉴了 Ren'Py 的部分写法；`Spine(...)` 是本引擎扩展。剧本不执行 Python，也不兼容完整的 Ren'Py 语法。更多命令及限制见 [DSL 与运行时现状](docs/DSL与运行时现状.md)。

### 素材与项目结构

每个剧情项目使用独立目录：

```text
我的剧情/
  trickcal.project.json    # 项目元数据、入口和平台设置
  story/
    main.trickcal          # 剧本入口
  assets/                 # 图片、音频、Spine、着色器等素材
  presets/                # JSON 预设
  .preview/               # 自动生成的预览数据
  build/                  # 构建产物与历史归档
```

新项目默认开启 `strictAssets`，角色、图片和音频须先声明再使用，路径限定在项目 `assets/` 内，并使用正斜杠。导入按钮会复制素材并登记清单；使用显式声明模式时，仍需在剧本中编写对应声明。

Spine 目录需要一组同名的 `.skel.bytes`、`.atlas.txt` 和 atlas 引用的全部贴图。检查阶段会报告缺图和路径问题，但不会验证骨骼数据内容或 Spine 版本兼容性，仍需实际预览。教程音频 `silent.wav` 为静音占位素材。

## 构建与分发

先保存剧本并修复编译错误，再在编辑器顶部选择目标平台，点击“构建项目”。

| 目标 | 输出位置（相对于剧情项目） | 使用方式 |
| --- | --- | --- |
| Web | `build/web/` | 将整个目录部署到静态服务器，或通过本地 HTTP 服务访问 `index.html` |
| Windows | `build/windows/TrickcalStory-win32-x64/` | 运行 `TrickcalStory.exe`，分发时保留整个目录 |
| Android | `build/android/TrickcalStory-debug.apk` 或 `TrickcalStory-release.apk` | 在 Android 设备上安装 APK |

Windows 构建使用 Electron；Android 构建使用 Capacitor / WebView。两者都沿用 Web 播放器。Godot 原生播放器位于 `native/godot-player/`，目前只是实验原型，现有构建按钮不会调用它。

构建先在临时目录完成，再将同平台旧输出移至 `build/archive/<平台>/`。目标平台构建失败时，原目标输出保留；Windows 和 Android 构建会先构建 Web，因此该步骤成功后会更新 Web 输出。历史归档不会自动清理。修改剧本或引擎源码后，需要重新构建才能更新已导出的作品。

### Android 环境与签名

Android 构建额外需要：

- JDK 21，可通过 `JAVA_HOME` 指定。
- Android SDK，安装 Android SDK Platform 36 及对应构建工具，通过 `ANDROID_HOME` 或 `ANDROID_SDK_ROOT` 指定。
- Android 壳工程依赖：首次使用前在根目录运行 `npm install --prefix packaging/android-shell`。

当前壳工程的 `minSdkVersion` 为 24，`compileSdkVersion` 和 `targetSdkVersion` 为 36。首次构建还可能下载 Gradle 和 Android 依赖。

未配置正式签名时生成 debug APK。需要 release APK 时，在启动引擎前同时设置以下环境变量：

| 环境变量 | 含义 |
| --- | --- |
| `TRICKCAL_ANDROID_KEYSTORE` | 签名密钥库文件路径 |
| `TRICKCAL_ANDROID_STORE_PASSWORD` | 密钥库密码 |
| `TRICKCAL_ANDROID_KEY_ALIAS` | 密钥别名 |
| `TRICKCAL_ANDROID_KEY_PASSWORD` | 密钥密码 |

配置不完整会报错。请自行保管密钥，勿使用仓库或历史构建中遗留的共享密钥作为正式发布签名。应用 ID 默认由项目 `id` 稳定生成，也可通过项目清单的 `android.applicationId` 指定；覆盖安装时需保持应用 ID 与签名一致。详细说明见 [Android 构建签名](docs/DSL与运行时现状.md#android-构建签名)。

## 开发与验证

主要源码目录：

| 路径 | 职责 |
| --- | --- |
| `main.js` / `preload.js` | Electron 主进程、IPC、项目读写、本地服务和构建 |
| `launcher/` | 项目启动器 |
| `editor/` | Monaco 剧本编辑器、预设与舞台面板 |
| `compiler/` | DSL 编译、素材检查、参数校验与后台诊断 |
| `runtime/` | 剧情播放、状态机、舞台与镜头时间线、渲染和音频 |
| `templates/minimal-demo/` | 新建项目使用的教程模板 |
| `projects/` | 本地剧情项目 |
| `packaging/` | Windows 播放器入口与 Android 壳工程 |
| `native/godot-player/` | Godot 原生播放器实验原型 |
| `test/` | 编译、运行时、编辑器与构建回归测试 |
| `docs/` | 使用手册、实现现状、资源核对与路线图 |

在根目录按验证范围运行：

```powershell
npm test                 # 编译器、状态与时间线等逻辑测试，以及主要脚本语法检查
npm run test:runtime     # Electron 播放器回归
npm run test:editor      # Electron 编辑器回归
npm run test:manual      # 离线网页手册检查
npm run test:check-ipc   # 编辑器与后台检查 IPC 回归
npm run test:build       # Web 构建回归
npm run test:windows     # Windows 构建回归
npm run test:android     # Android 构建回归，需要 Android 工具链
```

`npm test` 不包含全部 Electron 和平台构建测试。原生原型另有 `npm run test:native-core`，需安装 Godot 4，并可用 `GODOT_EXECUTABLE` 指定可执行文件；详情见 [原生播放器说明](native/godot-player/README.md)。

## 当前限制

- `parallel` 支持的命令有明确范围，每块最多一条台词；不支持任意语句并发或并发控制流。
- 时间轴目前用于查看与预览，尚不能拖拽编辑；未访问分支的跳转预览不能完整恢复真实路线，也不等于存档。
- 当前没有跨重启存档；复杂绑定与移动交错仍需进一步核验。
- 独立 UI 对象和独立打字机已停止开发，旧实验语法仅为兼容保留；普通对话框、气泡及逐字效果继续维护。
- UI 动画由引擎重放或近似绘制，尚未逐项完成原游戏实机对照；依据与差异见 [UI 动画资源核对](docs/UI动画资源核对.md)。
- Android 构建回归不等于真机验证，设备交互、性能和音频自动播放仍需实测。原生运行时尚不可作为完整播放器交付。

开发记录与后续方向见 [开发路线图](docs/开发路线图.md)，具体功能状态以当前源码及 [DSL 与运行时现状](docs/DSL与运行时现状.md) 为准。

## 许可与素材

本项目采用 [LICENSE.txt](LICENSE.txt) 中的自定义许可，核心条件包括非商业使用、修改后以相同条款公开源码，以及保留作者署名和来源。协议提供中英双语，如有歧义、差异或解释不一致，以中文版本为准。完整授权条件及免责声明以该文件为准。

项目为非官方同人制作工具，与原游戏开发商、发行商无隶属关系。原游戏商标、美术、字体及其他第三方素材的权利归各自权利人所有，本项目许可不授予这些素材的额外使用权；使用或分发前请确认对应授权。
