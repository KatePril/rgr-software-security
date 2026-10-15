/** Wraps a plain adjacency map into topology-query helpers (neighbors, BFS shortest path). */
function createTopology(adjacency) {
    const nodeIds = Object.keys(adjacency);

    function neighborsOf(id) {
        return adjacency[id] || [];
    }

    function shortestPath(from, to) {
        if (from === to) return [from];
        const queue = [[from]];
        const visited = new Set([from]);
        while (queue.length) {
            const path = queue.shift();
            const last = path[path.length - 1];
            for (const next of neighborsOf(last)) {
                if (next === to) return [...path, next];
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push([...path, next]);
                }
            }
        }
        return null;
    }

    return { adjacency, nodeIds, neighborsOf, shortestPath };
}

// Builds a classic 2D grid-mesh adjacency map.
function createGridAdjacency(rows, cols) {
    const id = (r, c) => `${r}-${c}`;
    const adjacency = {};
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const neighbors = [];
            if (r > 0) neighbors.push(id(r - 1, c));
            if (r < rows - 1) neighbors.push(id(r + 1, c));
            if (c > 0) neighbors.push(id(r, c - 1));
            if (c < cols - 1) neighbors.push(id(r, c + 1));
            adjacency[id(r, c)] = neighbors;
        }
    }
    return adjacency;
}

function printGrid(rows, cols, { log = console.log } = {}) {
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) row.push(`[${r}-${c}]`);
        log('  ' + row.join(' - '));
        if (r < rows - 1) {
            log('  ' + Array(cols).fill('|').join('     '));
        }
    }
}

const GRID_ROWS = 3;
const GRID_COLS = 3;
const GRID_ADJACENCY = createGridAdjacency(GRID_ROWS, GRID_COLS);

module.exports = { createTopology, createGridAdjacency, printGrid, GRID_ROWS, GRID_COLS, GRID_ADJACENCY };
