# UI 动画资源核对

本文记录逐项核对结果，不把已提取数据、引擎实现和完整原版行为视为同一件事。

## 新闻框入场

- 两个资源节点分别是 `WindowDialogue/FixText/NormalTextNews` 和 `WindowDialogue/FixText/NarrationTextNews`；资源映射均指向 `Dialogue_NewsText_Entry`，时长 0.5 秒。
- Unity 导出动画的根节点 X/Y 缩放关键帧分别为 0 秒的 0、约 0.166667 秒的 1.1、0.5 秒的 1；提取曲线包含对应三次多项式系数。播放器使用这些系数重放。
- 根节点、阴影和文字等由本引擎 Canvas 绘制。字形、混合、运行时触发时机及退场不因此等同于原版；未以游戏画面或真机行为核验逐帧一致性。
- 新闻框预设 `entryDuration` 只缩放本次播放时间，默认 0.5 秒；`enter none` 不播放入场。用户修改后的时间不是原版数据。

### 证据

以下是当前机器上的本地证据，可能因资源版本或路径变动而不可用；哈希用于识别本次核对的文件：

| 文件 | SHA-256 |
| --- | --- |
| `C:/project/trickcal-unity-filesss-2610251400/ExportedProject/Assets/02.resources/addressableresources/animation/dialogue/Dialogue_NewsText_Entry.anim` | `879ee4e47407ac4d4aa33b4ce0841ab9fb232ebdcc4215429e22634e55f24dc3` |
| `C:/project/分析韩服安装包trickcal/re/curves.json` | `5034ac35f5f8f9fc12bf71eb545646e00c496ecc09e434b73e5869688f859704` |
| `C:/project/分析韩服安装包trickcal/re/anim_map.txt` | `d5f077a74b04679249e1b506a9ddb1d6ee60339a354940d5470d87fd5719fb8` |
| `C:/project/分析韩服安装包trickcal/re/prefab_dump.txt` | `d0311e757f74ba59126795c18931572b7386bffa6af330312239599e767b5118` |

代码位置：`runtime/app.js` 的 `news.Entry` 和 `prepareNews`。自动测试采样关键点和中间曲线，检查真实 Canvas 像素变化、入场时长、禁用入场、延迟及静态预览。资源来源不授予再分发或商用许可。

## 漫画气泡入场与待机

2026-11-04：用户指定的资源包中存在 `files/Packages/animation/dialogue/dialogue_mangatext_start`、`dialogue_mangatext_normalbasesaclex`、`dialogue_mangatext_normalbasescaley` 和对应尾巴动画。安装包分析目录 `re/anim_map.txt` 将这些动画映射至 `WindowDialogue/MangaText/MangaNormalText` 的控制器；可读导出的 `Dialogue_MangaText_Start.anim` 则记录根节点 X/Y 缩放关键帧：0 秒为 0，0.25 秒为 1.1，约 0.416667 秒恢复到 1，片段结束于约 1.016667 秒。其权重为默认值，播放器提取曲线在 0.125 秒采样为 0.55。Electron 播放器回归检查上述值以及实际气泡入场画面的变化。

普通气泡 X 方向待机曲线作用于 `Base/Base/TextBoxLayOut`，2 秒循环，1 秒时为 1.03；普通 Y 曲线在导出中只有恒定的 1。思考气泡的 Y 待机和两套尾巴动画使用不同通道，不能据此认为所有气泡都应采用同一待机形变。现有独立 UI 对象使用相同曲线作简化重绘，并非 Unity 原始层级或逐帧一致性证明。

此轮还修复漫画气泡的 X 或 Y 坐标为 0 时被替换成默认值的问题。连续气泡的入场和退场有播放器回归；当前普通对话退场使用引擎实现的通用缩小淡出，不能当成已核验的原版退场。尚未在游戏实际运行画面逐帧对照，字体、九宫格切片、阴影、尾巴位置和动画触发时机仍需持续核验。

本次文件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| 游戏资源包 `animation/dialogue/dialogue_mangatext_start` | `59cfa795f9f51ad73d249daa12ca5cdb003cd9d6c52f3e9734e58998e1bc611f` |
| Unity 可读导出 `Dialogue_MangaText_Start.anim` | `7de235ca51edb2d4056e95203bfb77cae6735cb6f4bdae09a5364dd566cb7e28` |
| Unity 可读导出 `Dialogue_MangaText_NormalBaseSacleX.anim` | `19d1ad4833bbc9450178914b6af7227269504bce0da52989f0930097193b7965` |

## 现有 UI 核对范围

新闻框和漫画气泡的上述检查只覆盖列明的素材、曲线及播放器行为，不等于所有预设已经核验。普通框、独白框、旁白、拟声、章节、地点、分支等仍需逐项对照 prefab、动画和实际画面；无足够证据的内容继续标为引擎重绘或近似，不以“已有预设”代替原版一致性验证。

## 普通框与独白框核对

2026-11-04：根据 `re/anim_map.txt` 和资源包的控制器映射，普通框控制器的状态分工为：

- `Normal`：普通框本体与阴影的 2.5 秒循环待机，X 方向最高约 1.01，Y 保持 1。
- `Cloud`：云朵框使用 `Dialogue_NormalText_CloudIdleX`（2.5 秒）和 `CloudIdleY`（2 秒）两条循环；导出曲线的 X/Y 峰值均约为 1.05。
- `Blast`：爆炸框才使用 `Dialogue_NormalText_BlastEntry`（0.5 秒）和 `BlastIdle`（约 1.0833 秒）。

此前普通对话播放器把 `BlastEntry` 用于普通框；独立框体则还把它用于云朵框。这不符合导出控制器中按名称区分的 `Normal`、`Cloud`、`Blast` 触发状态。现在引擎按这三个状态映射：普通框直接进入 `Normal` 待机，云朵框进入两条云朵待机，只有爆炸框播放 `BlastEntry`。独立 UI 的 `box normal`、`box cloud`、`box blast` 使用同一映射。原游戏脚本具体何时触发各状态尚未通过实际运行验证，不能仅凭控制器排除其他调用方式。

控制器中的爆炸框入场和待机之间还有过渡设置；当前播放器使用提取曲线重放，未完整模拟 Unity Animator 的状态混合，因此爆炸框入场与待机交接仍只是近似，不应标为逐帧一致。Electron 回归检查当前三种样式的 clip 组合和入场采样。

独白框 `ClearText` 的资源控制器提供 `Entry`（约 0.6333 秒）和 `ReEntry`（约 0.3833 秒）；当前播放器首次显示使用 `Entry`，连续 `clearRe` 使用 `ReEntry`，并保留头像、名字牌、尾巴、头像透明度和文字尺寸的资源通道。该部分已由连续切换测试覆盖，但仍是 Canvas 重绘，不是直接运行 Unity prefab。

独立 UI 仅将这些层级动画近似成整个框的变换，而非重建独白框头像、名字牌及文字的全部原始通道。独立漫画气泡的根入场和待机缩放现从同一开始时间采样；独立独白框不再套用普通框的循环待机。跳转预览已存在对象时跳过旧入场，但恢复待机和尾巴动画。

可读导出的控制器 SHA-256：`Dialogue_NormalText.controller` 为 `806baf1e72f27dc08336a2d69609407692e2327b6660b10a7ef1237ed931f4f0`；`Dialogue_ClearText_Entry.controller` 为 `30edd8a983901e839e39f9be147146548c19b4b2cbb5ca9341382fa9c3aa0131`。

## 剧情 UI 候选盘点

2026-11-04：用户指定安装包目录为 `C:/project/分析韩服安装包trickcal`，游戏资源目录为 `C:/project/com.epidgames.trickcalrevive2610317346/com.epidgames.trickcalrevive`。以下使用后者 `files/Packages` 下的资源包名称核对，再参考已有 Unity 可读导出；不能仅凭文件名断定原游戏中的完整用法，也不能断定韩服与其他版本逐项一致。

| 候选 | 已核实证据 | 当前状态 |
| --- | --- | --- |
| 2.5 周年活动气泡 | `rawsprites/dialogue/dialoge_eventspeechbubble_2.5th anni_bubblebase` 和 `_bubblebase_2` 存在；导出 Sprite 的第一种尺寸为 1610×320、边框为零；`animation/dialogeeventspeechbubble2_5thslot_finish` 对应导出动画包含 `Content/Bubble_Axis/SmallWing` 和羽毛节点，时长约 0.133 秒。 | 三张活动气泡底图已被播放器资源实验界面加载，但还没有可用剧情预设；羽毛、完整 prefab 结构、触发时机及动画绑定仍待确认。 |
| 3 周年活动气泡 | `rawsprites/dialogue/dialoge_eventspeechbubble_3rd anni_bubblebase` 存在；导出 Sprite 尺寸 1618×369、边框为零。 | 同样只有底图被实验界面加载；布局、其他组件及动画未核实，不能当成完整气泡预设。 |
| 另一种剧情页面 | `prefab/ui/dialogueanothercommon`、`animation/dialogue/dialogueanothercommon_desctextentry` 等资源包存在；导出 prefab 包含标题、可滚动描述区和按钮。入口动画导出为约 0.833 秒的根缩放，描述文字动画为 4 秒循环，但其脚本属性含义尚未确认。 | 尚未接入剧情 DSL 或编辑器预设；页面用途、脚本属性及交互需进一步验证。 |
| InkleScript 分支槽 | `prefab/slots/dialoguebranchslotinklescript` 和 `animation/dialogue/dialoguebranchslotinklescript_entry` 等资源包存在；导出 prefab 包含文字、遮罩、锁及装饰，入口动画包含装饰旋转曲线。 | 与当前已有分支槽不是同一套证据；尚未实现该变体及其状态切换。 |

导出文件用于识别本次证据，SHA-256 分别为：`DialogueAnotherCommon.prefab` 为 `d95f75b0a9ebf03a2f1522b95087c3fb4cccc4f204e46bb99ba42a907e2bd1a2`；`DialogueAnotherCommon_DescTextEntry.anim` 为 `19a8857e074314f517e9c21cf16cfe921ca76f4518a006cd96add741f3452256`；`DialogeEventSpeechBubble2_5thSlot_Finish.anim` 为 `0eaba5cdbfc4e48e82ce95219ac8a160caa602097c9311268464a56735851aaa`。现有模板中的三张活动底图与可读导出 PNG 的 SHA-256 各自一致；这只确认素材文件一致，不证明动画和行为已还原。不要绕过授权保护，资源存在也不代表有再分发许可。

## 旁白入场与剧情控件补充核对

2026-11-04：资源包包含 `animation/dialogue/dialogue_narrationtext_entry`，可读导出的 `Dialogue_NarrationText_Entry.anim` 记录根节点锚点 Y：0 秒为 -240、约 0.166667 秒为 80、约 0.283333 秒为 0，关键帧切线接近零。此前播放器用直线连接这些值，与动画曲线不同；现按导出切线重算三次插值。播放器回归检查两个非关键帧位置以及禁用入场；不能据此宣称已经和游戏运行画面逐帧一致，也不能仅凭文件名证明不同版本完全一致。

`DialogueNextButton.anim` 记录 1 秒循环的 X/Y 缩放，约 0.416667 秒为 1.1/0.8、0.75 秒为 1/1.1；安装包分析的 `re/anim_map.txt` 将其映射到漫画、普通对话、新闻、旁白、动画字幕与独白框的 NextIcon。播放器已有该缩放曲线，但图标具体布局、颜色、显示时机仍需游戏实机核验。

进一步检查安装包导出的 `re/prefab_tree.json`：漫画对话的 `NextIcon` 是 `MangaNormalText/Base/Base` 的子节点，锚定右下，局部偏移为 (-80, 60)，其 `Icon` 子节点带缩放动画。此前播放器另行绘制图标时忽略对话预设整体变换，移动或缩放对话框后图标留在原地，`uiOpacity 0` 时也仍可见。现让图标使用与对话相同的预设平移、缩放、旋转和透明度；Electron 测试对普通对话和漫画气泡检查实际画布像素位置及零透明度。

这次修复只统一预设变换，并没有重建原 prefab 的全部图标父级动画和定位：图标当前仍按引擎坐标单独绘制。不同尾巴方向、动态尺寸以及游戏实际触发时机的原版布局仍需进一步核验，不能视作完整还原。安装包导出 `re/prefab_tree.json` 的 SHA-256 为 `d89a1612b52ce831f1ca8068410e39fa75d4f82e2b3a64b168970ce790af9c49`，用户指定资源包的 `animation/dialogue/dialoguenextbutton` 为 `045e5b8f61e66678f84b305ad093ed93aec5a8ce831edb616a2c1dee0449d2ed`。

资源包中另有 `dialogue_senderentry`，可读导出的 `Dialogue_SenderEntry.anim` 是 Legacy clip：锚点 Y 从 153.69 变化至 200，再至 188，同时 CanvasGroup 透明度从 0 变为 1；已提取的 `prefab_dump.txt` 在新闻对话中列出 Sender 节点。目前尚未证明该 clip 与此节点的绑定及触发条件，因此仅列为候选，不擅自增加预设或声称已还原。

本次可读导出文件 SHA-256：`Dialogue_NarrationText_Entry.anim` 为 `c16e6afa7782e6a5a293a6433c28e92cccc5277ff61bb5c150030024ace4cd31`；`DialogueNextButton.anim` 为 `437c6b394bf3c4bd445bf89dcebb49ed2e644b18a2c60c9a051987747bb78533c`；`Dialogue_SenderEntry.anim` 为 `a1dca6e15c83df18792ddbf609f086269ca88a5692be6e5f4024e995303d8a61`。

## 转场及分支资源补充盘点

2026-11-04：用户提供的游戏资源 `files/Packages/prefab/prefabdialogueresources/transition` 包含黑白淡入淡出、圆形、色条、地点、右推、场记板、剧情结束及下一话等资源；同目录的 `animation` 下存在对应动画。部分资源有成对的 In/Out，本引擎的 `circle`、`rightpush` 和 `colorbars` 则是单个自绘效果，不能视为原版动画的成对实现。地点、场记板及剧情结束等资源的具体调用条件尚待确认。

可读导出 `StoryProduction_FadeInBlack.anim` 和 `StoryProduction_FadeoutBlack.anim` 各长 1 秒，`Image` 上的第一个脚本曲线分别从 1 到 0、从 0 到 1，端点切线均为零。当前引擎的黑色淡入淡出采用同方向的平滑插值，但属性名被混淆，仍需确认其在原始组件中的含义和实际触发时机；引擎的 `hold` 可改变时长，`fadeblack` 是自定义往返效果，并非其中单个原片段。白色淡出效果及资源中的其他通道尚未完成同等程度的行为核对。

`StoryProduction_ColorBarsIn.anim` 的导出显示 0.6 秒片段中有两个 Image 节点，包含透明度变化及多段 X/Y 位移；当前 `colorbars` 是六条彩色遮罩展开再收回，没有重建这些节点和曲线。此前自绘色条到中点只覆盖屏幕上半部，现已修正为中点覆盖整个画面，并添加播放器像素测试。此修复只保证引擎自绘遮罩的完整覆盖，不意味着原版效果已还原。

剧情分支槽除当前播放器使用的 `DialogueBranchSlotNormal` 外，资源包还包含 `DialogueBranchSlotInkleScript`、`DialogueBranchSlotTwoAndHalf`、`DialogueBranchSlotViviDivine` 和 `DialogueBranchSlotAutoTimeSlot`；可读导出也存在同名 prefab。文件名和 prefab 的存在不能证明它们可直接用于普通剧情，也不能确定交互、可选状态或触发条件；这些变体尚未作为预设接入。剧情特效目录另有雨、雾、闪光、聚焦、旧电视等名称的 prefab，均需核实具体粒子、贴图、层级及触发方式，不能用同名的简单滤镜冒充。

本次导出动画 SHA-256：`StoryProduction_FadeInBlack.anim` 为 `424a7e6d211bb174fcf7536e0a8199afe667ab2a71f8fb439b17d324b8e027d1`；`StoryProduction_FadeoutBlack.anim` 为 `3c098b638fe59db32ea1a179511f0734aaf798e274bcd790aadbba02a2959e33`；`StoryProduction_ColorBarsIn.anim` 为 `94687f9d0963afc06869e555580a78ff576b41a544f2ac89fbc974a415e968af`。导出文件位于 `C:/project/trickcal-unity-filesss-2610251400/ExportedProject/Assets/02.resources/addressableresources/prefab/prefabdialogueresources/transition/animation/`，其与用户指定资源包不是同一文件，跨版本一致性仍待核验。
