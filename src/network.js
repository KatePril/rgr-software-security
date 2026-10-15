const crypto = require('crypto');
const { transmitOverLink } = require('./transport');


class MeshNetwork {
    constructor({ topology, packetSize, packetDelayMs, logger = console.log }) {
        this.topology = topology;
        this.packetSize = packetSize;
        this.packetDelayMs = packetDelayMs;
        this.log = logger;
    }

    /** Unicasts `payloadObject` from `fromId` to `toId`, routed hop-by-hop along the shortest path. */
    async sendRaw(fromId, toId, payloadObject) {
        const path = this.topology.shortestPath(fromId, toId);
        if (!path) throw new Error(`No route from ${fromId} to ${toId}`);

        const buffer = Buffer.from(JSON.stringify(payloadObject), 'utf8');
        this.log(`[route] ${path.join(' -> ')} (${path.length - 1} hop(s), ${buffer.length}B payload, ${payloadObject.type})`);

        let current = buffer;
        for (let i = 0; i < path.length - 1; i++) {
            const hopFrom = path[i];
            const hopTo = path[i + 1];
            current = await transmitOverLink(current, {
                packetSize: this.packetSize,
                packetDelayMs: this.packetDelayMs,
                onPacket: (seq, total, size) => this.log(`  [${hopFrom} -> ${hopTo}] packet ${seq}/${total} (${size}B)`),
            });
        }
        return JSON.parse(current.toString('utf8'));
    }


    async broadcast(fromId, payloadObject, { ttl = this.topology.nodeIds.length } = {}) {
        const messageId = crypto.randomBytes(8).toString('hex');
        const buffer = Buffer.from(JSON.stringify(payloadObject), 'utf8');
        const visited = new Set([fromId]);
        let frontier = [fromId];
        let hop = 0;

        this.log(`[broadcast ${messageId}] originates at ${fromId} (${buffer.length}B payload)`);
        while (frontier.length && hop < ttl) {
            const nextFrontier = [];
            for (const node of frontier) {
                for (const neighbor of this.topology.neighborsOf(node)) {
                    if (visited.has(neighbor)) continue;
                    visited.add(neighbor);
                    nextFrontier.push(neighbor);
                    await transmitOverLink(buffer, {
                        packetSize: this.packetSize,
                        packetDelayMs: this.packetDelayMs,
                        onPacket: (seq, total, size) => this.log(`  [${node} -> ${neighbor}] packet ${seq}/${total} (${size}B)`),
                    });
                    this.log(`[broadcast ${messageId}] delivered to ${neighbor} via ${node}`);
                }
            }
            frontier = nextFrontier;
            hop++;
        }

        const unreached = this.topology.nodeIds.filter((id) => !visited.has(id));
        this.log(
            `[broadcast ${messageId}] reached ${visited.size}/${this.topology.nodeIds.length} node(s) in ${hop} hop(s)` +
                (unreached.length ? `, unreachable: ${unreached.join(', ')}` : ''),
        );
        return { messageId, reached: [...visited], hops: hop, unreached };
    }
}

module.exports = { MeshNetwork };
