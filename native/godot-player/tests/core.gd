extends SceneTree

const Machine = preload("res://story_machine.gd")
const SceneTransforms = preload("res://scene_transforms.gd")
const PlayerView = preload("res://player_view.gd")
var failures := 0


func check(condition: bool, message: String) -> void:
	if not condition:
		printerr("FAIL: " + message)
		failures += 1


func _initialize() -> void:
	var raw = FileAccess.get_file_as_string("res://story.json")
	var story = JSON.parse_string(raw)
	check(story is Dictionary, "编译后的 story.json 必须可读取")
	if not story is Dictionary:
		quit(1)
		return
	var left = Machine.new()
	check(left.load_story(story), "加载左分支剧情")
	check(left.advance(), "到达选择")
	check(left.current.get("mode") == "branch", "选择点")
	check(left.advance(0), "执行左分支")
	check(left.current.get("mode") == "ui-present", "左分支等待")
	check(left.objects.has("left_frame"), "左分支对象存在")
	check(not left.objects.has("right_frame"), "右分支对象未泄漏")
	check(left.objects.get("left_text", {}).get("parent") == "left_frame", "文字绑定气泡")
	check(left.advance(), "移除左分支对象并结束")
	check(left.ended and left.objects.is_empty(), "移除父级时移除子级")

	var right = Machine.new()
	check(right.load_story(story) and right.advance() and right.advance(1), "执行右分支")
	check(right.objects.has("right_frame"), "右分支对象存在")
	check(not right.objects.has("left_frame"), "左分支对象未泄漏")
	check(right.advance() and right.ended, "右分支结束")

	var loop = Machine.new()
	check(loop.load_story({"lines": [{"mode": "jump", "target": 0}]}), "加载循环")
	check(not loop.advance() and not loop.error.is_empty(), "无限跳转有保护")
	var graph = {
		"child": {"parent": "root", "x": 5, "y": 0},
		"root": {"x": 100, "y": 200, "rot": 90, "sx": 2, "sy": 3, "alpha": 0.5},
	}
	var transforms: Dictionary = SceneTransforms.resolve(graph)
	check(not transforms.has("error"), "解析父子变换")
	if transforms.has("values"):
		var child: Transform2D = transforms["values"]["child"]["transform"]
		check(child.origin.distance_to(Vector2(100, 210)) < 0.001, "父级缩放和旋转作用于子级")
		check(absf(transforms["values"]["child"]["alpha"] - 0.5) < 0.001, "父级透明度继承")
	check(SceneTransforms.resolve({"a": {"parent": "b"}, "b": {"parent": "a"}}).has("error"), "父子循环错误")
	var animated = Machine.new()
	check(animated.load_story({"lines": [
		{"mode": "ui-op", "operation": {"type": "create", "node": {"id": "box", "kind": "box", "x": 10}}},
		{"mode": "ui-present", "actions": [{"targetKind": "ui", "actor": "box", "property": "x", "from": 10, "to": 50, "duration": 1}]},
		{"mode": "end"},
	]}), "加载动画剧情")
	check(animated.advance() and animated.advance(), "推进动画剧情")
	check(animated.objects["box"]["x"] == 50, "完成的动画写回对象")
	var interrupted = Machine.new()
	interrupted.load_story({"lines": [
		{"mode": "ui-op", "operation": {"type": "create", "node": {"id": "box", "kind": "box", "x": 10}}},
		{"mode": "ui-present", "actions": [{"targetKind": "ui", "actor": "box", "property": "x", "from": 10, "to": 50, "duration": 1, "ease": "Linear"}]},
		{"mode": "end"},
	]})
	check(interrupted.advance() and interrupted.advance(-1, 0.5), "提前推进动画")
	check(absf(interrupted.objects["box"]["x"] - 30) < 0.001, "提前推进保留当前值")
	var delayed = Machine.new()
	delayed.load_story({"lines": [
		{"mode": "ui-op", "operation": {"type": "create", "node": {"id": "box", "kind": "box", "x": 10}}},
		{"mode": "ui-present", "actions": [{"targetKind": "ui", "actor": "box", "property": "x", "from": 100, "to": 200, "delay": 1, "duration": 1, "ease": "Linear"}]},
		{"mode": "end"},
	]})
	check(delayed.advance() and delayed.advance(-1, 0.5), "延迟前推进")
	check(delayed.objects["box"]["x"] == 10, "尚未开始的动作不改变对象")
	var invalid = Machine.new()
	invalid.load_story({"lines": [
		{"mode": "ui-op", "operation": {"type": "create", "node": {"id": "box", "kind": "box", "width": 10}}},
		{"mode": "ui-op", "operation": {"type": "set", "id": "box", "values": {"width": -1}}},
	]})
	check(not invalid.advance(), "无效对象属性被拒绝")
	check(invalid.objects["box"]["width"] == 10, "无效操作不会修改对象")
	print("godot-core.test: ", "ok" if failures == 0 else "failed")
	quit(0 if failures == 0 else 1)
