import networkx as nx

def draw_graph(G, pos, ax, canvas, path=None, packet_positions=None):
    ax.clear()

    path_edges = list(zip(path, path[1:])) if path else []

    edge_colors = []
    for edge in G.edges():
        if edge in path_edges or (edge[1], edge[0]) in path_edges:
            edge_colors.append("#ff4d4d")
        else:
            edge_colors.append("#888888")

    nx.draw(
        G, pos, ax=ax,
        with_labels=True,
        node_color="#4da6ff",
        node_size=2000,
        edge_color=edge_colors,
        width=2,
        font_weight="bold"
    )

    if packet_positions:
        for (x, y) in packet_positions:
            ax.scatter(x, y, s=200, c="#00ffcc")

    edge_labels = nx.get_edge_attributes(G, 'weight')
    nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, ax=ax)

    ax.set_title("SDN Network Simulator", fontsize=14)
    canvas.draw()