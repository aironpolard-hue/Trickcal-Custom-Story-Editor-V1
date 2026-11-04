extends RefCounted


static func resolve(nodes: Dictionary) -> Dictionary:
	var resolved := {}
	var visiting := {}
	for id in nodes:
		var result := _visit(id, nodes, resolved, visiting)
		if result.has("error"):
			return result
	return {"values": resolved}


static func _visit(id: String, nodes: Dictionary, resolved: Dictionary, visiting: Dictionary) -> Dictionary:
	if resolved.has(id):
		return resolved[id]
	if visiting.has(id):
		return {"error": "场景层级循环：%s" % id}
	if not nodes.has(id):
		return {"error": "场景对象不存在：%s" % id}
	visiting[id] = true
	var node: Dictionary = nodes[id]
	var rotation := deg_to_rad(float(node.get("rot", 0.0)))
	var local := Transform2D(rotation, Vector2(float(node.get("sx", 1.0)), float(node.get("sy", 1.0))), 0.0,
		Vector2(float(node.get("x", 0.0)), float(node.get("y", 0.0))))
	var alpha := float(node.get("alpha", 1.0))
	var visible := bool(node.get("visible", true))
	var parent = node.get("parent")
	if parent != null and not str(parent).is_empty():
		var parent_result := _visit(str(parent), nodes, resolved, visiting)
		if parent_result.has("error"):
			return parent_result
		local = parent_result["transform"] * local
		alpha *= parent_result["alpha"]
		visible = visible and parent_result["visible"]
	visiting.erase(id)
	var result := {"transform": local, "alpha": alpha, "visible": visible}
	resolved[id] = result
	return result
