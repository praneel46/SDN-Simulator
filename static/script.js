document.addEventListener("DOMContentLoaded", function () {

  let currentAlgo = "dijkstra";
  let network;
  let nodes, edges;
  let hasRun = false;
  let chart;
  let failed = false;
  let isAnimating = false;

  let finalWinnerText = ""; // 🔥 store winner

  // ---------- PARTICLES ----------
  function startParticles(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    }

    window.addEventListener("resize", resizeCanvas);

    let particles = [];

    function initParticles() {
      particles = [];
      for (let i = 0; i < 80; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1.5,
          speedX: (Math.random() - 0.5) * 0.6,
          speedY: (Math.random() - 0.5) * 0.6
        });
      }
    }

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

  // ---------- GRAPH ----------
  function initGraph() {

    nodes = new vis.DataSet([
      { id: "S1", label: "S1" },
      { id: "S2", label: "S2" },
      { id: "S3", label: "S3" },
      { id: "S4", label: "S4" }
    ]);

    edges = new vis.DataSet([
      { id: 1, from: "S1", to: "S2", label: "1" },
      { id: 2, from: "S2", to: "S3", label: "1" },
      { id: 3, from: "S3", to: "S4", label: "1" },
      { id: 4, from: "S1", to: "S3", label: "4" },
      { id: 5, from: "S1", to: "S4", label: "10" }
    ]);

    network = new vis.Network(
      document.getElementById("network"),
      { nodes, edges },
      {
        physics: false,
        interaction: {
          zoomView: false,
          dragView: false
        }
      }
    );
  }

  window.enterApp = function () {
    document.getElementById("intro").style.display = "none";
    document.getElementById("app").style.display = "block";
    initGraph();
  };

  window.toggleAlgorithm = function () {
    const label = document.getElementById("algoLabel");

    if (currentAlgo === "dijkstra") {
      currentAlgo = "astar";
      document.body.className = "astar-mode";
      label.innerText = "Algorithm: A*";
    } else {
      currentAlgo = "dijkstra";
      document.body.className = "dijkstra-mode";
      label.innerText = "Algorithm: Dijkstra";
    }

    failed = false;
    initGraph();
  };

  function updateStatus(msg) {
    document.getElementById("status").innerText = msg;
  }

  function colorPath(path, color) {

    edges.forEach(e => {
      edges.update({ id: e.id, color: { color: "#848484" }, width: 1 });
    });

    for (let i = 0; i < path.length - 1; i++) {
      let edge = edges.get().find(e =>
        (e.from === path[i] && e.to === path[i + 1]) ||
        (e.to === path[i] && e.from === path[i + 1])
      );

      if (edge) {
        edges.update({
          id: edge.id,
          color: { color: color },
          width: 5
        });
      }
    }
  }

  window.startSimulation = async function () {

    if (isAnimating) return;
    isAnimating = true;

    hasRun = true;

    let src = source.value;
    let dst = destination.value;

    updateStatus("🧠 Calculating path...");

    let res = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: src,
        destination: dst,
        algo: currentAlgo,
        failed: failed
      })
    });

    let data = await res.json();
    let path = data.path;

    if (!path.length) {
      updateStatus("❌ No path found");
      isAnimating = false;
      return;
    }

    updateStatus("Path: " + path.join(" → "));
    colorPath(path, currentAlgo === "astar" ? "orange" : "cyan");

    await animatePacket(path);

    isAnimating = false;
  };

  async function animatePacket(path) {

    let speed = document.getElementById("speed").value;
    let delay = Math.max(8, 140 - speed);

    let id = "packet";
    try { nodes.remove(id); } catch {}

    nodes.add({
      id,
      shape: "dot",
      size: 8,
      color: "lime"
    });

    for (let i = 0; i < path.length - 1; i++) {

      let pos = network.getPositions([path[i], path[i + 1]]);
      let a = pos[path[i]];
      let b = pos[path[i + 1]];

      for (let t = 0; t <= 1; t += 0.015) {

        let x = a.x + (b.x - a.x) * t;
        let y = a.y + (b.y - a.y) * t;

        network.moveNode(id, x, y);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    nodes.remove(id);
  }

  window.failLink = async function () {

    if (isAnimating) return;

    updateStatus("💥 Link S2-S3 failed");

    failed = true;

    edges.remove(
      edges.get({
        filter: e =>
          (e.from === "S2" && e.to === "S3") ||
          (e.from === "S3" && e.to === "S2")
      })
    );

    await startSimulation();
  };

  window.compareAlgorithms = async function () {

    if (!hasRun) {
      alert("Run simulation first!");
      return;
    }

    app.style.display = "none";
    comparisonPage.style.display = "block";

    startParticles("particles2");

    document.getElementById("winner").style.display = "none";
    document.getElementById("explainBox").style.display = "none";

    let src = source.value;
    let dst = destination.value;

    let d = await fetch('/run', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ source: src, destination: dst, algo: "dijkstra" })
    }).then(r => r.json());

    let a = await fetch('/run', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ source: src, destination: dst, algo: "astar" })
    }).then(r => r.json());

    if (chart) chart.destroy();

    chart = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: ['Time','Cost','Hops'],
        datasets: [
          { label: 'Dijkstra', data: [d.time,d.cost,d.hops], backgroundColor:'rgba(0,150,255,0.7)' },
          { label: 'A*', data: [a.time,a.cost,a.hops], backgroundColor:'rgba(255,140,0,0.7)' }
        ]
      },
      options: {
        responsive:true,
        scales:{
          x:{ticks:{color:"#fff"}},
          y:{ticks:{color:"#fff"}}
        }
      }
    });

    dijkstraBox.innerHTML = `Dijkstra<br>Time:${d.time} ms<br>Cost:${d.cost}<br>Hops:${d.hops}`;
    astarBox.innerHTML = `A*<br>Time:${a.time} ms<br>Cost:${a.cost}<br>Hops:${a.hops}`;

    finalWinnerText =
      (a.time < d.time) ? "🏆 A* is Faster" :
      (a.time > d.time) ? "🏆 Dijkstra is Faster" :
      "⚖ Equal Performance";
  };

  window.backToMain = function () {
    comparisonPage.style.display = "none";
    app.style.display = "block";
  };

  window.resetNetwork = function () {
    location.reload();
  };

});

// ---------- FINAL ANALYSIS FLOW ----------
function startAnalysis() {

  const box = document.getElementById("analysisBox");
  const winner = document.getElementById("winner");
  const explain = document.getElementById("explainBox");

  winner.style.display = "none";
  explain.style.display = "none";

  box.style.display = "block";
  box.innerHTML = "🧠 Analyzing...";

  setTimeout(() => {
    box.innerHTML = "📊 Comparing stats...";
  }, 1200);

  setTimeout(() => {
    box.innerHTML = "⚡ Finalizing...";
  }, 2500);

  setTimeout(() => {
    box.style.display = "none";

    winner.style.display = "block";
    winner.innerText = finalWinnerText;

    winner.style.textShadow = "0 0 20px #00ffcc, 0 0 40px #00ffcc";

    startSparkles(); // 🎉 trigger here
  }, 4000);

  setTimeout(() => {
    explain.style.display = "block";
  }, 5200);
}


// 🔥 FULL SCREEN SPARKLES (ONLY ONE FUNCTION)
function startSparkles() {

  const canvas = document.getElementById("sparkles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let sparks = [];

  for (let i = 0; i < 250; i++) {
    sparks.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 1,
      size: Math.random() * 3 + 1,
      life: Math.random() * 100 + 80
    });
  }

  function animateSparkles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sparks.forEach(s => {

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);

      ctx.fillStyle = "rgba(0,255,255,0.9)";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00ffff";

      ctx.fill();

      s.x += s.vx;
      s.y += s.vy;
      s.life--;

      if (s.y > canvas.height || s.life <= 0) {
        s.x = Math.random() * canvas.width;
        s.y = -10;
        s.life = Math.random() * 100 + 80;
      }
    });

    requestAnimationFrame(animateSparkles);
  }

  animateSparkles();
}