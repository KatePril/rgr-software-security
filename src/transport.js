const DEFAULT_PACKET_SIZE = 32; // bytes per packet - imitates a narrowband/slow radio link
const DEFAULT_PACKET_DELAY_MS = 15; // simulated per-packet transmission time

function chunk(buffer, packetSize) {
    const packets = [];
    for (let offset = 0; offset < buffer.length; offset += packetSize) {
        packets.push(buffer.subarray(offset, offset + packetSize));
    }
    if (packets.length === 0) packets.push(Buffer.alloc(0));
    return packets;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transmitOverLink(buffer, { packetSize = DEFAULT_PACKET_SIZE, packetDelayMs = DEFAULT_PACKET_DELAY_MS, onPacket } = {}) {
    const packets = chunk(buffer, packetSize);
    for (let i = 0; i < packets.length; i++) {
        await sleep(packetDelayMs);
        onPacket?.(i + 1, packets.length, packets[i].length);
    }
    return Buffer.concat(packets);
}

module.exports = { chunk, transmitOverLink, DEFAULT_PACKET_SIZE, DEFAULT_PACKET_DELAY_MS };
