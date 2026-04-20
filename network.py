import networkx as nx

def create_graph():
    G = nx.Graph()
    G.add_edge("S1", "S2", weight=1)
    G.add_edge("S2", "S3", weight=1)
    G.add_edge("S3", "S4", weight=1)
    G.add_edge("S1", "S3", weight=4)
    G.add_edge("S1", "S4", weight=10)
    return G

def get_shortest_path(G, source, destination):
    try:
        return nx.shortest_path(G, source, destination, weight="weight")
    except:
        return []