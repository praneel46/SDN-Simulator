from flask import Flask, jsonify, render_template, request
import heapq
import math

app = Flask(__name__)

MIN_NODES = 4
MAX_NODES = 12


@app.after_request
def add_file_mode_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/")
def home():
    return render_template("index.html")


def normalize_node_count(value):
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = 8
    return max(MIN_NODES, min(MAX_NODES, count))


def node_positions(node_count):
    positions = {}
    for index in range(node_count):
        node = f"S{index + 1}"
        angle = (2 * math.pi * index) / node_count
        positions[node] = {
            "x": round(math.cos(angle) * 310),
            "y": round(math.sin(angle) * 210),
        }
    return positions


def build_topology(node_count):
    node_count = normalize_node_count(node_count)
    graph = {f"S{i}": {} for i in range(1, node_count + 1)}
    positions = node_positions(node_count)
    edge_map = {}

    def add_edge(a, b, weight):
        if a == b:
            return
        key = tuple(sorted((a, b)))
        if key in edge_map:
            edge_map[key] = min(edge_map[key], weight)
        else:
            edge_map[key] = weight

    for index in range(1, node_count + 1):
        current = f"S{index}"
        next_node = f"S{(index % node_count) + 1}"
        skip_node = f"S{((index + 1) % node_count) + 1}"
        add_edge(current, next_node, 1 + (index % 4))
        add_edge(current, skip_node, 3 + ((index * 2) % 5))

    for index in range(1, node_count - 2):
        if index % 2 == 1:
            add_edge(f"S{index}", f"S{index + 3}", 2 + (index % 6))

    edges = []
    for edge_id, ((a, b), weight) in enumerate(sorted(edge_map.items()), start=1):
        graph[a][b] = weight
        graph[b][a] = weight
        edges.append({"id": edge_id, "from": a, "to": b, "weight": weight})

    nodes = [
        {"id": node_id, "label": node_id, **positions[node_id]}
        for node_id in graph
    ]
    return graph, {"nodes": nodes, "edges": edges}


def apply_failures(graph, failed_edges):
    failed = set()
    for edge in failed_edges or []:
        a = edge.get("from")
        b = edge.get("to")
        if a in graph and b in graph[a]:
            graph[a].pop(b, None)
            graph[b].pop(a, None)
            failed.add(tuple(sorted((a, b))))
    return failed


def dijkstra(graph, start, end):
    queue = [(0, start, [])]
    visited = set()
    explored = []

    while queue:
        cost, node, path = heapq.heappop(queue)
        if node in visited:
            continue

        visited.add(node)
        explored.append(node)
        path = path + [node]

        if node == end:
            return path, cost, explored

        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in visited:
                heapq.heappush(queue, (cost + weight, neighbor, path))

    return [], float("inf"), explored


def astar(graph, positions, start, end):
    def heuristic(node):
        a = positions[node]
        b = positions[end]
        distance = math.hypot(a["x"] - b["x"], a["y"] - b["y"])
        return distance / 150

    queue = [(heuristic(start), 0, start, [])]
    best_cost = {start: 0}
    explored = []

    while queue:
        _, cost, node, path = heapq.heappop(queue)
        if cost > best_cost.get(node, float("inf")):
            continue

        explored.append(node)
        path = path + [node]

        if node == end:
            return path, cost, explored

        for neighbor, weight in graph.get(node, {}).items():
            new_cost = cost + weight
            if new_cost < best_cost.get(neighbor, float("inf")):
                best_cost[neighbor] = new_cost
                priority = new_cost + heuristic(neighbor)
                heapq.heappush(queue, (priority, new_cost, neighbor, path))

    return [], float("inf"), explored


def path_cost(graph, path):
    return sum(graph[path[i]][path[i + 1]] for i in range(len(path) - 1))


def build_flow_rules(path):
    rules = []
    for index, node in enumerate(path):
        in_port = "host" if index == 0 else path[index - 1]
        out_port = "host" if index == len(path) - 1 else path[index + 1]
        rules.append({
            "switch": node,
            "match": f"dst={path[-1]}",
            "in": in_port,
            "out": out_port,
        })
    return rules


@app.route("/topology", methods=["POST"])
def topology():
    data = request.get_json(silent=True) or {}
    _, topology_data = build_topology(data.get("node_count", 8))
    return jsonify(topology_data)


@app.route("/run", methods=["POST"])
def run():
    data = request.get_json(silent=True) or {}
    node_count = normalize_node_count(data.get("node_count", 8))
    graph, topology_data = build_topology(node_count)
    failed = apply_failures(graph, data.get("failed_edges", []))

    src = data.get("source", "S1")
    dst = data.get("destination", f"S{node_count}")
    algo = data.get("algo", "dijkstra")

    if src not in graph or dst not in graph:
        return jsonify({"path": [], "error": "Source or destination is outside this topology."}), 400

    positions = {node["id"]: {"x": node["x"], "y": node["y"]} for node in topology_data["nodes"]}
    if algo == "astar":
        path, cost, explored = astar(graph, positions, src, dst)
    else:
        path, cost, explored = dijkstra(graph, src, dst)

    if not path:
        return jsonify({
            "path": [],
            "cost": None,
            "hops": 0,
            "time": 0,
            "explored": explored,
            "topology": topology_data,
            "sdn": {
                "controller": "No route installed because the controller could not find a valid path.",
                "flow_rules": [],
            },
        })

    cost = path_cost(graph, path)
    hops = len(path) - 1
    time_ms = round((len(explored) * 4.5) + (cost * (1.3 if algo == "astar" else 1.8)), 2)

    return jsonify({
        "path": path,
        "time": time_ms,
        "cost": cost,
        "hops": hops,
        "explored": explored,
        "algorithm": algo,
        "topology": topology_data,
        "sdn": {
            "controller": (
                f"SDN controller discovered {node_count} switches, ignored "
                f"{len(failed)} failed link(s), computed a {hops}-hop route, "
                "and installed per-switch forwarding rules."
            ),
            "flow_rules": build_flow_rules(path),
        },
    })


if __name__ == "__main__":
    app.run(debug=True)
