extends RefCounted

var lines: Array = []
var pc: int = 0
var objects: Dictionary = {}
var current: Dictionary = {}
var error: String = ""
var ended: bool = false


func load_story(story: Dictionary) -> bool:
	if not story.get("lines") is Array:
		error = "剧情数据缺少 lines 数组。"
		return false
	lines = story["lines"]
	pc = 0
	objects = {}
	current = {}
	error = ""
	ended = false
	return true


func advance(choice_index: int = -1, elapsed: float = -1.0) -> bool:
	if ended or not error.is_empty():
		return false
	if current.get("mode", "") == "ui-present":
		_commit_ui_actions(current.get("actions", []), elapsed)
	if current.get("mode", "") == "branch":
		var options: Array = current.get("options", [])
		if choice_index < 0 or choice_index >= options.size():
			error = "分支需要有效的选项。"
			return false
		pc = int(options[choice_index].get("next", -1))
	elif choice_index != -1:
		error = "当前剧情没有等待分支选择。"
		return false
	current = {}
	for _step in range(10000):
		if pc == lines.size():
			ended = true
			return true
		if pc < 0 or pc >= lines.size() or not lines[pc] is Dictionary:
			error = "剧情跳转目标无效：%s" % pc
			return false
		var line: Dictionary = lines[pc]
		var mode: String = line.get("mode", "")
		if mode == "jump":
			pc = int(line.get("target", -1))
		elif mode == "ui-op":
			if not _apply_ui_operation(line.get("operation", {}), line.get("stage", [])):
				error = "第 %s 行：%s" % [line.get("sourceLine", 1), error]
				return false
			pc += 1
		elif mode == "end":
			current = line
			ended = true
			return true
		else:
			current = line
			pc += 1
			return true
	error = "连续剧情语句过多，可能存在无限跳转。"
	return false


func _commit_ui_actions(actions: Array, elapsed: float) -> void:
	var groups := {}
	for action in actions:
		if action.get("targetKind", "") != "ui" or not objects.has(action.get("actor", "")):
			continue
		if elapsed >= 0 and elapsed < float(action.get("delay", 0)):
			continue
		var key: String = "%s\u0001%s" % [action["actor"], action["property"]]
		if not groups.has(key):
			groups[key] = {"id": action["actor"], "property": action["property"], "absolute": null, "relative": 0.0}
		var progress := 1.0 if elapsed < 0 else clampf((elapsed - float(action.get("delay", 0))) / maxf(0.0001, float(action.get("duration", 0))), 0.0, 1.0)
		var value := lerpf(float(action.get("from", 0)), float(action.get("to", 0)), ease_progress(progress, action.get("ease", "OutCubic")))
		if action.get("relative", false):
			groups[key]["relative"] += value
		else:
			groups[key]["absolute"] = value
	for group in groups.values():
		var node: Dictionary = objects[group["id"]].duplicate(true)
		var property: String = group["property"]
		var fallback := 1.0 if property in ["sx", "sy", "alpha"] else 0.0
		var base := float(node.get(property, fallback)) if group["absolute"] == null else float(group["absolute"])
		node[property] = base + float(group["relative"])
		objects[group["id"]] = node


static func ease_progress(progress: float, easing: String) -> float:
	var p := clampf(progress, 0.0, 1.0)
	match easing:
		"Linear": return p
		"InSine": return 1.0 - cos(p * PI / 2.0)
		"OutSine": return sin(p * PI / 2.0)
		"InOutSine": return -(cos(PI * p) - 1.0) / 2.0
		"InCubic": return p * p * p
		"OutCubic": return 1.0 - pow(1.0 - p, 3.0)
		"OutQuint": return 1.0 - pow(1.0 - p, 5.0)
		"OutBack": return 1.0 + 2.70158 * pow(p - 1.0, 3.0) + 1.70158 * pow(p - 1.0, 2.0)
	return p * p * (3.0 - 2.0 * p)


func _stage_contains(stage: Array, id: String) -> bool:
	for item in stage:
		if item is Dictionary and item.get("id") == id:
			return true
	return false


func _apply_ui_operation(operation: Dictionary, stage: Array) -> bool:
	var kind: String = operation.get("type", "")
	var id: String = operation.get("id", "")
	if kind == "create":
		var node: Dictionary = operation.get("node", {}).duplicate(true)
		id = node.get("id", "")
		if not _validate_node(node):
			return false
		if objects.has(id) or _stage_contains(stage, id):
			error = "对象名称重复：%s" % id
			return false
		var parent = node.get("parent")
		if parent == id:
			error = "绑定会形成循环。"
			return false
		if parent != null and not objects.has(parent) and not _stage_contains(stage, parent):
			error = "父级不存在：%s" % parent
			return false
		objects[id] = node
		return true
	if not objects.has(id):
		error = "UI 对象不存在：%s" % id
		return false
	if kind == "set":
		var values: Dictionary = operation.get("values", {})
		if values.has("id") or values.has("kind") or values.has("parent"):
			error = "不能直接修改对象身份或父级。"
			return false
		if values.has("text") and objects[id].get("kind") != "text":
			error = "打字机不存在：%s" % id
			return false
		var updated: Dictionary = objects[id].duplicate(true)
		updated.merge(values, true)
		if not _validate_node(updated):
			return false
		objects[id] = updated
		return true
	if kind == "bind":
		var parent = operation.get("parent")
		if parent != null:
			if not objects.has(parent) and not _stage_contains(stage, parent):
				error = "父级不存在：%s" % parent
				return false
			var visited := {}
			var ancestor = parent
			while ancestor != null:
				if ancestor == id or visited.has(ancestor):
					error = "绑定会形成循环。"
					return false
				visited[ancestor] = true
				ancestor = objects[ancestor].get("parent") if objects.has(ancestor) else null
		var updated: Dictionary = objects[id].duplicate(true)
		updated["parent"] = parent
		if operation.has("x"):
			updated["x"] = operation["x"]
		if operation.has("y"):
			updated["y"] = operation["y"]
		if not _validate_node(updated):
			return false
		objects[id] = updated
		return true
	if kind == "remove":
		var removed := {id: true}
		var changed := true
		while changed:
			changed = false
			for object_id in objects:
				var parent = objects[object_id].get("parent")
				if not removed.has(object_id) and parent != null and removed.has(parent):
					removed[object_id] = true
					changed = true
		for object_id in removed:
			objects.erase(object_id)
		return true
	error = "未知 UI 操作：%s" % kind
	return false


func _validate_node(node: Dictionary) -> bool:
	var id = node.get("id", "")
	var kind = node.get("kind", "")
	if not id is String or not kind is String or id.is_empty() or kind.is_empty():
		error = "UI 对象缺少名称或类型。"
		return false
	for field in ["x", "y", "sx", "sy", "rot", "alpha", "width", "height", "fontSize", "speed", "maxHeight"]:
		if node.has(field):
			var value = node[field]
			if not (value is int or value is float) or not is_finite(float(value)):
				error = "对象 %s 的 %s 不是有效数字。" % [id, field]
				return false
			if field in ["width", "height", "fontSize", "speed", "maxHeight"] and value <= 0:
				error = "对象 %s 的 %s 必须大于零。" % [id, field]
				return false
			if field == "alpha" and (value < 0 or value > 1):
				error = "对象透明度必须在 0 到 1 之间。"
				return false
	if node.has("visible") and not node["visible"] is bool:
		error = "对象显示状态必须是布尔值。"
		return false
	return true
