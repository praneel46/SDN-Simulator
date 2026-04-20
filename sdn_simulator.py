import tkinter as tk
from tkinter import ttk
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import networkx as nx

from network import create_graph, get_shortest_path
from visualization import draw_graph

class SDNSimulator:
    def __init__(self, root):
        self.root = root
        self.root.title("SDN Simulator")
        self.root.geometry("800x700")
        self.root.configure(bg="#1e1e1e")

        self.G = create_graph()
        self.pos = nx.spring_layout(self.G, seed=42)

        self.packets = []
        self.running = False

        self.source = tk.StringVar(value="S1")
        self.destination = tk.StringVar(value="S4")
        self.speed = tk.DoubleVar(value=1)
        self.status = tk.StringVar(value="Ready")

        self.setup_ui()
        draw_graph(self.G, self.pos, self.ax, self.canvas)

    def setup_ui(self):
        self.fig, self.ax = plt.subplots(figsize=(5, 5))
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.root)
        self.canvas.get_tk_widget().pack(pady=10)

        frame = tk.Frame(self.root, bg="#1e1e1e")
        frame.pack()

        nodes = list(self.G.nodes())

        ttk.Label(frame, text="Source").grid(row=0, column=0)
        ttk.Combobox(frame, textvariable=self.source, values=nodes, width=5).grid(row=0, column=1)

        ttk.Label(frame, text="Destination").grid(row=0, column=2)
        ttk.Combobox(frame, textvariable=self.destination, values=nodes, width=5).grid(row=0, column=3)

        tk.Label(self.root, textvariable=self.status, bg="#1e1e1e", fg="white").pack()

        controls = tk.Frame(self.root, bg="#1e1e1e")
        controls.pack(pady=10)

        tk.Button(controls, text="Start", command=self.start, bg="#2e8b57", fg="white").grid(row=0, column=0, padx=10)
        tk.Button(controls, text="Stop", command=self.stop, bg="#444", fg="white").grid(row=0, column=1, padx=10)
        tk.Button(controls, text="Fail Link", command=self.fail_link, bg="#b22222", fg="white").grid(row=0, column=2, padx=10)
        tk.Button(controls, text="Reset", command=self.reset, bg="#1e90ff", fg="white").grid(row=0, column=3, padx=10)

        tk.Label(self.root, text="Speed", bg="#1e1e1e", fg="white").pack()
        tk.Scale(self.root, from_=0.2, to=2, resolution=0.1,
                 orient=tk.HORIZONTAL, variable=self.speed).pack()

    def get_path(self):
        return get_shortest_path(self.G, self.source.get(), self.destination.get())

    def animate(self):
        if not self.running:
            return

        new_positions = []

        for packet in self.packets:
            path, i, t = packet

            if i >= len(path) - 1:
                continue

            start = path[i]
            end = path[i + 1]

            x1, y1 = self.pos[start]
            x2, y2 = self.pos[end]

            x = x1 + (x2 - x1) * t
            y = y1 + (y2 - y1) * t

            new_positions.append((x, y))

            t += 0.05
            if t >= 1:
                i += 1
                t = 0

            packet[1] = i
            packet[2] = t

        draw_graph(self.G, self.pos, self.ax, self.canvas, self.get_path(), new_positions)

        self.root.after(int(50 * self.speed.get()), self.animate)

    def start(self):
        path = self.get_path()

        if not path:
            self.status.set("No path available")
            return

        self.status.set(f"Running: {path}")

        self.packets = [[path, 0, 0] for _ in range(3)]
        self.running = True
        self.animate()

    def stop(self):
        self.running = False
        self.status.set("Stopped")

    def fail_link(self):
        if self.G.has_edge("S2", "S3"):
            self.G.remove_edge("S2", "S3")
            self.status.set("Link S2-S3 failed")

        draw_graph(self.G, self.pos, self.ax, self.canvas, self.get_path())

    def reset(self):
        self.G = create_graph()
        self.status.set("Network reset")
        draw_graph(self.G, self.pos, self.ax, self.canvas)
