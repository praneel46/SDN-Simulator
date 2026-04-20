from flask import Flask, render_template, request, jsonify
import networkx as nx
import time

app = Flask(__name__)

# ---------- CREATE GRAPH ----------
def create_graph():
    G = nx.Graph()

    G.add_weighted_edges_from([
        ("S1","S2",1),
        ("S2","S3",1),
        ("S3","S4",1),
        ("S1","S3",4),
        ("S1","S4",10)
    ])

    return G


# ---------- HEURISTIC (FOR A*) ----------
def heuristic(a, b):
    # Simple heuristic (can be improved later)
    # For demo: return 1 (uniform)
    return 1


# ---------- HOME ----------
@app.route('/')
def index():
    return render_template('index.html')


# ---------- RUN SIMULATION ----------
@app.route('/run', methods=['POST'])
def run():

    data = request.json

    source = data.get("source")
    destination = data.get("destination")
    failed = data.get("failed", False)
    algo = data.get("algo", "dijkstra")

    G = create_graph()

    # 💥 FAIL LINK
    if failed:
        if G.has_edge("S2", "S3"):
            G.remove_edge("S2", "S3")

    try:
        start = time.time()

        # 🔥 ALGORITHM SWITCH
        if algo == "astar":
            path = nx.astar_path(G, source, destination, heuristic=heuristic)
        else:
            path = nx.shortest_path(G, source, destination, weight='weight')

        end = time.time()

        # 📊 COST CALCULATION
        cost = 0
        for i in range(len(path)-1):
            cost += G[path[i]][path[i+1]]['weight']

        # 📊 RESPONSE (FOR COMPARISON ALSO)
        return jsonify({
            "path": path,
            "time": round((end-start)*1000, 4),   # ms
            "cost": cost,
            "hops": len(path)-1,
            "algorithm": algo
        })

    except Exception as e:
        return jsonify({
            "path": [],
            "error": str(e)
        })


# ---------- START ----------
if __name__ == "__main__":
    app.run(debug=True)