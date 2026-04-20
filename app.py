from flask import Flask, render_template, request, jsonify
import heapq

app = Flask(__name__)


# 🔥 HOME PAGE
@app.route("/")
def home():
    return render_template("index.html")


# 🔥 DIJKSTRA ALGORITHM
def dijkstra(graph, start, end):
    pq = [(0, start, [])]  # (cost, node, path)
    visited = set()

    while pq:
        cost, node, path = heapq.heappop(pq)

        if node in visited:
            continue

        path = path + [node]
        visited.add(node)

        if node == end:
            return path, cost

        for neighbor, weight in graph[node].items():
            if neighbor not in visited:
                heapq.heappush(pq, (cost + weight, neighbor, path))

    return [], float('inf')


# 🔥 API FOR SIMULATION
@app.route("/run", methods=["POST"])
def run():
    data = request.get_json()

    src = data.get("source")
    dst = data.get("destination")
    algo = data.get("algo")
    failed = data.get("failed", False)

    # 🌐 GRAPH (MATCHES YOUR UI)
    graph = {
        "S1": {"S2": 1, "S3": 4, "S4": 10},
        "S2": {"S1": 1, "S3": 1},
        "S3": {"S2": 1, "S4": 1, "S1": 4},
        "S4": {"S3": 1, "S1": 10}
    }

    # 💥 FAIL LINK (S2-S3)
    if failed:
        graph["S2"].pop("S3", None)
        graph["S3"].pop("S2", None)

    # ⚡ RUN ALGORITHM
    path, cost = dijkstra(graph, src, dst)

    # 📊 METRICS
    hops = max(0, len(path) - 1)

    # simulate A* faster behavior
    if algo == "astar":
        time = cost * 1
    else:
        time = cost * 2

    return jsonify({
        "path": path,
        "time": time,
        "cost": cost,
        "hops": hops
    })


# 🔥 RUN LOCAL
if __name__ == "__main__":
    app.run(debug=True)