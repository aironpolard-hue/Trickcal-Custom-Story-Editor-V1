extends Control

const SceneTransforms = preload("res://scene_transforms.gd")

var machine
var elapsed := 0.0
var textures := {}
var font: Font
var project_dir := ""
var last_error := ""

const FRAME_FILES := {
	"manga": "Dialogue_TextBubble_Default_clean.png",
	"think": "Dialogue_TextBubble_Default_clean.png",
	"purple": "Dialogue_TextBubble_Behind_clean.png",
	"thought": "Dialogue_TextBubble_Behind_clean.png",
	"normal": "Dialogue_TextBox_Default.png",
	"cloud": "Dialogue_TextBox_Cloud.png",
	"blast": "Dialogue_TextBox_Blast.png",
	"monologue": "Dialogue_TextBox_ClearText.png",
	"monologueThought": "Dialogue_TextBox_ClearTextBehind.png",
	"narration": "Dialogue_TextBox_Narration.png",
}


func setup(story_machine, root: String, font_path: String) -> bool:
	machine = story_machine
	project_dir = root
	var loaded_font = load(font_path)
	if not loaded_font is Font:
		last_error = "字体无法加载：%s" % font_path
		return false
	font = loaded_font
	for style in FRAME_FILES:
		var asset := project_dir.path_join("assets/dialogue").path_join(FRAME_FILES[style])
		var image := Image.new()
		if image.load(asset) != OK:
			last_error = "框体贴图无法加载：%s" % asset
			return false
		textures[style] = ImageTexture.create_from_image(image)
	return true


func _process(delta: float) -> void:
	elapsed += delta
	queue_redraw()


func _animated_nodes() -> Dictionary:
	var nodes: Dictionary = machine.objects.duplicate(true)
	var groups := {}
	for action in machine.current.get("actions", []):
		if action.get("targetKind", "") != "ui" or not nodes.has(action.get("actor", "")):
			continue
		if elapsed < float(action.get("delay", 0)):
			continue
		var key: String = "%s\u0001%s" % [action["actor"], action["property"]]
		if not groups.has(key):
			groups[key] = {"id": action["actor"], "property": action["property"], "absolute": null, "relative": 0.0}
		var duration := maxf(0.0001, float(action.get("duration", 0)))
		var progress := clampf((elapsed - float(action.get("delay", 0))) / duration, 0.0, 1.0)
		progress = machine.ease_progress(progress, action.get("ease", "OutCubic"))
		var value := lerpf(float(action.get("from", 0)), float(action.get("to", 0)), progress)
		if action.get("relative", false):
			groups[key]["relative"] += value
		else:
			groups[key]["absolute"] = value
	for group in groups.values():
		var node: Dictionary = nodes[group["id"]]
		var property: String = group["property"]
		var fallback := 1.0 if property in ["sx", "sy", "alpha"] else 0.0
		var base := float(node.get(property, fallback)) if group["absolute"] == null else float(group["absolute"])
		node[property] = base + float(group["relative"])
	return nodes


func _plain_text(text: String) -> String:
	var output := text.replace("<br>", "\n")
	var regex := RegEx.new()
	regex.compile("</?(?:color|size|speed|pause|wait)(?:=[^>]*)?\\s*/?>")
	return regex.sub(output, "", true)


func _text_height(node: Dictionary) -> float:
	var text := _plain_text(str(node.get("text", "")))
	var font_size := int(node.get("fontSize", 52))
	var width := float(node.get("width", 580))
	var measured := font.get_multiline_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, width, font_size).y
	if node.get("overflow", "clip") == "grow":
		return minf(maxf(float(node.get("height", 220)), float(node.get("maxHeight", 1200))),
			maxf(float(node.get("height", 220)), measured))
	return float(node.get("height", 220))


func _frame_height(node: Dictionary) -> float:
	var minimum := float(node.get("height", 320))
	var text_id: String = node.get("fitText", "")
	if not machine.objects.has(text_id):
		return minimum
	var text_node: Dictionary = machine.objects[text_id]
	if text_node.get("kind") != "text":
		return minimum
	var text := _plain_text(str(text_node.get("text", "")))
	var measured := font.get_multiline_string_size(text, HORIZONTAL_ALIGNMENT_CENTER,
		float(text_node.get("width", 580)), int(text_node.get("fontSize", 52))).y
	return minf(maxf(minimum, float(node.get("maxHeight", 1200))),
		maxf(minimum, measured + float(node.get("paddingY", 80))))


func _draw_nine_slice(texture: Texture2D, rect: Rect2, border: float, color: Color) -> void:
	var source_size := texture.get_size()
	var source_border := Vector2(minf(border, source_size.x / 2), minf(border, source_size.y / 2))
	var target_border := Vector2(minf(source_border.x, rect.size.x / 2), minf(source_border.y, rect.size.y / 2))
	var sx := [0.0, source_border.x, source_size.x - source_border.x]
	var sy := [0.0, source_border.y, source_size.y - source_border.y]
	var sw := [source_border.x, source_size.x - 2 * source_border.x, source_border.x]
	var sh := [source_border.y, source_size.y - 2 * source_border.y, source_border.y]
	var dx := [rect.position.x, rect.position.x + target_border.x, rect.end.x - target_border.x]
	var dy := [rect.position.y, rect.position.y + target_border.y, rect.end.y - target_border.y]
	var dw := [target_border.x, rect.size.x - 2 * target_border.x, target_border.x]
	var dh := [target_border.y, rect.size.y - 2 * target_border.y, target_border.y]
	for x in range(3):
		for y in range(3):
			if sw[x] > 0 and sh[y] > 0 and dw[x] > 0 and dh[y] > 0:
				draw_texture_rect_region(texture, Rect2(dx[x], dy[y], dw[x], dh[y]), Rect2(sx[x], sy[y], sw[x], sh[y]), color)


func _draw() -> void:
	if machine == null or font == null:
		return
	var scale := minf(size.x / 1920.0, size.y / 1080.0)
	var offset := (size - Vector2(1920, 1080) * scale) / 2.0
	draw_rect(Rect2(Vector2.ZERO, size), Color.BLACK)
	var animated := _animated_nodes()
	var cam: Dictionary = machine.current.get("camera", {})
	var zoom := maxf(1.0, float(cam.get("zoom", 1.0)))
	var camera_x := float(cam.get("x", 0))
	var camera_y := float(cam.get("y", 0))
	for item in machine.current.get("stage", []):
		if not item is Dictionary or animated.has(item.get("id", "")):
			continue
		var actor: Dictionary = item.duplicate(true)
		var actor_x := float(actor.get("x", 0))
		var actor_y := float(actor.get("y", 0))
		if cam.get("follow") == actor.get("id"):
			camera_x = zoom * (960.0 - actor_x) + float(cam.get("offsetX", 0))
			camera_y = zoom * (540.0 - actor_y) + float(cam.get("offsetY", 0))
			break
	for item in machine.current.get("stage", []):
		if not item is Dictionary or animated.has(item.get("id", "")):
			continue
		var actor: Dictionary = item.duplicate(true)
		var position := Vector2(float(actor.get("x", 0)) - 960.0, float(actor.get("y", 0)) - 540.0)
		position = position.rotated(deg_to_rad(float(cam.get("rot", 0)))) * zoom + Vector2(960 + camera_x, 540 + camera_y)
		actor["x"] = position.x
		actor["y"] = position.y
		actor["sx"] = zoom * float(actor.get("sx", 1)) * (-1.0 if float(actor.get("face", 1)) < 0 else 1.0)
		actor["sy"] = zoom * float(actor.get("sy", 1))
		actor["rot"] = float(actor.get("rot", 0)) + float(cam.get("rot", 0))
		actor["visible"] = not actor.get("hidden", false)
		actor.erase("parent")
		animated[actor["id"]] = actor
	for node in machine.objects.values():
		var parent = node.get("parent")
		if parent != null and not animated.has(parent):
			animated[parent] = {"visible": false}
	var result: Dictionary = SceneTransforms.resolve(animated)
	if result.has("error"):
		last_error = result["error"]
		return
	var world: Dictionary = result["values"]
	var nodes: Array = []
	for id in machine.objects:
		nodes.append({"order": nodes.size(), "node": animated[id]})
	nodes.sort_custom(func(a, b):
		var az := float(a["node"].get("z", 0))
		var bz := float(b["node"].get("z", 0))
		return a["order"] < b["order"] if is_equal_approx(az, bz) else az < bz)
	for entry in nodes:
		var node: Dictionary = entry["node"]
		var item: Dictionary = world[node["id"]]
		if not item["visible"]:
			continue
		var transform: Transform2D = item["transform"]
		var stage := Transform2D(0, Vector2(scale, scale), 0, offset)
		draw_set_transform_matrix(stage * transform)
		var width := float(node.get("width", 1))
		var color := Color(1, 1, 1, float(item["alpha"]))
		if node.get("kind") in ["bubble", "box"]:
			var height := _frame_height(node)
			var rect := Rect2(-width / 2, -height / 2, width, height)
			var style: String = node.get("style", "")
			if style == "sfx":
				draw_rect(Rect2(rect.position + Vector2(10, 10), rect.size), Color(0.1, 0.1, 0.1, color.a))
				draw_rect(rect, color)
			elif textures.has(style):
				_draw_nine_slice(textures[style], rect, 94 if node.get("kind") == "bubble" else 64, color)
		elif node.get("kind") == "text":
			var text := _plain_text(str(node.get("text", "")))
			var height := _text_height(node)
			var font_size := int(node.get("fontSize", 52))
			var text_color := Color.from_string(str(node.get("color", "#333333")), Color.WHITE)
			text_color.a *= color.a
			var paragraph := TextParagraph.new()
			paragraph.width = width
			paragraph.add_string(text, font, font_size)
			var shown := mini(text.length(), int(elapsed * 33.333 * float(node.get("speed", 1))))
			var line_height := font.get_height(font_size)
			var y := -minf(height, line_height * paragraph.get_line_count()) / 2 + font.get_ascent(font_size)
			for line_index in range(paragraph.get_line_count()):
				if y + font.get_descent(font_size) > height / 2 or shown <= 0:
					break
				var line_range := paragraph.get_line_range(line_index)
				var text_line := text.substr(line_range.x, line_range.y - line_range.x)
				var segment := text_line.left(maxi(0, shown - line_range.x))
				var x := -paragraph.get_line_width(line_index) / 2
				draw_string(font, Vector2(x, y), segment, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, text_color)
				y += line_height
	draw_set_transform_matrix(Transform2D.IDENTITY)
