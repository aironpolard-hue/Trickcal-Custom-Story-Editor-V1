extends SceneTree

const Machine = preload("res://story_machine.gd")
const PlayerView = preload("res://player_view.gd")
var viewport: SubViewport
var view: Control


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var machine = Machine.new()
	var raw = FileAccess.get_file_as_string("res://story.json")
	if not machine.load_story(JSON.parse_string(raw)) or not machine.advance() or not machine.advance(0):
		printerr("无法准备原生渲染测试")
		quit(1)
		return
	viewport = SubViewport.new()
	viewport.size = Vector2i(960, 540)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	view = PlayerView.new()
	view.size = Vector2(960, 540)
	view.set_process(false)
	viewport.add_child(view)
	if not view.setup(machine, ProjectSettings.globalize_path("res://project"), "res://font.ttf"):
		printerr(view.last_error)
		quit(1)
		return
	view.elapsed = 0.0
	view.queue_redraw()
	await process_frame
	await RenderingServer.frame_post_draw
	var before := viewport.get_texture().get_image()
	view.elapsed = 10.0
	view.queue_redraw()
	await process_frame
	await RenderingServer.frame_post_draw
	var image := viewport.get_texture().get_image()
	if image == null:
		printerr("无法读取原生画面")
		quit(1)
		return
	var colored := 0
	for y in range(180, 360, 4):
		for x in range(300, 660, 4):
			var color := image.get_pixel(x, y)
			if color.r + color.g + color.b > 0.3:
				colored += 1
	if colored < 100:
		printerr("原生气泡画面为空：", colored)
		quit(1)
		return
	var changed := 0
	for y in range(180, 360):
		for x in range(300, 660):
			var a := before.get_pixel(x, y)
			var b := image.get_pixel(x, y)
			if absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b) > 0.1:
				changed += 1
	if changed < 10:
		printerr("原生打字机文字没有绘制：", changed)
		quit(1)
		return
	print("godot-render.test: ok")
	quit(0)
