from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# 🔥 HOME PAGE
@app.route("/")
def home():
    return render_template("index.html")


# 🔥 API FOR SIMULATION
@app.route("/run", methods=["POST"])
def run():
    data = request.get_json()

    src = data.get("source")
    dst = data.get("destination")
    algo = data.get("algo")
    failed = data.get("failed", False)

    # 👇 SIMPLE DEMO LOGIC (YOU CAN UPGRADE LATER)
    if algo == "dijkstra":
        path = ["S1", "S2", "S3", "S4"]
        time = 20
        cost = 3
        hops = 3
    else:
        path = ["S1", "S3", "S4"]
        time = 10
        cost = 2
        hops = 2

    # simulate failure reroute
    if failed:
        path = ["S1", "S4"]
        time += 5
        cost += 2
        hops += 1

    return jsonify({
        "path": path,
        "time": time,
        "cost": cost,
        "hops": hops
    })


# 🔥 RUN LOCAL
if __name__ == "__main__":
    app.run(debug=True)