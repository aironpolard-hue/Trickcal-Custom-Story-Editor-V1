'use strict';

(() => {
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
  const code = (source, check = 'scene', language = 'trickcal', label = 'story/main.trickcal') =>
    `<div class="code-block" data-language="${language}"><div class="code-toolbar"><span>${escape(label)}</span><button class="icon-button copy-code" type="button" title="复制代码" aria-label="复制代码"><i data-lucide="copy"></i></button></div><pre><code data-check="${check}">${escape(source.trim())}</code></pre></div>`;
  const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const note = (title, text, warning = false) => `<aside class="callout${warning ? ' warning' : ''}"><strong>${title}</strong>${text}</aside>`;
  const steps = rows => `<ol class="steps">${rows.map(([title, text]) => `<li><strong>${title}</strong><p>${text}</p></li>`).join('')}</ol>`;
  const figure = `<figure class="manual-figure"><button type="button" class="figure-button" aria-label="放大编辑器界面截图"><img src="assets/editor-overview.png" width="1560" height="980" alt="编辑器界面：顶部保存、检查和运行按钮，左侧预设列表，中间剧本代码，右侧问题和工具面板" loading="lazy"></button><figcaption><span>编辑器实际界面 ·《雨夜的末班车》模板</span><span>点击放大</span></figcaption></figure>`;
  const link = (id, text) => `<a href="#${id}">${text}</a>`;
  const pages = [
    {
      id: 'start', group: '开始使用', title: '第一次使用',
      description: '从打开引擎开始，完成新建项目、修改台词和运行预览。第一次做剧情，先跟着这一章走。',
      keywords: '新手 入门 安装 启动 Electron npm install Node 新建 保存',
      body: `
<h2>先做出第一段剧情</h2>
${steps([
  ['启动引擎', '在引擎根目录双击 <code>启动引擎.bat</code>。看到“新建项目”和“最近项目”，说明启动成功。'],
  ['新建自己的项目', '点击“新建项目”，填写作品标题、章节数、文件夹名称和项目位置，再点击“创建并打开”。建议名称用“我的第一段剧情”，避免覆盖现有作品。'],
  ['找到并修改一句台词', '新项目会复制《雨夜的末班车》教程。中间的代码区就是剧本，找到 <code>ner normal "…"</code>，只改双引号里的文字，保留前面的名字和模式。'],
  ['保存并检查', '按 <code>Ctrl+S</code> 保存，再点“检查”。右侧“问题”面板应没有错误；有错误时点击该问题，回到对应行修改。'],
  ['运行预览', '点击“运行预览”。点击画面推进；文字还在逐字显示时，第一次点击补全文字，第二次点击进入下一句。修改后重新点“运行预览”查看结果。'],
])}
${note('第一次先改文字', '模板中的素材声明、角色和预设已经配好。先保留这些内容，熟悉流程后再更换背景和角色。')}
<h2>想从零写？先试这 5 行</h2>
<p>在<strong>新建的练习项目</strong>中，将代码区内容替换为下面这段，保存后运行。它只需要黑色背景，不需要额外素材。</p>
${code(String.raw`
scene bg black
narration "你好，这是我的第一段剧情。"
narration "点击画面，就可以继续阅读。"
fullscreen "故事从这里开始。"
end`, 'full')}
<p><code>scene bg black</code> 设置黑屏，<code>narration</code> 是旁白，<code>fullscreen</code> 是全屏文字，<code>end</code> 结束播放。每条语句单独占一行。</p>
<h2>认识工作界面</h2>
${figure}
<p>左边挑预设，中间写剧本，右边查错误、调参数和查看舞台。下一章 ${link('editor', '编辑器怎么用')} 会逐项说明按钮。</p>
<h2>启动时提示 Electron not found</h2>
<p>这表示源码依赖尚未安装。先安装 Node.js，在<strong>引擎根目录</strong>打开终端，运行以下命令；安装期间需要网络。完成后再次双击启动脚本。</p>
${code('npm install\nnpm start', 'none', 'shell', '终端 · 引擎根目录')}
<p>使用 PowerShell 时，如果系统阻止 <code>npm.ps1</code>，可使用 <code>npm.cmd install</code> 和 <code>npm.cmd start</code>。更多命令见 ${link('terminal', '终端命令与开发检查')}。</p>`,
    },
    {
      id: 'editor', group: '开始使用', title: '编辑器怎么用',
      description: '先认清常用按钮和面板，再开始写。保存、检查和运行是日常最常用的三个操作。',
      keywords: '按钮 快捷键 舞台 时间轴 Spine VSCode 项目信息 预览 停止 自动播放',
      body: `
<h2>顶部工具栏</h2>
${table(['按钮', '什么时候用', '实际行为'], [
  ['保存 / <code>Ctrl+S</code>', '写完一段时', '写入入口剧本并编译。即使存在语法错误，源文件仍会保存。'],
  ['检查', '预览前，或排查红线', '编译当前编辑内容，在右侧显示错误和警告。检查本身不代替保存。'],
  ['运行预览', '想看看演出效果时', '先保存、检查；没有错误时从头重新运行，并切换到“预览”页。'],
  ['停止', '暂时不看预览时', '卸载当前预览，重新运行会从头开始。'],
  ['构建目标 + 构建项目', '需要给别人播放时', '选择 Web、Windows 程序或 Android APK，再生成独立输出。'],
  ['打开项目文件夹', '放入素材、备份或找输出时', '用系统文件管理器打开当前作品的根目录。'],
  ['VS', '习惯使用外部编辑器时', '尝试用 VS Code 打开项目。'],
  ['使用手册', '查命令和案例时', '打开本文档，可与编辑器并排查看。'],
])}
<h2>左侧预设与右侧工具</h2>
${table(['位置', '用途', '操作提示'], [
  ['左侧“预设”', '选择对话框、气泡、转场和动作模板', '点击预设后，右侧自动显示“预设详情”。'],
  ['问题', '查看错误、警告和对应行号', '先修复错误，再运行。警告需要结合实际预览判断。'],
  ['项目信息', '查看项目资料，修改章节开场与地点信息', '点击顶部“第 N 话”也会跳到此处。章节数是开场编号，不会生成多个剧本文件。'],
  ['预设详情', '编辑参数，预览效果，插入或保存预设', '“插入到光标”写入单次参数；“保存预设”修改预设文件。'],
  ['Spine', '选择素材、角色、皮肤和动画', '点击“插入皮肤代码”或“插入动作代码”，动作名从下拉列表选择。'],
  ['舞台', '逐段查看角色、图片和对话对象', '选段后点击“载入当前段预览”；可调整对象属性，修改会写回剧本并保存。'],
  ['时间轴', '查看动作、延时、音频和背景等事件', '选择段落并点击“预览”；目前轨道不能直接拖动编辑。'],
])}
<h2>预览里的常用操作</h2>
${table(['操作', '效果'], [
  ['点击 / 空格 / Enter', '推进剧情。正在打字时先补全本句，再次操作才翻页。'],
  ['<code>A</code>', '切换自动播放。请先点击预览画面，让键盘焦点进入播放器。'],
  ['<code>R</code>', '播放器内重新开始；编辑后的内容仍需点击编辑器“运行预览”重新载入。'],
  ['点击选项', '进入对应的分支，条件不满足的选项不可点击。'],
  ['气泡文字区滚轮 / 触摸拖动', '在支持滚动的长气泡里查看已经显示的文字。'],
])}
${note('跳段预览用来检查这一段', '跳到未访问的分支时，变量从默认值开始；不会推断玩家之前做过哪些选择。检查完整分支时，请从头运行。')}
<h2>一个稳定的工作习惯</h2>
<p>先改一小段，按 <code>Ctrl+S</code>，看“问题”，再运行预览。最后从头选择所有路线，确认没有跳错标签、漏停音频或缺少背景。查看代码时隐藏画布会暂停绘制，但剧情时间和音频仍可能继续；不再使用的预览可以点击“停止”。</p>`,
    },
    {
      id: 'files', group: '开始使用', title: '项目与文件夹',
      description: '分清“引擎文件夹”和“作品文件夹”。素材路径、备份与构建输出都以作品项目为单位。',
      keywords: '目录 文件 路径 main.trickcal trickcal.project.json entry assets presets backup build preview strictAssets',
      body: `
<h2>作品项目里有什么</h2>
${code(String.raw`
我的第一段剧情/
  trickcal.project.json       项目配置
  story/
    main.trickcal            剧情入口
  assets/
    bg/                      背景图片
    herohead/                角色头像
    spine/                   Spine 模型
    audio/                   配乐和音效
  presets/                   预设 JSON
  .preview/                  自动生成的预览数据
  build/                     构建输出
    web/
    windows/
    android/
    archive/                 旧构建归档`, 'none', 'text', '作品文件夹')}
${table(['文件 / 目录', '你需要做什么'], [
  ['<code>story/main.trickcal</code>', '日常写剧情的地方，默认入口由项目配置的 entry 指定。'],
  ['<code>assets/</code>', '放自己的图片、音频和 Spine。建议按类型建子文件夹。'],
  ['<code>presets/</code>', '预设保存的位置；新项目已带有常用预设。备份项目时也要一起备份。'],
  ['<code>trickcal.project.json</code>', '项目标题、入口、分辨率等配置。打开项目时选它所在的文件夹。'],
  ['<code>.preview/</code>', '生成内容，不在这里手改剧情。'],
  ['<code>build/</code>', '供别人播放的输出；每次修改剧本后需要重新构建。'],
])}
<h2>打开已有项目</h2>
<p>在启动器点击“打开项目”，选择<strong>包含 <code>trickcal.project.json</code> 的文件夹</strong>。不要选择里面的 <code>story/</code> 或 <code>build/</code>。</p>
<h2>素材路径怎么写</h2>
<p>以作品根目录为起点，统一用正斜杠，放进英文双引号。推荐先把素材复制到 <code>assets/</code> 再写声明。</p>
${code('image station = "assets/bg/elf_city_night.png"', 'full')}
<p>路径的大小写、文件扩展名和文件名都要与实际一致。不要写 <code>C:\\图片\\背景.png</code> 这样的绝对路径，也不要通过 <code>../</code> 引用项目外的文件。</p>
<h2>备份和迁移</h2>
<p>迁移作品时保留项目配置、<code>story/</code>、<code>assets/</code> 和 <code>presets/</code>。每次大改前，把这些内容复制到独立的备份目录；需要保存某次可播放版本时，再另存构建结果。</p>
${note('旧输出会归档', '构建成功后，同平台的旧输出移到 <code>build/archive/&lt;平台&gt;/</code>。归档不会自动清理，长时间使用后可自行整理；构建失败时原有输出保留。')}`,
    },
    {
      id: 'syntax', group: '写出你的剧情', title: '剧本语法基础',
      description: '不用先学编程。记住英文符号、每行一句和缩进，就能开始写第一段对话。',
      keywords: '语法 注释 引号 缩进 单位 坐标 时间 说话者 名称 大小写 RenPy Python',
      body: `
<h2>每行写一条指令</h2>
${code(String.raw`
# 这行是给作者看的注释，不会出现在画面中
scene bg black
narration "这是会显示出来的旁白。"
narration "文字里可以写 #，引号内不会被当成注释。"
end`, 'full')}
<p><code>#</code> 后面的注释用于解释剧本。文字和颜色使用英文双引号 <code>"</code>，不要把中文的 <code>“ ”</code> 当作语法引号。</p>
<h2>一条台词的组成</h2>
${code('ner normal "列车应该快到了。" hold 1.5')}
${table(['部分', '含义'], [
  ['<code>ner</code>', '说话者的素材名称，在前面用 define 声明；不是显示给读者看的中文名字。'],
  ['<code>normal</code>', '对话模式。换成 manga、think、clear 等可改变对话类型。'],
  ['<code>"列车应该快到了。"</code>', '真正显示的文字。'],
  ['<code>hold 1.5</code>', '可选。自动播放时，显示完文字后再停留 1.5 秒。'],
])}
<h2>缩进表示属于谁</h2>
${code(String.raw`
parallel:
  ner normal "我边说边走。"
  move ner x by 100 in 1s

choice "去哪里？"
  "站台" -> platform
  "候车厅" -> hall
label platform:
  narration "选择了站台。"
  jump done
label hall:
  narration "选择了候车厅。"
label done:
  end`)}
<p>冒号和箭头都使用英文符号。建议统一用<strong>两个空格</strong>缩进，不要混用 Tab 和空格。<code>choice</code> 选项、<code>parallel</code> 内容、<code>after</code> 内容和 <code>if</code> 分支都需要缩进。</p>
<h2>数字、时间和坐标</h2>
${table(['写法', '含义与范围'], [
  ['<code>at 960,540</code>', '坐标用英文逗号连接，中间不留空格。默认舞台为 1920 × 1080，左上角是 0,0，X 向右增大，Y 向下增大。'],
  ['<code>1s</code> / <code>500ms</code>', '1 秒 / 500 毫秒；常用于 in、after、wait、音频渐变。wait 要写单位。'],
  ['<code>hold 1.5</code>', '台词、开场和地点使用秒数；动作预设 duration、anim fade 也用秒数。'],
  ['<code>alpha 0.5</code>', '不透明度，范围 0 到 1；0 是完全透明，1 是完全不透明。'],
  ['<code>brightness 1</code>', '1 为原亮度，0 为全黑，大于 1 提亮。'],
  ['<code>scale 0.9</code>', '缩放必须大于 0；角色根节点通常在脚底，坐标不是角色中心。'],
  ['<code>face 1</code> / <code>face -1</code>', '两个镜像方向。素材原始朝向可能不同，以预览为准。'],
  ['<code>"#75a659"</code>', '预设颜色推荐六位十六进制，必须保留英文双引号。'],
])}
${note('这是一套专用剧本语言', '语法借鉴了 Ren’Py，但不执行 Python，也不支持通用 Ren’Py 脚本。请使用本手册的 <code>audio play</code>、<code>define ... = Spine(...)</code> 等写法。')}`,
    },
    {
      id: 'assets', group: '写出你的剧情', title: '素材、角色与图片',
      description: '先声明素材，再放上舞台。这里区分“文件在哪里”“素材叫什么”和“场上的对象叫什么”。',
      keywords: '声明 素材 导入 图片 背景 角色 Spine 头像 skel atlas 贴图 show spawn hide z alpha brightness',
      body: `
<h2>声明项目自带素材</h2>
<p>下面这些路径都存在于新项目模板中。声明放在剧本开头，同一个名称只声明一次；后面的例子直接使用这些名称。</p>
${code(String.raw`
image ner_avatar = "assets/herohead/ner.png"
define ner = Spine("assets/spine/standing/ner", name="尼尔", avatar=ner_avatar, avatarBg="#9fc766")
define erpin = Spine("assets/spine/standing/erpin", name="埃尔芬")
image station = "assets/bg/elf_city_night.png"
image hall = "assets/bg/elf_arthall_night.png"
define audio.rain = "assets/audio/silent.wav"

scene bg station
show ner at left pose Idle_1
show erpin at right face -1 pose Idle_1
ner normal "欢迎来到车站。"
end`, 'full')}
<p><code>name</code> 是对话显示名；<code>avatar</code> 引用前面声明的图片，用在独白头像；<code>avatarBg</code> 是头像底色。没有显式设置头像的新式角色声明不会自动匹配内置角色头像。</p>
<h2>换成你自己的素材</h2>
${steps([
  ['复制到 assets', '点击“打开项目文件夹”，把背景放到 <code>assets/bg/</code>，音频放到 <code>assets/audio/</code>，Spine 整个文件夹放到 <code>assets/spine/</code>。'],
  ['修改声明路径', '例如把图片声明改成 <code>image station = "assets/bg/我的背景.png"</code>。名称 station 可以保留。'],
  ['检查并实际预览', '“检查”确认文件存在；“运行预览”确认图片、模型和动作确实能正常显示。'],
])}
${note('Spine 文件要成套', '一个模型文件夹需要恰好一组同名 <code>.skel.bytes</code>、<code>.atlas.txt</code>，以及 atlas 引用的所有贴图。检查会发现缺图和越界路径，但不会验证骨骼损坏、图片内容或 Spine 版本兼容性。', true)}
<h2>角色登场与退场</h2>
${code(String.raw`
show ner at left face 1 pose Idle_1 scale 0.9 alpha 1 brightness 1
show erpin at 1342,1040 face -1 pose Happy_1
ner normal "这边！"
hide erpin
ner normal "现在只剩我一个人了。"
hide all
narration "舞台上的角色和图片都退场了。"`)}
${table(['参数', '用途'], [
  ['<code>at</code>', '预设站位 left / center / right / farleft / farright，或 x,y 坐标。角色站位 Y 默认为 1040。'],
  ['<code>pose</code> / <code>anim</code>', '登场时使用的动画名，必须与模型一致。'],
  ['<code>scale</code>、<code>sx</code>、<code>sy</code>', '整体缩放，或分别设置横向、纵向缩放。'],
  ['<code>face</code>、<code>rot</code>', '镜像方向 1 / -1；旋转角度。'],
  ['<code>alpha</code>、<code>brightness</code>', '不透明度与对象亮度。透明对象仍在舞台上，hide 才是移除。'],
  ['<code>z</code>', '层级，数值越大越靠前。'],
])}
<h2>把图片当作舞台对象</h2>
${code(String.raw`
show image hall as poster at 1400,400 scale 0.2 alpha 0.8 brightness 1.1 z 2
ner normal "看这张候车厅的照片。"
hide poster
ner normal "先收起来吧。"`)}
<p><code>hall</code> 是素材名称，<code>poster</code> 是舞台对象名称；后续移动、隐藏、绑定都使用 <code>poster</code>。<code>spawn image</code> 与 <code>show image</code> 都可显示图片。</p>
<h2>同一角色的多个实例</h2>
${code(String.raw`
spawn ner as ner_copy at right face -1
ner normal "怎么又有一个我？"
parallel:
  move ner_copy x by 80 in 500ms
  wait 500ms
hide ner_copy`)}
<p>复制模型时给每个实例不同名称。<code>spawn ner as ner_copy</code> 创建的是对象实例，后续移动它用 <code>ner_copy</code>；普通台词仍用声明过的说话者 <code>ner</code>。</p>`,
    },
    {
      id: 'dialogue', group: '写出你的剧情', title: '对话框、气泡与旁白',
      description: '用一句话选择演出方式：普通对话、漫画气泡、内心思考、独白或全屏文字。',
      keywords: 'normal manga think cloud blast clear clearRe anime narration fullscreen sfx news tail bubble hold purple 名字',
      body: `
<h2>常用对话模式</h2>
${table(['写法', '样式', '适合的场景'], [
  ['<code>ner normal "…"</code>', '普通对话框', '日常角色对话。'],
  ['<code>ner manga "…"</code>', '箭头尾巴的漫画气泡', '靠近角色的短句、活泼对话。'],
  ['<code>ner think "…"</code>', '圆点尾巴的思考气泡', '没有说出口的想法。'],
  ['<code>ner cloud "…"</code>', '云朵框', '内心活动，也可使用有名字的云朵预设。'],
  ['<code>ner blast "…"</code>', '爆炸框', '喊叫、强调或突发状况。'],
  ['<code>ner clear "…"</code>', '独白框', '带角色头像的陈述。'],
  ['<code>ner clearRe "…"</code>', '连续独白', '保留独白框体，更新头像和名字。'],
  ['<code>ner anime "…"</code>', '动画字幕', '演出中的字幕短句。'],
  ['<code>narration "…"</code>', '旁白框', '环境、行动和时间说明。'],
  ['<code>sfx "…" at 960,470</code>', '拟声文字框', '汽笛、敲门等文字音效；不播放音频文件。'],
  ['<code>news anchor "…"</code>', '主播新闻框', '广播、主播发言。'],
  ['<code>news summary "…"</code>', '简报新闻框', '通知、信息摘要。'],
  ['<code>fullscreen "…"</code>', '全屏文字', '章节结语或强调句。'],
])}
<h2>连写几种不同对话</h2>
${code(String.raw`
preset 普通对话框
ner normal "雨还没有停。"
preset 漫画对话气泡 tail br
erpin manga "那就再等等！"
preset 思考气泡
ner think "她今天心情不错。"
preset 紫色内心气泡
ner manga "但愿列车不要再晚点。"
preset 云朵对话框·有名字
erpin cloud "要不要去买点吃的？"
preset 爆炸框·无名字
ner blast "列车来了！"`)}
${note('模式与预设要分别写', '<code>preset</code> 用来设置下一句的外观参数，不会把 <code>normal</code> 自动变成 <code>manga</code>。紫色漫画气泡搭配 <code>manga</code>，圆点思考气泡搭配 <code>think</code>。')}
<h2>气泡位置和尾巴</h2>
${code(String.raw`
preset 漫画对话气泡 bubbleWidth 800 tail tr
ner manga "把气泡放在这里。" bubble 820,460
ner manga "只改这一句尾巴。" tail bl`)}
<p><code>bubble x,y</code> 调整气泡位置。箭头尾巴使用 <code>bl</code> 左下、<code>br</code> 右下、<code>tl</code> 左上、<code>tr</code> 右上，也可使用中文方向。<code>think</code> 的圆点尾巴使用自身样式，不受这些箭头方向影响。</p>
<h2>连续独白和单句头像</h2>
${code(String.raw`
ner clear "我记得这里以前很热闹。" name "尼尔" avatar ner_avatar avatarBg "#75a659"
erpin clearRe "等雨停了，人就会多起来。"
ner clearRe "也对。" enter none`)}
<p>紧接 <code>clear</code> 或另一条 <code>clearRe</code> 时，<code>clearRe</code> 保留框体，重新播放头像和名字的入场。前面没有独白框，或本句被 <code>after</code> 延时，仍会完整显示框体。<code>name</code>、<code>avatar</code>、<code>avatarBg</code> 只覆盖当前句。</p>
<h2>停留和入退场</h2>
<p>台词末尾可写 <code>hold 0</code>：自动播放完成打字后不额外停留；手动模式仍要点击。并行块还有未结束事件时，自动播放会继续等到时间线结束。</p>
<p><code>enter none</code> 关闭当前句的入场，<code>exit none</code> 关闭退场；默认会播放对应模式的动画。连续漫画气泡也会逐个退场、入场。</p>`,
    },
    {
      id: 'presets', group: '写出你的剧情', title: '预设与参数调整',
      description: '预设相当于一套可重复使用的样式。分清单句覆盖与保存预设，就能放心调整演出。',
      keywords: '预设 preset 参数 字号 颜色 阴影 typewriter 保存 插入 覆盖 自定义 JSON 名字',
      body: `
<h2>三种修改的区别</h2>
${table(['方式', '影响范围', '例子'], [
  ['写 <code>preset 名称</code>', '下一条兼容语句使用该预设', '<code>preset 普通对话框</code> 后接角色 normal 台词。'],
  ['写 <code>preset 名称 参数 值</code>', '只覆盖下一句，预设文件不变', '<code>preset 漫画对话气泡 fontSize 56</code>。'],
  ['点击“保存预设”', '修改项目内的预设 JSON', '所有没有单独覆盖相应参数的引用会使用新值。'],
])}
${code(String.raw`
preset 漫画对话气泡 fontSize 56 bubbleWidth 800 shadowX 16 shadowY 18 shadowColor "#3b2852" shadowAlpha 0.4
ner manga "这一句使用自定义的气泡。"
preset 漫画对话气泡
ner manga "这一句又使用预设文件中的默认值。"`)}
<h2>在界面里调整</h2>
${steps([
  ['点击左侧预设', '右侧“预设详情”会出现效果预览和可编辑字段。'],
  ['调整字段并重新播放', '使用数值输入、颜色选择器和选项菜单调参。动作预览中的图片是示意，正式演出作用于你指定的角色或图片。'],
  ['插入或保存', '“插入到光标”把预设名称和参数写进剧本；“保存预设”修改预设文件。“预览模式”只决定示意预览，不会改写剧本中的对话模式。'],
])}
<h2>对话和气泡的常用参数</h2>
${table(['参数', '意义 / 范围'], [
  ['<code>uiX</code> / <code>uiY</code>', '整体位置偏移；正数向右、向下。'],
  ['<code>uiScale</code> / <code>uiRot</code> / <code>uiOpacity</code>', '整体缩放、旋转角度、不透明度。缩放 &gt; 0，不透明度 0～1。'],
  ['<code>fontSize</code> / <code>textColor</code>', '字号与六位颜色，如 <code>textColor "#ffffff"</code>。'],
  ['<code>textWidth</code>', '文字排版宽度，须 &gt; 0。'],
  ['<code>textOffsetX</code> / <code>textOffsetY</code>', '文字相对框体的偏移。'],
  ['<code>bubbleWidth</code>', '气泡宽度。'],
  ['<code>bubbleMinHeight</code> / <code>bubbleMaxHeight</code>', '气泡初始与最大高度。'],
  ['<code>bubblePaddingY</code>', '气泡上下内边距，不能小于 0。'],
  ['<code>typeSpeed</code>', '逐字速度倍率，须 &gt; 0，数值越大越快。'],
  ['<code>speed</code> / <code>punctuationPause</code>', '基础逐字间隔与标点额外停顿，单位为秒；间隔 &gt; 0，停顿 ≥ 0。'],
  ['<code>shadowX</code> / <code>shadowY</code>', '阴影偏移；正数向右、向下。'],
  ['<code>shadowColor</code> / <code>shadowAlpha</code>', '阴影颜色与不透明度 0～1。'],
  ['<code>enter</code> / <code>exit</code>', '<code>default</code> 使用默认动画；<code>none</code> 关闭。'],
  ['<code>tail</code> / <code>purple</code>', '漫画箭头方向 / 是否使用紫色样式。'],
  ['<code>overflow</code>', '<code>grow</code>、<code>shrink</code>、<code>scroll</code>、<code>clip</code>，详见下一章。'],
])}
<p>不同模式支持的效果不同。例如阴影用于漫画气泡、普通/云朵/爆炸框、独白和拟声等；不是所有框体都响应全部参数。</p>
<h2>专用预设的参数</h2>
${table(['类型', '支持的主要参数'], [
  ['章节开场', '<code>uiX uiY uiScale uiRot uiOpacity cinema</code>；hold 写在 opening 语句上。'],
  ['地点标识', '<code>uiX uiY uiScale uiRot uiOpacity</code>；hold 写在 location 语句上。'],
  ['新闻框', '整体变换、文字偏移、字号/颜色、逐字速度、阴影、enter/exit；<code>entryDuration</code> 设置入场秒数，默认 0.5，须 &gt; 0。'],
  ['全屏文字', '整体变换、文字偏移、字号/颜色、逐字速度和 exit。'],
  ['转场', '<code>kind</code> 和 <code>hold</code>；hold 至少 0.2 秒。'],
  ['动作', '<code>duration</code>、<code>ease</code>；跑入还支持 from，拉伸还支持 scaleX/scaleY。'],
])}
<h2>模板自带的预设</h2>
<p>普通对话框、普通对话框·无名字、云朵内心框、云朵对话框·有名字、爆炸框、爆炸框·无名字、独白框、紫色内心独白框、漫画对话气泡、思考气泡、紫色内心气泡、动画字幕、旁白框、拟声框、普通打字机、新闻框·主播、新闻框·简报、全屏文字、章节开场、章节开场·无电影边框、地点标识、转场·黑场、转场·圆形、转场·推镜、转场·色条、跑入、拉伸。</p>
<p>可点击“+ 新增”创建自己的预设。新手建议先在已有预设上使用单句参数覆盖，确认效果后再编辑共享样式。</p>`,
    },
    {
      id: 'text', group: '写出你的剧情', title: '长文字与逐字效果',
      description: '解决气泡装不下、想强调某几个字，以及想让台词停顿或改变速度的问题。',
      keywords: 'overflow grow shrink scroll clip 长文本 文字 滚动 富文本 color size speed pause br 打字机',
      body: `
<h2>长气泡的四种处理方式</h2>
${table(['overflow 值', '行为', '适合'], [
  ['<code>grow</code>', '逐步增高到 bubbleMaxHeight，超过后随打字滚动。', '一般长台词，建议优先尝试。'],
  ['<code>shrink</code>', '固定为 bubbleMinHeight，缩小字号，最低为 12；仍放不下则裁切。', '需要固定框体的短段落。'],
  ['<code>scroll</code>', '固定高度，文字随打字向上滚动。', '长独白、必须控制气泡高度时。'],
  ['<code>clip</code>', '固定高度，仅显示开头能容纳的内容。', '刻意截断的文字。'],
])}
${code(String.raw`
preset 漫画对话气泡 overflow scroll bubbleWidth 800 bubbleMinHeight 320 bubbleMaxHeight 600 bubblePaddingY 60
ner manga "列车已经晚点了很久。站台上的人渐渐离开，只有雨水还在沿着屋檐落下。我想再等一会儿，也许下一次广播响起时，就能听见我们盼望的消息。"`)}
<p><code>grow</code> 和 <code>scroll</code> 出现滚动后，可以在文字区域滚轮或触摸拖动。拖回底部后，继续自动跟随新文字。正式发布前请在目标屏幕上确认可读性。</p>
<h2>调整整句打字节奏</h2>
${code(String.raw`
preset 普通打字机 speed 0.06 punctuationPause 0.2 typeSpeed 1
ner normal "听，雨声变小了。我们再等等。"`)}
<p><code>speed 0.06</code> 是每字基础间隔 0.06 秒，<code>punctuationPause 0.2</code> 在标点后额外停顿 0.2 秒。句末不会再增加标点等待。<code>typeSpeed</code> 是倍率，越大越快。</p>
<h2>只强调一部分文字</h2>
${code(String.raw`
ner normal "注意<color=#ffcc00>站台边缘</color>。"
erpin normal "我看见了<size=64>列车的灯光</size>！"
ner normal "先等等。<pause=500ms>再往前走。"
erpin normal "<speed=2>这句话说快一点。</speed>现在恢复。"
ner normal "<speed=80ms>每个字间隔 80 毫秒。</speed>"
ner normal "第一行。<br>第二行。"`)}
${table(['标签', '说明'], [
  ['<code>&lt;color=#ffcc00&gt;…&lt;/color&gt;</code>', '只改变包裹文字的颜色。'],
  ['<code>&lt;size=64&gt;…&lt;/size&gt;</code>', '绝对字号；也支持 +12、-6、120% 等相对写法。'],
  ['<code>&lt;speed=2&gt;…&lt;/speed&gt;</code>', '局部速度倍率，2 为两倍速，0.5 为半速。'],
  ['<code>&lt;speed=80ms&gt;…&lt;/speed&gt;</code>', '直接指定局部逐字间隔；也可写秒。'],
  ['<code>&lt;pause=0.5&gt;</code>', '在下一个字前停 0.5 秒；可写 500ms。与标点停顿相加。'],
  ['<code>&lt;br&gt;</code> / <code>\\n</code>', '换行。'],
])}
${note('标签会影响排版', '放大字号可能改变换行。完整的富文本要保留成对的结束标签；不要照搬 HTML、Markdown 或任意网页标签。')}`,
    },
    {
      id: 'motion', group: '写出你的剧情', title: '角色动作与移动',
      description: 'Spine 动画决定角色自身怎么动；move 决定整个角色或图片在舞台上怎么移动。',
      keywords: 'anim skin move x y rot alpha brightness scaleX scaleY 缓动 跑入 拉伸 fade 透明',
      body: `
<h2>切换 Spine 动作和皮肤</h2>
${code(String.raw`
show ner at left pose Idle_1
skin ner Normal
anim ner Happy_1 fade 0.25
ner normal "终于有好消息了。"`)}
<p><code>anim</code> 的 <code>fade</code> 是混合过渡秒数，默认 0.25。皮肤与动作是两条独立指令。动作名、皮肤名从编辑器的 Spine 面板选，避免凭感觉拼写。</p>
${note('先显示，再控制', '角色未登场、已被 hide，或延时控制早于 show 时，不能对它使用 anim 或 skin。把 show 放在较早的时间点；同一时间点则写在前面。', true)}
<h2>让角色边说边走</h2>
${code(String.raw`
parallel:
  ner manga "我往前走一点。"
  move ner x by 100 in 800ms ease InOutSine`)}
<p><code>by 100</code> 表示从当前位置向右移动 100；向左则写负数。<code>in 800ms</code> 是耗时，<code>ease</code> 是速度变化曲线。<code>move</code> 轨道写在 <code>parallel</code> 或 <code>同时</code> 块内。</p>
<h2>指定起点终点，或延时移动</h2>
${code(String.raw`
parallel:
  move ner x 578 -> 760 in 1s ease OutCubic
  move ner y by -30 in 500ms after 200ms ease InOutSine
  move ner brightness 0.5 -> 1 in 1s ease Linear
  wait 1s`)}
${table(['属性', '对象效果'], [
  ['<code>x</code> / <code>y</code>', '横向 / 纵向位置。'],
  ['<code>sx</code> / <code>sy</code>', '横向 / 纵向缩放；也接受 scaleX / scaleY。'],
  ['<code>rot</code> / <code>rotate</code>', '旋转角度。'],
  ['<code>alpha</code>', '不透明度，0～1。'],
  ['<code>brightness</code>', '对象亮度，0 黑色，1 原亮度，可大于 1。'],
])}
<p>绝对值使用 <code>起点 -&gt; 终点</code>；相对值使用 <code>by 偏移</code>。同一属性的绝对动作以后开始的为准，同时开始时后写的为准；相对动作会叠加。</p>
<h2>直接使用动作预设</h2>
${code(String.raw`
parallel:
  move ner preset 跑入 from left duration 0.6 ease OutCubic
  ner normal "我来了！"

parallel:
  move ner preset 拉伸 scaleX 1.08 scaleY 0.92 duration 0.3
  wait 300ms`)}
<p><code>跑入</code> 从屏幕外移动到当前站位，<code>from</code> 可选 left/right。<code>拉伸</code> 以当前大小乘上 scaleX/scaleY；结束后保持拉伸后的值，不会自动弹回。</p>
<h2>可用缓动名称</h2>
<p><code>Linear</code> 匀速；<code>InSine</code> 慢起；<code>OutSine</code> 慢停；<code>InOutSine</code> 两端平缓；<code>InCubic</code>、<code>OutCubic</code>、<code>InOutCubic</code> 变化更明显；<code>OutBack</code> 有回弹；<code>OutQuint</code> 快起慢停。名称区分大小写。</p>`,
    },
    {
      id: 'parallel', group: '写出你的剧情', title: '同时演出与延时',
      description: '把同一段里的台词、移动、背景、音频放到一条时间线上。先理解开始时间，再组合演出。',
      keywords: 'parallel 同时 after wait timeline 时间线 并发 延时 等待 提前翻页 事件 say',
      body: `
<h2>parallel：同一时刻开始</h2>
${code(String.raw`
parallel:
  ner normal "我们一起过去吧。"
  move ner x by 100 in 1s ease InOutSine
  move erpin x by -100 in 1s ease InOutSine`)}
<p>三条内容都从本段的 0 秒开始。也可以把 <code>parallel:</code> 写成 <code>同时:</code>。旧写法 <code>say ner normal "…"</code> 仍支持，新剧本直接写角色名即可。</p>
<h2>after：推迟某些事件</h2>
${code(String.raw`
parallel:
  move ner x by 100 in 1s
  after 500ms:
    ner manga "走到一半，再开口。"
    audio play rain volume 0.3
    anim ner Surprise_1 fade 0.25
  after 800ms:
    camera zoom 1.05`)}
<p><code>after 500ms:</code> 的内容从本并行块开始后 0.5 秒执行。嵌套的 after 会相加，例如外层 500ms、内层 200ms，就是第 700ms 执行。延时台词开始前，点击不会提前显示文字。</p>
<h2>wait：等一段时间</h2>
${code(String.raw`
wait 500ms
parallel:
  move ner x by 100 in 1s
  after 500ms:
    wait 1s
ner normal "等到第 1.5 秒才出现。"`)}
<p>独立 <code>wait</code> 隐藏对话框、保留舞台，到时自动继续，点击不会跳过。没有台词的 parallel 也会自动等到动作、事件触发时间及 wait 都结束。这里的最长等待是 0.5 + 1 = 1.5 秒。</p>
<h2>哪些可以放进 parallel</h2>
${table(['类别', '可用内容'], [
  ['一条对话', '角色台词、narration、cloud、sfx、news、fullscreen；每个并行块最多一条。'],
  ['舞台', 'show/hide 角色或图片、move、anim、skin、bind、unbind。'],
  ['环境', 'camera、scene bg、effect、shader、audio play/stop。'],
  ['其他', 'oneshot spine、wait、after；preset 按书写顺序影响下一条兼容对话。'],
  ['需要放在块外', 'choice、label、jump、end 等控制流，以及开场、地点、转场等专用段落。'],
])}
${note('事件按时间排序', '先写 after 800ms、再写 after 200ms，仍然先执行 200ms 的事件。同一时刻按书写顺序执行，所以应先 show，再 bind、anim 或 move。')}
<h2>提前点击翻页会怎样</h2>
<p>手动播放可以提前结束有台词的并行段落。正常播放时，已经发生的角色、图片、镜头、背景混合、效果和着色器状态会沿路线继续；尚未触发的事件取消，不会补做。开始播放的音频继续，未到时间的音频取消；一次性表情随翻页停止。</p>
<p>自动播放会等本句打字、hold 和时间线结束。编辑器静态跳段没有完整路线历史，也不会触发音频。验证动作连续性时，请用“运行预览”从头播放，并分别测试自然等待和提前翻页。</p>`,
    },
    {
      id: 'camera', group: '写出你的剧情', title: '背景、镜头与画面效果',
      description: '切换场景、推近镜头或让画面变暗。每次演出后记得按需要恢复镜头和效果。',
      keywords: 'scene bg camera zoom follow reset offset rotate effect tint brightness contrast saturation blur tintAlpha shader heat dream gray glitch wave',
      body: `
<h2>背景切换与交叉淡化</h2>
${code(String.raw`
scene bg station
narration "站台上只剩下雨声。"
parallel:
  scene bg hall in 500ms ease Linear
  wait 500ms
narration "她们走进候车厅。"`)}
<p>不写 <code>in</code> 时即时换背景；渐变必须放在 parallel 中。淡化时长写秒或毫秒，默认缓动 OutCubic。<code>scene bg black</code> 使用内置黑屏，不需要声明素材。</p>
<h2>镜头即时设置</h2>
${code(String.raw`
camera zoom 1.1
ner normal "镜头近了一些。"
camera follow ner offset 0,300
ner normal "镜头跟着角色。"
camera reset
narration "恢复默认镜头。"`)}
<p><code>zoom</code> 必须大于 0。<code>follow</code> 跟随舞台对象，offset 调整跟随偏移；跟随期间位置由跟随逻辑决定，不能依赖 camera x/y 直接控制画面位置。</p>
<h2>镜头平滑变化</h2>
${code(String.raw`
parallel:
  camera zoom 1 -> 1.15 in 1s ease InOutSine
  camera x by 80 in 1s
  camera rotate 0 -> 3 in 1s
  ner normal "慢慢靠近一点。"
camera reset`)}
<p>平滑变化写在 parallel 内；x、y、rotate 支持 by，zoom 暂不支持 by。同属性绝对设置按开始时间覆盖，相对设置叠加。</p>
<h2>亮度、模糊与染色</h2>
${code(String.raw`
effect tint "#4466aa" 0.2
parallel:
  effect brightness 1 -> 0.65 in 1s ease Linear
  effect tintAlpha 0.2 -> 0.4 in 1s
  ner normal "天色更暗了。"
effect reset
ner normal "灯亮了。"`)}
${table(['效果', '值'], [
  ['<code>brightness</code>', '场景亮度，默认 1；与对象自己的 brightness 叠加。'],
  ['<code>contrast</code> / <code>saturation</code>', '对比度 / 饱和度，默认 1，不可为负。'],
  ['<code>blur</code>', '模糊量，默认 0，不可为负。'],
  ['<code>tint "#颜色" 透明度</code>', '设置染色颜色和透明度 0～1。'],
  ['<code>tintAlpha</code>', '染色透明度，0～1；渐变前先用 effect tint 设置颜色。'],
  ['<code>effect reset</code>', '恢复全部场景效果默认值。'],
])}
<p>上述数值属性可在 parallel 中用起点 -&gt; 终点渐变，目前不支持 by 相对渐变。</p>
<h2>着色器效果</h2>
${code(String.raw`
parallel:
  shader dream 0.35
  after 800ms:
    shader reset
  ner think "刚才像是一场梦。"`)}
<p>内置 <code>heat</code>、<code>dream</code>、<code>gray</code>、<code>glitch</code>、<code>wave</code>，后接非负强度。<code>shader reset</code> 关闭当前着色器。</p>
<p>自定义语法是 <code>shader custom "assets/shaders/effect.frag" 0.6</code>，文件必须是项目 <code>assets/shaders/</code> 下的 .frag。它属于进阶功能，先确认目标设备支持 WebGL；加载或编译失败时会显示效果警告，并继续剧情。</p>`,
    },
    {
      id: 'audio', group: '写出你的剧情', title: '配乐与音效',
      description: '声明音频，控制音量、循环和淡入淡出。项目模板中的 silent.wav 是静音占位文件。',
      keywords: 'audio play stop loop times volume fadeIn fadeOut 音乐 BGM 音效 静音 自动播放',
      body: `
<h2>先声明，再播放</h2>
${code(String.raw`
define audio.rain = "assets/audio/silent.wav"
audio play rain loop volume 0.5 fadeIn 1s
narration "雨声渐渐响起。"
audio stop rain fadeOut 1s
narration "雨慢慢停了。"
end`, 'full')}
${note('为什么没有声音', '<code>silent.wav</code> 本身没有可听声音。要验证音效，换成你自己的有效音频文件，并修改声明路径。<code>sfx "咚"</code> 只显示拟声文字，也不会自动播放声音。', true)}
<h2>播放参数</h2>
${table(['参数', '含义'], [
  ['<code>volume 0.5</code>', '音量 0～1。'],
  ['<code>loop</code>', '持续循环，直到 audio stop。'],
  ['<code>times 2</code>', '总共播放两次；不能与 loop 同时使用。'],
  ['<code>fadeIn 500ms</code>', '从开始播放时淡入。'],
  ['播放命令中的 <code>fadeOut 1s</code>', '最后一次播放接近结尾时淡出；不能与 loop 同时使用。'],
  ['停止命令中的 <code>fadeOut 1s</code>', '从停止命令触发时开始淡出，适合停止循环配乐。'],
])}
${code(String.raw`
audio play rain volume 0.5 times 2 fadeIn 500ms fadeOut 1s
ner normal "听见了吗？"`)}
<h2>与动作同时触发</h2>
${code(String.raw`
parallel:
  after 500ms:
    audio play rain volume 0.4
  ner normal "先等半秒，再响起声音。"`)}
<p>普通音频命令会随下一段可播放剧情执行；写在 parallel 的 after 中则在对应事件时间执行。同名音频再次播放会替换前一次；提前翻页取消尚未触发的音频，已播放的继续。</p>
<h2>浏览器或手机不出声</h2>
<p>先点击一次播放画面。浏览器和手机可能限制自动播放，后续用户交互会尝试恢复尚未停止的音频。再检查系统音量、文件是否静音、路径和格式；静态跳段预览不会触发音频，使用“运行预览”重新播放验证。</p>`,
    },
    {
      id: 'branches', group: '写出你的剧情', title: '选项、变量与条件',
      description: '让玩家作选择，用变量记录路线，再通过条件显示不同内容。这里只使用受限表达式，不需要 Python。',
      keywords: 'choice label jump default set if else and or not bool 布尔 数字 字符串 条件 好感 信任 分支 选项 存档',
      body: `
<h2>最简单的分支</h2>
${code(String.raw`
choice "接下来去哪里？"
  "去站台" -> platform
  "去候车厅" -> hall_route

label platform:
  narration "她走向站台。"
  jump finish

label hall_route:
  narration "她留在候车厅。"
  jump finish

label finish:
  fullscreen "雨终于停了。"
  end`)}
<p>选项箭头后是目标标签名称。<code>jump finish</code> 让路线汇合；少写 jump 可能继续向下执行另一条路线。</p>
<h2>记录选择</h2>
${code(String.raw`
default trust = 0
default waited = false
default nickname = "旅人"

set trust += 1
set waited = true
if trust >= 1 and waited:
  narration "她愿意继续等待。"
else:
  narration "她准备离开。"
end`, 'full')}
<p><code>default</code> 声明初值，支持数字、布尔值 true/false 和英文双引号字符串。<code>set</code> 修改变量；数字支持 <code>+=</code>、<code>-=</code>、<code>*=</code>、<code>/=</code> 等算术赋值，使用前必须声明，类型要一致。</p>
<h2>带条件的选项</h2>
${code(String.raw`
default trust = 1
choice "要听她的建议吗？"
  "继续等待" -> stay
  "一起去找信号灯" -> investigate if trust >= 2
label stay:
  narration "先留在原地。"
  jump finish
label investigate:
  narration "一起去看看。"
label finish:
  end`, 'full')}
<p>条件不满足的选项会不可点击。当前 trust 为 1，第二项不能选；把初值改成 2 后重新运行即可测试另一条路线。</p>
<h2>表达式能写什么</h2>
${table(['类别', '写法'], [
  ['比较', '<code>== != &gt; &gt;= &lt; &lt;=</code>，如 <code>trust &gt;= 2</code>。'],
  ['逻辑', '<code>and</code>、<code>or</code>、<code>not</code>。'],
  ['算术', '<code>+ - * / %</code> 与括号。'],
  ['分组', '<code>(trust &gt;= 2 or waited) and not left</code>，涉及的变量都须先声明。'],
])}
${note('变量目前没有跨重启存档', '变量会沿实际选择的路线变化，但当前没有存档文件保存这些变量。重新开始会恢复 default；未访问段的跳转预览也从默认初值开始。要核对路线，使用完整案例逐条选一遍。')}`,
    },
    {
      id: 'opening', group: '写出你的剧情', title: '开场、地点与转场',
      description: '为故事加上章节标题、地点提示和遮罩过渡。转场与换背景是两个独立动作。',
      keywords: 'opening location transition cinema 章节 标题 地点 黑场 圆形 推镜 色条 hold news',
      body: `
<h2>章节开场</h2>
${code(String.raw`
scene bg black
preset 章节开场 uiScale 0.95 cinema false
opening 1 "雨夜的末班车" hold 0 cinema on bg station
scene bg station
ner normal "故事开始了。"`)}
<p><code>opening</code> 后依次写章节编号和标题，<strong>hold 必填</strong>，表示入场结束后停留的秒数。<code>hold 0</code> 仍播放入场，只是不额外停留。<code>cinema on/off</code> 控制电影边框，语句本身设置优先于预设。</p>
<p><code>bg station</code> 指开场画面的背景，black 是内置黑屏。想调整位置、缩放、旋转和透明度，可在开场预设中写 uiX、uiY、uiScale、uiRot、uiOpacity。</p>
<h2>地点标识</h2>
${code(String.raw`
preset 地点标识 uiX 40 uiY -20 uiOpacity 0.9
location "王都 · 中央车站" hold 1
narration "站台上空无一人。"`)}
<p>地点语句也要显式写 hold 秒数。结束后自动继续；位置等参数通过对应预设设置。</p>
<h2>遮罩转场</h2>
${code(String.raw`
preset 转场·黑场 hold 0.8
transition
scene bg hall
narration "她们已经来到候车厅。"
transition circle hold 1.2
ner normal "现在去站台看看。"`)}
<p>转场在当前舞台播放遮罩，结束后自动继续；它<strong>不会替你切换背景</strong>。要连续混合两张背景，使用 ${link('camera', '背景交叉淡化')}。</p>
${table(['名称', '效果'], [
  ['<code>fadeblack</code>', '黑场遮罩，默认类型。'],
  ['<code>circle</code>', '圆形遮罩。'],
  ['<code>rightpush</code>', '推镜遮罩。'],
  ['<code>colorbars</code>', '色条遮罩。'],
  ['<code>fadeinblack</code> / <code>fadeoutblack</code>', '黑色单向淡入 / 淡出。'],
  ['<code>fadeinwhite</code> / <code>fadeoutwhite</code>', '白色单向淡入 / 淡出。'],
])}
<p>转场时长至少 0.2 秒。语句直接指定的类型和时长优先于预设。动画是引擎绘制或重放的效果，部分为近似，并非直接运行 Unity 动画。</p>`,
    },
    {
      id: 'advanced', group: '写出你的剧情', title: '绑定图片与一次性表情',
      description: '让道具跟随角色，再按指定时间解绑；用一次性 Spine 表情丰富短暂的反应。',
      keywords: 'bind unbind offset parent 父级 子级 图片 道具 oneshot spine emoticon Idea 表情',
      body: `
<h2>图片跟随角色</h2>
${code(String.raw`
show image hall as poster at 960,540 scale 0.12
bind poster to ner offset 100,-350
parallel:
  move ner x by 120 in 1s
  move poster alpha 1 -> 0.6 in 1s
  ner normal "带着这张地图一起走。"`)}
<p><code>bind 子对象 to 父对象 offset x,y</code> 使用父级本地坐标计算偏移，跟随父级位置、旋转和缩放。绑定对象必须都已存在，不能自我绑定或形成循环。</p>
<h2>在时间线上解绑</h2>
${code(String.raw`
show image hall as card at 960,540 scale 0.12
parallel:
  after 200ms:
    bind card to ner offset 100,-300
  after 800ms:
    unbind card at 1180,520
  wait 1s
ner normal "放到这里。"`)}
<p>parallel 内解绑必须写 <code>at x,y</code>，指定脱离后的屏幕位置。块外的兼容写法为 <code>unbind card</code>；需要精确放置时，推荐上面的时间线写法。</p>
${note('绑定后的位置由父级决定', '绑定期间可单独移动子级的 alpha、brightness。要改位置、旋转或缩放关系，请先解绑或重新绑定 offset，不要依赖对子级这些属性的 move 来改变绑定偏移。')}
<h2>一次性 Spine 表情</h2>
<p>先在剧本开头声明 <code>define emoticon = Spine("assets/spine/emoticon")</code>，再在演出中使用：</p>
${code(String.raw`
parallel:
  after 100ms:
    oneshot spine emoticon anim Idea at 960,520 scale 0.8 alpha 1
  ner normal "我想到办法了！"`)}
${table(['参数', '含义'], [
  ['<code>anim</code>', '表情模型内的动画名，例如模板中的 Idea。'],
  ['<code>at</code>', '屏幕坐标 x,y。'],
  ['<code>scale</code> / <code>alpha</code>', '缩放 &gt; 0，不透明度 0～1。'],
  ['<code>rot</code> / <code>face</code> / <code>skin</code>', '旋转、镜像方向 1/-1、模型内部皮肤。'],
])}
<p>同一并行块可以放多个表情；自动播放会等它结束，手动翻页会停止当前表情并取消未触发的表情。静态预览按时间定位。动画名未找到时目前会退回第一个动画，因此仍要实际检查效果；加载问题可查看控制台。</p>`,
    },
    {
      id: 'commands', group: '命令速查', title: '剧情命令总表',
      description: '忘记写法时查这里。表中的名称和路径是示意，先按对应章节声明素材或创建对象，再使用命令。',
      keywords: '命令 指令 速查 全部 功能 语法 cheatsheet',
      body: `
<h2>声明与舞台</h2>
${table(['命令写法', '功能', '详细说明'], [
  ['<code>image station = "assets/bg/a.png"</code>', '声明图片，可用于背景或舞台对象', link('assets', '素材声明')],
  ['<code>define ner = Spine("assets/spine/ner", name="尼尔")</code>', '声明 Spine 与说话者', link('assets', '角色声明')],
  ['<code>define audio.rain = "assets/audio/rain.ogg"</code>', '声明音频', link('audio', '音频')],
  ['<code>scene bg station</code>', '即时切换背景；black 为内置黑屏', link('camera', '背景')],
  ['<code>scene bg hall in 500ms ease Linear</code>', '背景交叉淡化，仅在 parallel 内', link('camera', '背景渐变')],
  ['<code>show ner at left pose Idle_1</code>', '显示角色并设站位和动作', link('assets', '显示角色')],
  ['<code>spawn ner as ner_copy at right</code>', '创建同素材的另一实例', link('assets', '实例')],
  ['<code>show image hall as poster at 960,540</code>', '显示图片对象；spawn image 也支持', link('assets', '图片')],
  ['<code>hide ner</code> / <code>hide all</code>', '移除指定对象 / 全部舞台对象', link('assets', '退场')],
  ['<code>anim ner Happy_1 fade 0.25</code>', '切换角色 Spine 动画', link('motion', '角色动作')],
  ['<code>skin ner Normal</code>', '切换角色内部皮肤', link('motion', '皮肤')],
  ['<code>bind poster to ner offset 80,-300</code>', '对象绑定', link('advanced', '绑定')],
  ['<code>unbind poster at 100,200</code>', '并行块内解除绑定并设位置', link('advanced', '解绑')],
])}
<h2>文字与专用演出</h2>
${table(['命令写法', '功能', '详细说明'], [
  ['<code>ner normal "台词"</code>', '角色对话；可更换 normal 等模式', link('dialogue', '对话模式表')],
  ['<code>preset 漫画对话气泡 fontSize 56</code>', '下一句使用预设及单次参数', link('presets', '预设参数')],
  ['<code>narration "旁白"</code>', '旁白框', link('dialogue', '旁白')],
  ['<code>sfx "咚" at 960,470</code>', '拟声文字，不播放音频', link('dialogue', '拟声')],
  ['<code>news anchor "广播内容"</code>', '主播新闻框；summary 为简报', link('dialogue', '新闻框')],
  ['<code>fullscreen "结语"</code>', '全屏文字', link('dialogue', '全屏文字')],
  ['<code>opening 1 "标题" hold 0 cinema on bg black</code>', '章节开场，编号与 hold 必填', link('opening', '开场')],
  ['<code>location "中央车站" hold 1</code>', '地点标识，hold 必填', link('opening', '地点')],
  ['<code>transition circle hold 1.2</code>', '遮罩转场，不改变背景', link('opening', '转场')],
  ['<code>oneshot spine emoticon anim Idea at 960,520</code>', '一次性 Spine 表情', link('advanced', '表情')],
])}
<h2>时间、镜头与声音</h2>
${table(['命令写法', '功能', '详细说明'], [
  ['<code>parallel:</code> / <code>同时:</code>', '开始并行块，内容缩进', link('parallel', '并行规则')],
  ['<code>after 500ms:</code>', '并行块内延时，内容再次缩进', link('parallel', '延时')],
  ['<code>wait 1s</code>', '等待后自动继续，须写时间单位', link('parallel', '等待')],
  ['<code>move ner x 578 -&gt; 760 in 1s ease OutCubic</code>', '绝对值移动，仅在 parallel 内', link('motion', '移动')],
  ['<code>move ner x by 100 in 500ms</code>', '相对移动，仅在 parallel 内', link('motion', '相对移动')],
  ['<code>move ner preset 跑入 duration 0.6</code>', '动作预设，仅在 parallel 内', link('motion', '动作预设')],
  ['<code>camera zoom 1.2</code>', '即时镜头设置', link('camera', '镜头')],
  ['<code>camera zoom 1 -&gt; 1.2 in 1s</code>', '镜头渐变，仅在 parallel 内', link('camera', '镜头渐变')],
  ['<code>camera follow ner offset 0,300</code>', '跟随对象', link('camera', '跟随')],
  ['<code>camera reset</code>', '恢复默认镜头', link('camera', '镜头重置')],
  ['<code>effect brightness 0.8</code>', '即时画面效果；reset 恢复', link('camera', '画面效果')],
  ['<code>effect brightness 1 -&gt; 0.5 in 1s</code>', '效果渐变，仅在 parallel 内', link('camera', '效果渐变')],
  ['<code>shader dream 0.35</code>', '着色器；reset 关闭', link('camera', '着色器')],
  ['<code>audio play rain loop volume 0.5</code>', '播放音频', link('audio', '播放参数')],
  ['<code>audio stop rain fadeOut 1s</code>', '停止音频并淡出', link('audio', '停止')],
])}
<h2>流程与变量</h2>
${table(['命令写法', '功能', '详细说明'], [
  ['<code>default trust = 0</code>', '声明变量初值', link('branches', '变量')],
  ['<code>set trust += 1</code>', '修改变量', link('branches', '赋值')],
  ['<code>if trust &gt;= 2:</code> / <code>else:</code>', '条件分支，内容缩进', link('branches', '条件')],
  ['<code>choice "要去哪？"</code>', '选项标题，下面缩进写选项', link('branches', '选择')],
  ['<code>"去站台" -&gt; platform if trust &gt;= 2</code>', '选项目标，可带条件', link('branches', '条件选项')],
  ['<code>label platform:</code>', '声明跳转标签', link('branches', '标签')],
  ['<code>jump platform</code>', '跳转到标签', link('branches', '跳转')],
  ['<code>end</code>', '结束播放', link('cases-first', '完整示例')],
])}
${note('推荐语法的范围', '本表面向当前制作流程。旧项目里的独立 <code>ui</code> 实验对象、历史兼容别名及内部演示命令不作为新手创作接口；常用功能请优先按本表和案例编写。')}`,
    },
    {
      id: 'cases-first', group: '动手案例', title: '案例一：一段双人对话',
      description: '一份可以整段替换运行的完整剧本。只使用新项目自带的素材和预设。',
      keywords: '案例 完整 复制 雨夜 车站 背景 开场 对话 初学者',
      body: `
<h2>练习目标与操作</h2>
<p>目标：章节开场 → 车站背景 → 两名角色出现 → 漫画与普通对话 → 结尾。先新建练习项目，再将 <code>story/main.trickcal</code> 替换为下面全部内容，保存并运行预览。</p>
${code(String.raw`
# 1. 声明素材
image ner_avatar = "assets/herohead/ner.png"
image erpin_avatar = "assets/herohead/erpin.png"
define ner = Spine("assets/spine/standing/ner", name="尼尔", avatar=ner_avatar, avatarBg="#9fc766")
define erpin = Spine("assets/spine/standing/erpin", name="埃尔芬", avatar=erpin_avatar, avatarBg="#e7b35f")
image station = "assets/bg/elf_city_night.png"

# 2. 章节开场
scene bg black
preset 章节开场
opening 1 "一起等雨停" hold 0 bg station
scene bg station
location "中央车站" hold 0

# 3. 角色登场
show ner at left face -1 pose Idle_1
show erpin at right face 1 pose Idle_1
narration "最后一班列车，还没有到。"

# 4. 台词与动作
preset 漫画对话气泡 tail br
erpin manga "还好，我没有迟到！"
preset 普通对话框
ner normal "只是列车比你更晚一些。"
anim erpin Happy_1 fade 0.25
erpin normal "那我们一起等吧。"
preset 紫色内心气泡
ner manga "这样等下去，好像也不坏。"

# 5. 收尾
hide all
fullscreen "有人陪伴，雨夜也不再漫长。"
end`, 'full')}
<h2>你应该看到什么</h2>
<p>开场标题是“一起等雨停”，背景变成夜间车站，两名角色分站左右。埃尔芬用漫画气泡说话，之后切换到普通对话，尼尔最后显示紫色内心漫画气泡。点击到全屏结语后结束。</p>
<h2>试着改这三处</h2>
<ol><li>把 opening 的标题改成你自己的作品名。</li><li>把最后一句紫色气泡改成 <code>ner think "…"</code>，并改用“思考气泡”预设，比较尾巴的区别。</li><li>在某句台词前加 <code>anim ner Happy_1 fade 0.25</code>，观察表情变化。</li></ol>
${note('与现有剧本组合时', '这是完整剧本，已经包含素材声明。不要整段接在另一份已有声明的剧本后面，否则会出现名称重复。组合片段时保留一份声明即可。')}`,
    },
    {
      id: 'cases-branch', group: '动手案例', title: '案例二：带条件的分支',
      description: '用一个信任值和两次选择，制作有条件解锁的路线。此案例不需要任何外部素材。',
      keywords: '案例 条件 好感度 信任 trust choice default set if 完整 分支',
      body: `
<h2>完整可运行剧本</h2>
<p>在新的练习项目中替换全部剧本。第一次选择决定 trust 是否增加，第二次选择据此决定“去站台”能否点击。</p>
${code(String.raw`
default trust = 0
scene bg black
narration "末班车还没有来，她提议再等一会儿。"

choice "你怎么回答？"
  "我相信你，再等等" -> believe
  "还是先留意广播吧" -> doubt

label believe:
  set trust += 1
  narration "她松了一口气。"
  jump next_choice

label doubt:
  narration "你们继续听着广播。"
  jump next_choice

label next_choice:
  choice "她发现了远处的信号灯。"
    "一起去站台查看" -> platform if trust >= 1
    "留在候车厅" -> stay

label platform:
  narration "你选择相信她，一起走向信号灯。"
  jump ending

label stay:
  narration "你们留在原地，等到了下一次广播。"
  jump ending

label ending:
  if trust >= 1:
    fullscreen "谢谢你愿意相信我。"
  else:
    fullscreen "慢慢来，也是一种选择。"
  end`, 'full')}
<h2>如何验证两个结果</h2>
${table(['第一次选择', '信任值', '第二次选择与结局'], [
  ['“我相信你，再等等”', 'trust = 1', '可以去站台，也可留在候车厅；结语为“谢谢你愿意相信我”。'],
  ['“还是先留意广播吧”', 'trust = 0', '去站台不可点击；留在候车厅后显示“慢慢来，也是一种选择”。'],
])}
<p>点击编辑器“运行预览”重新开始，再测试另一条路线。不要直接跳到 ending 验证，因为未访问路线的变量历史不会自动生成。</p>
<h2>常见改法</h2>
<p>将变量名 trust 改成 affection 可用来表示好感；将数字改为布尔值可表示“拿到钥匙”。例如先声明 <code>default has_key = false</code>，获得钥匙时写 <code>set has_key = true</code>，选项条件写 <code>if has_key</code>。修改所有引用时保持名字一致。</p>`,
    },
    {
      id: 'cases-stage', group: '动手案例', title: '案例三：一段完整演出',
      description: '把移动、延时台词、一次性表情、背景渐变和镜头组合起来。模板音频保持静音，方便先检查画面。',
      keywords: '案例 动画 parallel after 表情 oneshot camera 背景 切换 音频 演出 完整',
      body: `
<h2>完整可运行剧本</h2>
${code(String.raw`
image ner_avatar = "assets/herohead/ner.png"
define ner = Spine("assets/spine/standing/ner", name="尼尔", avatar=ner_avatar, avatarBg="#9fc766")
define erpin = Spine("assets/spine/standing/erpin", name="埃尔芬")
define emoticon = Spine("assets/spine/emoticon")
image station = "assets/bg/elf_city_night.png"
image hall = "assets/bg/elf_arthall_night.png"
define audio.rain = "assets/audio/silent.wav"

scene bg station
show ner at left pose Idle_1
show erpin at right face -1 pose Idle_1
audio play rain loop volume 0.4 fadeIn 1s
narration "远处的灯，忽然亮了一下。"

# 移动与镜头从 0 秒开始，台词在 0.2 秒出现
parallel:
  move erpin x by -120 in 800ms ease InOutSine
  camera zoom 1 -> 1.08 in 800ms ease InOutSine
  after 200ms:
    erpin manga "我看到信号灯了！"
  after 400ms:
    oneshot spine emoticon anim Idea at 1300,520 scale 0.7

camera reset
ner normal "我们先去候车厅等广播吧。"

# 没有台词的并行段落会自动等待结束
parallel:
  scene bg hall in 600ms ease Linear
  effect brightness 1 -> 0.8 in 600ms
  wait 600ms

audio stop rain fadeOut 1s
effect reset
ner clear "这里暖和多了。"
erpin clearRe "有人一起等，就不觉得久。"
hide all
fullscreen "末班车终于来了。"
end`, 'full')}
<h2>这一段的时间安排</h2>
${table(['相对时间', '事件'], [
  ['0ms', '埃尔芬开始左移，镜头开始推近。'],
  ['200ms', '漫画气泡出现并开始打字。'],
  ['400ms', '一次性 Idea 表情开始。'],
  ['800ms', '移动和镜头补间结束；自动播放还会等台词及表情结束。'],
  ['进入下一段后', '恢复镜头，继续普通对话。'],
  ['背景渐变段', '600ms 内转为候车厅并变暗；结束后恢复效果、停止雨声。'],
])}
<h2>练习与观察</h2>
<p>分别测试等动画结束和提前点击翻页。再打开“时间轴”，定位到并行段落，查看移动轨道与事件时间。把模板的 silent.wav 换成自己的雨声后，再检查淡入淡出。</p>`,
    },
    {
      id: 'export', group: '构建与发布', title: '导出 Web、Windows 与 Android',
      description: '在编辑器选择构建目标，再生成可以独立播放的作品。修改源码或剧本后，已有构建不会自动更新。',
      keywords: '导出 打包 构建 发布 Web Windows Android APK Electron Capacitor 服务器 JDK SDK 输出 exe',
      body: `
<h2>所有平台通用的操作</h2>
${steps([
  ['保存并跑完作品', '修复“问题”中的错误，从头检查所有分支。构建前也会自动保存与检查。'],
  ['选择目标并构建', '在顶部下拉框选择 Web、Windows 程序或 Android APK，点击“构建项目”。'],
  ['打开输出文件夹', '看到“构建完成”后点“打开输出文件夹”。如果失败，先阅读构建窗口里的具体错误。'],
  ['在目标环境再测一次', '新构建是一份独立副本；修改剧本后重新构建，确保发送的是最新输出。'],
])}
<h2>三种目标的区别</h2>
${table(['目标', '输出位置（相对作品目录）', '如何交付与播放'], [
  ['Web', '<code>build/web/</code>', '整个目录部署到静态 HTTP 服务器，访问 index.html。不要只发一个 HTML 文件。'],
  ['Windows', '<code>build/windows/TrickcalStory-win32-x64/</code>', '发送整个文件夹，运行其中的 TrickcalStory.exe；不能只复制 exe。'],
  ['Android', '<code>build/android/</code>', '未配置正式签名时生成 TrickcalStory-debug.apk，供安装测试。'],
])}
<p>Windows 使用 Electron，Android 使用 Capacitor/WebView。它们能生成独立应用，渲染仍是网页运行时。当前不提供 iOS 构建目标。</p>
<h2>本机测试 Web 输出</h2>
<p>Web 播放器需要读取 JSON 和素材，应通过 HTTP 访问，直接双击可能受到浏览器本地文件限制。若本机安装了 Python，可在<strong>作品目录</strong>打开终端运行：</p>
${code('py -m http.server 8080 --directory build/web', 'none', 'shell', '终端 · 作品目录')}
<p>随后在浏览器输入 <code>http://localhost:8080</code>。8080 已占用时换一个端口；结束测试后在终端按 Ctrl+C 关闭服务器。Python 不是编辑器启动必需依赖，这只是本地测试 Web 的一种方式。</p>
<h2>Android 的额外准备</h2>
<p>当前构建代码要求 JDK 21 和 Android SDK。未自动找到时设置 <code>JAVA_HOME</code> 与 <code>ANDROID_HOME</code>（或 ANDROID_SDK_ROOT）；Android shell 的依赖也需已安装。首次 Gradle 构建可能需要网络下载。</p>
${code('npm --prefix packaging/android-shell install', 'none', 'shell', '终端 · 引擎根目录')}
<p>默认 debug APK 供本地测试。正式发布签名见 ${link('android', 'Android 正式签名')}。构建缺少环境时以日志为准，先补齐环境，再重新打开引擎构建。</p>
<h2>旧构建在哪里</h2>
<p>新构建先在临时目录准备，成功后发布。原来的同平台输出移到 <code>build/archive/&lt;平台&gt;/</code>；失败时旧输出保留。Windows 和 Android 构建也会先生成 Web 输出，因此 build/web 可能同步更新。</p>`,
    },
    {
      id: 'android', group: '构建与发布', title: 'Android 正式签名',
      description: '需要发布 Android 正式包时再看这一章。日常测试可以先使用默认 debug APK。',
      keywords: 'Android release 签名 keystore KEYSTORE 密钥 密码 applicationId debug APK 覆盖 安装',
      body: `
<h2>正式包需要四项环境变量</h2>
${table(['变量名', '内容'], [
  ['<code>TRICKCAL_ANDROID_KEYSTORE</code>', '你自己的签名密钥文件绝对路径。'],
  ['<code>TRICKCAL_ANDROID_STORE_PASSWORD</code>', '密钥库密码。'],
  ['<code>TRICKCAL_ANDROID_KEY_ALIAS</code>', '密钥别名。'],
  ['<code>TRICKCAL_ANDROID_KEY_PASSWORD</code>', '该密钥的密码。'],
])}
<p>四项都配置并有效才生成 <code>TrickcalStory-release.apk</code>。只配置其中一部分会报错，不会自动降级为 debug；完全没配置时生成 debug APK。</p>
<h2>让引擎继承这些变量</h2>
<p>在启动引擎之前设置环境，并从同一终端启动；已经运行的引擎不会自动获得新环境。下面是 PowerShell 写法，路径、别名需换成自己的内容，密码会交互输入。</p>
${code(String.raw`
$env:TRICKCAL_ANDROID_KEYSTORE = "D:\keys\my-story.jks"
$env:TRICKCAL_ANDROID_KEY_ALIAS = "my-story"
$env:TRICKCAL_ANDROID_STORE_PASSWORD = [System.Net.NetworkCredential]::new("", (Read-Host "密钥库密码" -AsSecureString)).Password
$env:TRICKCAL_ANDROID_KEY_PASSWORD = [System.Net.NetworkCredential]::new("", (Read-Host "密钥密码" -AsSecureString)).Password
npm.cmd start`, 'none', 'shell', 'PowerShell · 引擎根目录')}
<p>构建完成后妥善关闭该终端。密钥文件不需要放进作品 assets，也不会被当前构建流程复制到新 APK 输出目录。</p>
<h2>应用 ID 与更新安装</h2>
<p>默认 Android 应用 ID 由项目 id 稳定生成。需要固定值时，在现有项目配置中增加 android 字段：</p>
${code('{\n  "android": {\n    "applicationId": "com.example.mystory"\n  }\n}', 'none', 'json', 'trickcal.project.json · 字段片段')}
<p>这是字段片段，合并到原有 JSON 中，保留原来的 title、entry 等内容。不同作品使用不同应用 ID；更新已有应用时，应用 ID 和签名密钥都要与已安装版本一致。</p>
${note('保管自己的签名材料', '不要使用或传播旧构建可能附带的共享密钥与硬编码密码。正式签名材料应在项目之外单独保管并备份；只交付构建后的 APK，不把旧 Android 构建工作目录作为发布包。', true)}`,
    },
    {
      id: 'faq', group: '排错与参考', title: '常见问题排查',
      description: '先看右侧“问题”的具体行号，再按现象排查。每次只改一类问题，保存后重新预览。',
      keywords: '错误 报错 找不到素材 找不到预设 黑屏 没变化 没声音 无法运行 卡顿 选项 灰色 跳转 打字',
      body: `
<h2>启动与预览</h2>
<details open><summary>双击启动脚本没有打开，提示 Electron not found</summary><p>在引擎根目录运行 npm install，完成后再启动。确认不是在作品目录执行，也没有只拿到不带依赖的部分文件。</p></details>
<details><summary>修改台词后预览没有变化</summary><p>按 Ctrl+S，再点击“运行预览”重新载入。已打开的旧预览和 build 输出都不会随剧本自动更新；引擎源码更新后需关闭并重启引擎。</p></details>
<details><summary>点“运行预览”没进入播放</summary><p>查看“问题”面板，修复所有错误；运行前会保存与编译，有错误会中止。点击具体问题定位到对应行。</p></details>
<details><summary>预览黑屏或看不到角色</summary><p>检查 scene bg 是否为 black、角色是否已 show、alpha 是否为 0、brightness 是否过低、坐标是否在舞台外、camera 是否需要 reset。再检查模型贴图与版本兼容性。</p></details>
<h2>素材与台词</h2>
${table(['现象', '优先检查'], [
  ['找不到素材 / 未声明', '声明必须在使用之前；名称大小写一致；路径从项目 assets 开始，文件真实存在。'],
  ['Spine 贴图缺失', '检查 atlas 提示的贴图页；骨骼与 atlas 同名，所有贴图完整。不能只复制 skel。'],
  ['动作不对或角色不动', '从 Spine 面板选择实际动作名；先 show 再 anim/skin。oneshot 名称无效时可能退回第一条动画。'],
  ['独白头像没有显示', '先 image 声明头像，再在 Spine 的 avatar 或台词 avatar 中引用同一名称。'],
  ['找不到预设', '确认 presets 中有对应 JSON，预设名称与文件里的 name 一致；新项目模板带常用预设。'],
  ['写了漫画预设仍是普通框', '把角色语句的 normal 改为 manga。预设不会替你更改对话模式。'],
  ['文字放不下', '调整 bubbleWidth/textWidth、字号或 overflow，参见长文字一章；clip 本来就会裁切。'],
  ['阴影或参数没有效果', '核对当前模式是否支持该参数；开场、地点、新闻、转场各有专用参数范围。'],
  ['音频没有声音', '模板 silent.wav 是静音；换真实音频并先点击画面解锁播放。静态跳段不触发音频。'],
])}
<h2>分支与时间线</h2>
${table(['现象', '解决方法'], [
  ['选项不可点击', '检查选项末尾的 if 条件与变量值；从头运行正确路线，不要直接跳段推断状态。'],
  ['选完一条路又播放另一条路', '路线末尾使用 jump 汇合到共同标签，或 end 结束。'],
  ['parallel 编译失败', '每块最多一条台词，不能包含 choice/jump/label/end；检查缩进与 after 单位。'],
  ['还没出现的音效、表情消失', '提前翻页会取消尚未触发的事件；需要完整演出时使用自动等待，并测试时间安排。'],
  ['wait 期间点击无效', 'wait 设计为计时后自动继续，不接受点击跳过。'],
  ['绑定道具移动无效', '位置/旋转/缩放由父级和 offset 决定；重新绑定偏移或先解绑，alpha/brightness 可独立变化。'],
])}
<h2>构建与性能</h2>
<details><summary>Web 直接双击 HTML 不工作</summary><p>构建播放器会读取 JSON 和素材，使用 HTTP 静态服务器访问整个 build/web；手册本身可以直接双击，因为不依赖 fetch 加载内容。</p></details>
<details><summary>Windows 只有 exe 不能启动</summary><p>发送整个 TrickcalStory-win32-x64 文件夹。Electron 运行时、resources 和其他文件都需要保留。</p></details>
<details><summary>Android 提示 JDK / SDK 或签名失败</summary><p>准备 JDK 21、Android SDK 和 shell 依赖，按日志检查 JAVA_HOME/ANDROID_HOME。正式签名四项环境变量必须齐全，重新启动引擎让变量生效。</p></details>
<details><summary>编辑时比较卡</summary><p>停止不用的运行预览，减少同时播放的复杂模型。编辑器隐藏的预览画布会暂停绘制，但剧情和音频时间仍会继续；大型素材和长剧本仍可能产生负载。</p></details>
<details><summary>着色器提示警告，但剧情继续</summary><p>检查 .frag 路径、WebGL 支持与 shader 编译结果；这是非致命效果警告。先用内置 shader 验证，再测试自定义效果。</p></details>
<h2>建议的排查顺序</h2>
<p>保存 → 看第一个错误的行号 → 检查英文引号、缩进和名称 → 确认素材文件 → 重新运行预览 → 在目标构建中复现。要比较复杂问题，先在新练习项目中保留能复现的最小片段。</p>`,
    },
    {
      id: 'terminal', group: '排错与参考', title: '终端命令与开发检查',
      description: '日常创作可以只用编辑器。这里集中列出源码启动、自动构建和已有测试命令，供需要时查阅。',
      keywords: 'npm start dev test 命令行 powershell electron TRICKCAL_BUILD_PROJECT TRICKCAL_BUILD_TARGET 测试 开发',
      body: `
<h2>启动与安装</h2>
<p>下面的 npm 命令都在<strong>引擎根目录（包含 package.json）</strong>执行，和作品目录不要混淆。</p>
${table(['命令', '用途'], [
  ['<code>npm install</code>', '安装 package.json 中的依赖，首次运行或依赖变更时使用。'],
  ['<code>npm start</code>', '启动 Electron 引擎。'],
  ['<code>npm run dev</code>', '以 --dev 参数启动；修改源码后仍需要重启，不提供热更新。'],
  ['<code>npm --prefix packaging/android-shell install</code>', '安装 Android shell 依赖，Android 构建需要。'],
])}
<h2>从终端自动构建</h2>
<p>项目的自动打包入口读取两个环境变量。下面的 PowerShell 例子构建自带教程的 Web 版本，路径也可以换成你自己的作品绝对路径。</p>
${code(String.raw`
$env:TRICKCAL_BUILD_PROJECT = (Resolve-Path ".\projects\雨夜的末班车").Path
$env:TRICKCAL_BUILD_TARGET = "web"
try {
  & ".\node_modules\electron\dist\electron.exe" "."
} finally {
  Remove-Item Env:TRICKCAL_BUILD_PROJECT -ErrorAction SilentlyContinue
  Remove-Item Env:TRICKCAL_BUILD_TARGET -ErrorAction SilentlyContinue
}`, 'none', 'shell', 'PowerShell · 引擎根目录')}
<p>目标值为 <code>web</code>、<code>windows</code>、<code>android</code>。运行前先保存编辑器中的剧本；终端入口从磁盘读取文件。构建会更新该项目的输出，并归档旧输出；失败时进程返回非零状态。</p>
<h2>已有测试脚本</h2>
${table(['命令', '检查范围'], [
  ['<code>npm test</code>', '编译器、素材、表达式、预设、音频、舞台、导航等核心测试及语法检查。'],
  ['<code>npm run test:editor</code>', 'Electron 编辑器界面和交互。'],
  ['<code>npm run test:runtime</code>', 'Electron 播放器效果与交互。'],
  ['<code>npm run test:electron-exit</code>', '验证 Electron 测试失败时可正常退出。'],
  ['<code>npm run test:check-ipc</code>', '后台检查的 IPC 路径。'],
  ['<code>npm run test:build</code>', 'Web 构建。'],
  ['<code>npm run test:windows</code>', 'Windows 构建。'],
  ['<code>npm run test:android</code>', 'Android 构建；需要对应环境，可能耗时较长。'],
  ['<code>npm run test:native-core</code>', '实验性 Godot 原生核心；需要 Godot 环境。'],
  ['<code>npm run test:manual</code>', '网页手册：案例编译、目录/搜索/复制、响应式布局和主题。'],
])}
<p>构建类测试可能较慢并生成测试输出。仅写剧情时不用运行全部开发测试；保存、检查和目标平台实际播放更直接。</p>
<h2>代码位置</h2>
${table(['文件 / 目录', '职责'], [
  ['<code>compiler/trickcal.js</code>', '.trickcal 编译器。'],
  ['<code>runtime/</code>', '剧情播放、绘制、声音、时间线与状态。'],
  ['<code>editor/</code>', '编辑器 UI 与写回剧本。'],
  ['<code>launcher/</code>', '启动器与新建/打开项目。'],
  ['<code>main.js</code> / <code>preload.js</code>', 'Electron 窗口、项目读写、IPC 和打包。'],
  ['<code>docs/manual/</code>', '本网页手册：index.html、content.js、app.js、styles.css、assets。'],
])}`,
    },
    {
      id: 'limits', group: '排错与参考', title: '功能范围与当前限制',
      description: '用已实现的能力安排作品，并清楚区分可用功能、需要实测的效果和实验性实现。',
      keywords: '功能 列表 限制 原生 存档 不支持 Godot Unity 兼容 版本',
      body: `
<h2>现在可以做什么</h2>
${table(['方向', '已提供的制作能力'], [
  ['项目', '从模板新建、打开最近项目、保存剧本、后台检查和错误定位。'],
  ['文字', '多种对话框/气泡、旁白、新闻、拟声、全屏文字、逐字与富文本、长气泡滚动。'],
  ['舞台', 'Spine 角色、图片对象、多实例、动作/皮肤、对象属性与父子绑定。'],
  ['演出', '并行时间线、延时、等待、移动、镜头、背景渐变、效果渐变、着色器与一次性表情。'],
  ['逻辑', '选项、标签与跳转、数值/布尔/字符串变量、条件和受限表达式。'],
  ['样式', '项目预设、单句参数覆盖、效果预览与参数保存。'],
  ['输出', 'Web、Windows Electron 程序、Android Capacitor/WebView APK。'],
])}
<h2>创作时要考虑的边界</h2>
<ul>
  <li><strong>每个并行块最多一条对话。</strong>parallel 不是任意语句的通用并发容器，控制流放在外面。</li>
  <li><strong>没有跨重启存档。</strong>当前变量和路线状态不写入玩家存档文件。</li>
  <li><strong>跳段不等于完整路线恢复。</strong>未访问段落、复杂绑定和动作交错仍需从头验证。</li>
  <li><strong>时间轴主要用于查看和预览。</strong>不能直接拖动轨道编辑时间。</li>
  <li><strong>素材检查不等于播放兼容性检查。</strong>Spine 版本、骨骼内容与音频可解码性都要实际测试。</li>
  <li><strong>独立 UI 实验对象只保留旧项目兼容。</strong>新作品使用按句对话与预设流程。</li>
  <li><strong>当前输出不是平台原生渲染。</strong>Godot 原生核心位于实验目录，不能替代现有完整播放器。</li>
  <li><strong>不是通用 Python / Ren’Py。</strong>不支持任意脚本求值或整套 Ren’Py 命令。</li>
</ul>
<h2>动画与素材的说明</h2>
<p>部分 UI 使用已有提取素材和动画曲线在 Canvas 中重放，部分框体或效果为近似；它们并非直接运行原游戏 Unity 动画。动作预设“跑入”“拉伸”是引擎通用演出工具，不代表完整还原原游戏全部角色动作。</p>
<p>使用、分享或发布素材前，请确认自己具备相应使用权限。本工具为非官方同人制作工具。</p>
<h2>如何继续查资料</h2>
<p>网页手册位于 <code>docs/manual/</code>，可离线打开。源码仓库另有 <code>docs/新手使用手册.md</code>、<code>docs/DSL与运行时现状.md</code>、<code>docs/UI动画资源核对.md</code> 和 <code>docs/开发路线图.md</code>。它们适合查实现细节与计划；未来计划不等于当前已可用功能。</p>
${note('版本依据', '本文档按 2026 年 11 月 4 日工作区源码整理，面向 0.1.0 源码版。源码后续更新时，应同步维护网页内容，并重新检查示例。')}`,
    },
  ];
  window.TRICKCAL_MANUAL = pages;
})();
