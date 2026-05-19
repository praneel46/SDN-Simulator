let finalWinnerText = "";

document.addEventListener("DOMContentLoaded", function () {
  const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:5000" : "";
  let currentAlgo = "dijkstra";
  let network;
  let nodes;
  let edges;
  let hasRun = false;
  let chart;
  let failedEdges = [];
  let isAnimating = false;
  let activeTopology = { nodes: [], edges: [] };
  let lastPath = [];

  const sourceSelect = document.getElementById("source");
  const destinationSelect = document.getElementById("destination");
  const nodeCountInput = document.getElementById("nodeCount");
  const speedInput = document.getElementById("speed");
  const speedValue = document.getElementById("speedValue");

  function startParticles(canvasId, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let particles = [];
    const driftOnly = options.driftOnly || false;

    function initParticles() {
      particles = [];
      for (let i = 0; i < 80; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1.5,
          speedX: (Math.random() - 0.5) * (driftOnly ? 0.9 : 0.6),
          speedY: driftOnly ? (Math.random() - 0.5) * 0.25 : (Math.random() - 0.5) * 0.6
        });
      }
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,255,255,0.9)";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00ffff";
        ctx.fill();

        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      requestAnimationFrame(animate);
    }

    animate();
  }

  startParticles("particles");

  speedInput.addEventListener("input", () => {
    speedValue.innerText = `${speedInput.value}%`;
  });

  function getNodeCount() {
    const count = Number.parseInt(nodeCountInput.value, 10);
    if (Number.isNaN(count)) return 8;
    return Math.max(4, Math.min(12, count));
  }

  function updateStatus(msg) {
    document.getElementById("status").innerText = msg;
  }

  function updateNodeOptions(selectedSource, selectedDestination) {
    sourceSelect.innerHTML = "";
    destinationSelect.innerHTML = "";

    activeTopology.nodes.forEach(node => {
      sourceSelect.add(new Option(node.id, node.id));
      destinationSelect.add(new Option(node.id, node.id));
    });

    sourceSelect.value = selectedSource || "S1";
    destinationSelect.value = selectedDestination || activeTopology.nodes[activeTopology.nodes.length - 1].id;

    if (sourceSelect.value === destinationSelect.value && activeTopology.nodes.length > 1) {
      destinationSelect.value = activeTopology.nodes[activeTopology.nodes.length - 1].id;
    }
  }

  async function loadTopology(selectedSource, selectedDestination) {
    const nodeCount = getNodeCount();
    nodeCountInput.value = nodeCount;

    let response;
    try {
      response = await fetch(`${API_BASE}/topology`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_count: nodeCount })
      });
    } catch (error) {
      updateStatus("Start the Flask server, then open http://127.0.0.1:5000/ for full simulation.");
      return;
    }

    activeTopology = await response.json();
    failedEdges = [];
    lastPath = [];
    renderGraph();
    updateNodeOptions(selectedSource, selectedDestination);
    renderSdnPanel({
      controller: `Controller discovered ${activeTopology.nodes.length} switches and ${activeTopology.edges.length} links.`,
      flow_rules: []
    });
    updateStatus(`Generated ${activeTopology.nodes.length}-switch topology. Pick source and destination, then start.`);
  }

  function renderGraph() {
    nodes = new vis.DataSet(activeTopology.nodes.map(node => ({
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
      fixed: true
    })));

    edges = new vis.DataSet(activeTopology.edges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: String(edge.weight),
      width: 2,
      color: { color: "#8aa1b8" }
    })));

    network = new vis.Network(
      document.getElementById("network"),
      { nodes, edges },
      {
        physics: false,
        interaction: {
          zoomView: false,
          dragView: false,
          dragNodes: false,
          hover: true
        },
        nodes: {
          shape: "dot",
          size: 22,
          font: { color: "#111827", size: 16 },
          color: { background: "#67e8f9", border: "#0f172a" }
        },
        edges: {
          font: { align: "top", color: "#0f172a", strokeWidth: 0 },
          smooth: { type: "continuous" }
        }
      }
    );

    network.once("afterDrawing", () => {
      network.fit({ animation: false });
      network.redraw();
    });
  }

  window.enterApp = async function () {
    document.getElementById("intro").style.display = "none";
    document.getElementById("app").style.display = "block";
    await loadTopology();
  };

  window.generateCustomTopology = async function () {
    if (isAnimating) return;
    hasRun = false;
    await loadTopology();
  };

  window.toggleAlgorithm = function () {
    const label = document.getElementById("algoLabel");
    if (currentAlgo === "dijkstra") {
      currentAlgo = "astar";
      document.body.className = "astar-mode";
      label.innerText = "Algorithm: A*";
      document.getElementById("switchAlgo").innerText = "Switch to Dijkstra";
    } else {
      currentAlgo = "dijkstra";
      document.body.className = "dijkstra-mode";
      label.innerText = "Algorithm: Dijkstra";
      document.getElementById("switchAlgo").innerText = "Switch to A*";
    }
  };

  function colorPath(path, color, glowColor) {
    edges.forEach(e => {
      edges.update({
        id: e.id,
        color: { color: "#8aa1b8" },
        width: 2,
        dashes: false,
        shadow: false
      });
    });

    for (let i = 0; i < path.length - 1; i++) {
      const edge = edges.get().find(e =>
        (e.from === path[i] && e.to === path[i + 1]) ||
        (e.to === path[i] && e.from === path[i + 1])
      );
      if (edge) edges.update({
        id: edge.id,
        color: { color },
        width: 7,
        dashes: false,
        shadow: { enabled: true, color: glowColor, size: 18, x: 0, y: 0 }
      });
    }
  }

  async function pulseAstarSearch(explored, path) {
    const pathSet = new Set(path);
    for (const node of explored || []) {
      if (!nodes.get(node)) continue;
      nodes.update({
        id: node,
        color: {
          background: pathSet.has(node) ? "#f97316" : "#fed7aa",
          border: "#ffedd5",
          highlight: { background: "#fb923c", border: "#ffffff" }
        },
        shadow: { enabled: true, color: "rgba(251, 146, 60, 0.85)", size: 18, x: 0, y: 0 }
      });
      await sleep(70);
    }

    activeTopology.nodes.forEach(node => {
      nodes.update({
        id: node.id,
        color: { background: "#67e8f9", border: "#0f172a" },
        shadow: false
      });
    });
  }

  function sameEdge(edge, target) {
    return (
      (edge.from === target.from && edge.to === target.to) ||
      (edge.to === target.from && edge.from === target.to)
    );
  }

  async function requestRoute(algo) {
    let response;
    try {
      response = await fetch(`${API_BASE}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sourceSelect.value,
          destination: destinationSelect.value,
          algo,
          node_count: getNodeCount(),
          failed_edges: failedEdges
        })
      });
    } catch (error) {
      updateStatus("Backend is not reachable. Run Flask and open http://127.0.0.1:5000/.");
      return { path: [], sdn: { controller: "Backend is not reachable.", flow_rules: [] } };
    }
    return response.json();
  }

  window.startSimulation = async function (options = {}) {
    if (isAnimating) return;
    if (sourceSelect.value === destinationSelect.value) {
      updateStatus("Source and destination must be different switches.");
      return;
    }

    isAnimating = true;
    hasRun = true;
    updateStatus("Controller is calculating the route...");

    const data = await requestRoute(currentAlgo);
    const path = data.path || [];
    lastPath = path;
    const isReroute = options.reroute === true;

    if (!path.length) {
      updateStatus("No path found after current link failures.");
      renderSdnPanel(data.sdn || { controller: "No route installed.", flow_rules: [] });
      isAnimating = false;
      return;
    }

    updateStatus(`${isReroute ? "Rerouted path" : "Shortest path"}: ${path.join(" -> ")} | Cost: ${data.cost} | Hops: ${data.hops}`);
    if (currentAlgo === "astar") {
      updateStatus(`A* is scanning promising switches first: ${(data.explored || []).join(" -> ")}`);
      await pulseAstarSearch(data.explored, path);
    }
    colorPath(
      path,
      isReroute ? "#ef4444" : "#22c55e",
      isReroute ? "rgba(239, 68, 68, 0.9)" : "rgba(34, 197, 94, 0.85)"
    );
    updateStatus(`${isReroute ? "Rerouted path" : "Shortest path"}: ${path.join(" -> ")} | Cost: ${data.cost} | Hops: ${data.hops}`);
    renderSdnPanel(data.sdn);
    await animatePacket(path, { fast: currentAlgo === "astar", reroute: isReroute });
    isAnimating = false;
  };

  async function animatePacket(path, options = {}) {
    const id = "packet";
    try { nodes.remove(id); } catch {}

    const packetColor = options.fast ? "#fb923c" : "#22c55e";
    nodes.add({
      id,
      shape: "dot",
      size: options.fast ? 15 : 12,
      color: {
        background: packetColor,
        border: "#ecfdf5",
        highlight: { background: packetColor, border: "#ffffff" }
      },
      shadow: {
        enabled: true,
        color: options.fast ? "rgba(251, 146, 60, 0.95)" : "rgba(34, 197, 94, 0.9)",
        size: options.fast ? 28 : 18,
        x: 0,
        y: 0
      }
    });

    for (let i = 0; i < path.length - 1; i++) {
      const pos = network.getPositions([path[i], path[i + 1]]);
      const a = pos[path[i]];
      const b = pos[path[i + 1]];
      const steps = 100;

      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        nodes.update({ id, x, y, fixed: { x: true, y: true } });
        await sleep(packetDelay(options.fast));
      }
    }

    nodes.remove(id);
  }

  function packetDelay(fast = false) {
    const speed = Number.parseInt(speedInput.value, 10);
    const delay = Math.round(62 - (Math.max(1, Math.min(100, speed)) * 0.58));
    return fast ? Math.max(2, Math.round(delay * 0.45)) : delay;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(4, ms)));
  }

  window.failLink = async function () {
    if (isAnimating) return;

    const route = lastPath.length >= 2 ? lastPath : (await requestRoute(currentAlgo)).path;
    if (!route || route.length < 2) {
      updateStatus("No active path is available to fail.");
      return;
    }

    const middle = Math.floor((route.length - 1) / 2);
    const failedEdge = { from: route[middle], to: route[middle + 1] };
    if (!failedEdges.some(edge => sameEdge(edge, failedEdge))) {
      failedEdges.push(failedEdge);
    }

    const edge = edges.get().find(e => sameEdge(e, failedEdge));
    if (edge) {
      edges.remove(edge.id);
    }

    updateStatus(`Failed link ${failedEdge.from}-${failedEdge.to}. Removed from topology. Controller is recalculating...`);
    await window.startSimulation({ reroute: true });
  };

  window.compareAlgorithms = async function () {
    if (!hasRun) {
      alert("Run simulation first!");
      return;
    }

    app.style.display = "none";
    comparisonPage.style.display = "block";
    startParticles("particles2", { driftOnly: true });

    document.getElementById("winner").style.display = "none";
    document.getElementById("explainBox").style.display = "none";

    const d = await requestRoute("dijkstra");
    const a = await requestRoute("astar");
    document.getElementById("compareContext").innerText =
      `Live comparison for ${sourceSelect.value} to ${destinationSelect.value} on ${getNodeCount()} switches` +
      (failedEdges.length ? ` after ${failedEdges.length} failed link(s)` : "");

    if (chart) chart.destroy();

    chart = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: ["Controller Time", "Path Cost", "Hop Count", "Explored Switches"],
        datasets: [
          {
            label: "Dijkstra",
            data: [d.time, d.cost, d.hops, d.explored.length],
            borderColor: "#22d3ee",
            backgroundColor: "rgba(34,211,238,0.2)",
            pointBackgroundColor: "#22d3ee",
            pointRadius: 6,
            tension: 0.35,
            fill: true
          },
          {
            label: "A*",
            data: [a.time, a.cost, a.hops, a.explored.length],
            borderColor: "#fb923c",
            backgroundColor: "rgba(251,146,60,0.2)",
            pointBackgroundColor: "#fb923c",
            pointRadius: 6,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1300,
          easing: "easeOutQuart"
        },
        scales: {
          x: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" } },
          y: { ticks: { color: "#fff" }, grid: { color: "rgba(255,255,255,0.08)" }, beginAtZero: true }
        },
        plugins: {
          legend: { labels: { color: "#fff" } }
        }
      }
    });

    dijkstraBox.innerHTML = `Dijkstra<br>Time: ${d.time} ms<br>Cost: ${d.cost}<br>Hops: ${d.hops}<br>Explored: ${d.explored.length}`;
    astarBox.innerHTML = `A*<br>Time: ${a.time} ms<br>Cost: ${a.cost}<br>Hops: ${a.hops}<br>Explored: ${a.explored.length}`;

    finalWinnerText =
      a.time < d.time ? "A* is faster" :
      a.time > d.time ? "Dijkstra is faster" :
      "Equal performance";
  };

  function renderSdnPanel(sdn) {
    document.getElementById("controllerStatus").innerText = sdn.controller;
    const rows = (sdn.flow_rules || []).map(rule => `
      <tr>
        <td>${rule.switch}</td>
        <td>${rule.match}</td>
        <td>${rule.in}</td>
        <td>${rule.out}</td>
      </tr>
    `).join("");

    document.getElementById("flowTable").innerHTML = rows
      ? `<table>
          <thead><tr><th>Switch</th><th>Match</th><th>In Port</th><th>Out Port</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : "<p>No flow rules installed yet.</p>";
  }

  window.backToMain = function () {
    comparisonPage.style.display = "none";
    app.style.display = "block";
  };

  window.resetNetwork = function () {
    location.reload();
  };
});

function startAnalysis() {
  const box = document.getElementById("analysisBox");
  const winner = document.getElementById("winner");
  const explain = document.getElementById("explainBox");

  winner.style.display = "none";
  explain.style.display = "none";
  explain.classList.remove("analysis-glow");

  box.style.display = "block";
  box.innerHTML = "Analyzing route efficiency...";

  setTimeout(() => {
    box.innerHTML = "Comparing controller metrics...";
  }, 1200);

  setTimeout(() => {
    box.innerHTML = "Finalizing...";
  }, 2500);

  setTimeout(() => {
    box.style.display = "none";
    winner.style.display = "block";
    winner.innerText = finalWinnerText || "Run comparison first";
    winner.style.textShadow = "0 0 20px #00ffcc, 0 0 40px #00ffcc";
  }, 4000);

  setTimeout(() => {
    explain.style.display = "block";
    explain.classList.add("analysis-glow");
  }, 5200);
}
