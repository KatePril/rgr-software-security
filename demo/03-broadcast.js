const { MeshNetwork } = require('../src/network');
const { createTopology, printGrid, GRID_ROWS, GRID_COLS, GRID_ADJACENCY } = require('../src/topology');

// One-to-all (broadcast) transmission over a grid-mesh topology
async function main() {
    console.log(`=== Розширений варіант: передача one-to-all у грід-мережі (${GRID_ROWS}x${GRID_COLS} = ${GRID_ROWS * GRID_COLS} вузлів) ===\n`);
    console.log("Топологія мережі (грід, зв'язки лише з ортогональними сусідами):");
    printGrid(GRID_ROWS, GRID_COLS);
    console.log();

    const network = new MeshNetwork({
        topology: createTopology(GRID_ADJACENCY),
        packetSize: 16,
        packetDelayMs: 10,
    });

    const sourceId = '1-1'; // central grid node
    const allNodes = Object.keys(GRID_ADJACENCY);
    console.log(`[one-to-all] Джерело: "${sourceId}". Отримувачі (усі інші вузли): ${allNodes.filter((id) => id !== sourceId).join(', ')}\n`);

    const result = await network.broadcast(sourceId, {
        type: 'OneToAll',
        text: 'Повідомлення one-to-all для всіх вузлів гріда',
    });

    console.log('\nПідсумок передачі one-to-all:', result);

    const allReached = allNodes.length === result.reached.length && result.unreached.length === 0;
    console.log(`\n[перевірка] Усі ${allNodes.length} вузли гріда (включно з джерелом) отримали повідомлення рівно один раз: ${allReached}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
