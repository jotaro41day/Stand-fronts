import Peer from 'peerjs';
import { ACTOR_IDS, CONNECTION_TIMEOUT_MS, GAME_VERSION, INPUT_INTERVAL_MS,
  InputGate, makeRoomCode, normalizeRoomCode, packAction, packInput,
  packSnapshot, roomPeerId, ROOM_SILENCE_MS, SNAPSHOT_INTERVAL_MS,
  unpackSnapshot } from './protocol.js';

const SLOT_TEAMS = { 'ally-left': 'blue', 'ally-right': 'blue',
  'enemy-left': 'red', 'enemy-center': 'red', 'enemy-right': 'red' };
const CHOICES = new Set(['johnny', 'kira']);
const peerError = error => {
  if (error?.type === 'peer-unavailable') return 'Sala não encontrada. Confira o código.';
  if (error?.type === 'browser-incompatible') return 'Este navegador não suporta WebRTC.';
  if (error?.type === 'unavailable-id') return 'Este código de sala já está em uso.';
  return `Falha na conexão P2P: ${error?.message ?? 'servidor de sinalização indisponível'}.`;
};
const safeChoice = value => CHOICES.has(value) ? value : 'johnny';
const safeTeam = value => value === 'red' ? 'red' : 'blue';

function slotFor(team, occupied, previous = null) {
  if (previous && SLOT_TEAMS[previous] === team) return previous;
  return Object.keys(SLOT_TEAMS).find(id => SLOT_TEAMS[id] === team && !occupied.has(id)) ?? null;
}

export class RoomHost {
  constructor({ characterId = 'johnny', onLobby = () => {}, onError = () => {} } = {}) {
    this.characterId = safeChoice(characterId);
    this.onLobby = onLobby;
    this.onError = onError;
    this.clients = new Map();
    this.started = false;
    this.snapshotSequence = 0;
    this.eventSequence = 0;
    this.recentEvents = [];
  }

  async open() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeRoomCode();
      const peer = new Peer(roomPeerId(code));
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Tempo esgotado ao criar a sala (10 s).')),
            CONNECTION_TIMEOUT_MS);
          peer.once('open', () => { clearTimeout(timer); resolve(); });
          peer.once('error', error => { clearTimeout(timer); reject(error); });
        });
        this.peer = peer;
        this.code = code;
        peer.on('connection', connection => this.acceptConnection(connection));
        peer.on('error', error => this.onError(peerError(error)));
        this.heartbeatTimer = setInterval(() => this.heartbeat(), 1000);
        this.broadcastLobby();
        return code;
      } catch (error) {
        peer.destroy();
        if (error?.type === 'unavailable-id' && attempt < 3) continue;
        throw new Error(error?.type ? peerError(error) : error.message);
      }
    }
    throw new Error('Não foi possível gerar um código livre.');
  }

  acceptConnection(connection) {
    if (connection.label !== 'events') { connection.close(); return; }
    const peerId = connection.peer;
    if (this.clients.has(peerId)) { connection.close(); return; }
    const client = { peerId, connection, fast: null, actorId: null,
      characterId: 'johnny', gate: new InputGate(), joined: false };
    this.clients.set(peerId, client);
    connection.on('open', () => {
      const pc = connection.peerConnection;
      if (!pc) return;
      const peerJsHandler = pc.ondatachannel;
      pc.ondatachannel = event => {
        if (event.channel.label !== 'fast') { peerJsHandler?.(event); return; }
        if (client.fast) { event.channel.close(); return; }
        client.fast = event.channel;
        client.fast.onmessage = message => {
          try { client.gate.acceptInput(JSON.parse(message.data), performance.now()); }
          catch { /* malformed fast packet is ignored */ }
        };
        client.fast.onclose = () => this.removeClient(peerId);
      };
    });
    connection.on('data', message => this.handleReliable(client, message));
    connection.on('close', () => this.removeClient(peerId));
    connection.on('error', () => this.removeClient(peerId));
  }

  handleReliable(client, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      if (client.joined) return;
      if (message.version !== GAME_VERSION) {
        client.connection.send({ type: 'reject', reason:
          `Versão diferente: sala ${GAME_VERSION}, seu jogo ${message.version ?? 'desconhecida'}. Atualize a página.` });
        setTimeout(() => client.connection.close(), 100);
        return;
      }
      if (this.started) {
        client.connection.send({ type: 'reject', reason: 'A partida já começou.' });
        setTimeout(() => client.connection.close(), 100);
        return;
      }
      const occupied = new Set([...this.clients.values()].map(item => item.actorId).filter(Boolean));
      const preferred = safeTeam(message.team);
      client.actorId = slotFor(preferred, occupied) ??
        slotFor(preferred === 'blue' ? 'red' : 'blue', occupied);
      if (!client.actorId) {
        client.connection.send({ type: 'reject', reason: 'Sala cheia (máximo de 6 jogadores).' });
        setTimeout(() => client.connection.close(), 100);
        return;
      }
      client.characterId = safeChoice(message.characterId);
      client.joined = true;
      client.connection.send({ type: 'welcome', actorId: client.actorId,
        code: this.code, version: GAME_VERSION });
      this.broadcastLobby();
      return;
    }
    if (!client.joined) return;
    if (message.type === 'choice' && !this.started) {
      const team = safeTeam(message.team);
      const occupied = new Set([...this.clients.values()]
        .filter(other => other !== client).map(other => other.actorId).filter(Boolean));
      const slot = slotFor(team, occupied, client.actorId);
      if (slot) client.actorId = slot;
      client.characterId = safeChoice(message.characterId);
      this.broadcastLobby();
    } else if (message.type === 'action' && this.started) {
      client.gate.acceptAction(message.action);
    }
  }

  lobby() {
    const players = [{ actorId: 'johnny', name: 'Host', team: 'blue',
      characterId: this.characterId, human: true }];
    for (const client of this.clients.values()) {
      if (!client.joined) continue;
      players.push({ actorId: client.actorId, name: `Jogador ${players.length + 1}`,
        team: SLOT_TEAMS[client.actorId], characterId: client.characterId, human: true });
    }
    for (const actorId of ACTOR_IDS) {
      if (!players.some(player => player.actorId === actorId)) players.push({ actorId,
        name: 'Bot', team: actorId.startsWith('enemy') ? 'red' : 'blue',
        characterId: actorId === 'ally-left' || actorId === 'enemy-left' ? 'kira' : 'johnny',
        human: false });
    }
    return { code: this.code, players };
  }

  broadcastLobby() {
    const lobby = this.lobby();
    this.onLobby(lobby);
    for (const client of this.clients.values()) {
      if (client.joined && client.connection.open)
        client.connection.send({ type: 'lobby', ...lobby, actorId: client.actorId });
    }
  }

  heartbeat() {
    const now = performance.now();
    for (const client of [...this.clients.values()]) {
      if (this.started && now - Math.max(this.startedAt, client.gate.lastAt) > ROOM_SILENCE_MS) {
        this.removeClient(client.peerId);
      } else if (client.joined && client.connection.open) {
        client.connection.send({ type: 'ping' });
      }
    }
  }

  start(gameFactory) {
    if (this.started) return;
    const roster = Object.fromEntries(this.lobby().players.map(player =>
      [player.actorId, player.characterId]));
    const remoteGates = new Map([...this.clients.values()]
      .filter(client => client.joined).map(client => [client.actorId, client.gate]));
    this.game = gameFactory(roster, remoteGates, event => this.sendEvent(event));
    this.started = true;
    this.startedAt = performance.now();
    for (const client of this.clients.values()) {
      if (client.joined && client.connection.open)
        client.connection.send({ type: 'start', roster, actorId: client.actorId,
          version: GAME_VERSION });
    }
    this.snapshotTimer = setInterval(() => this.broadcastSnapshot(), SNAPSHOT_INTERVAL_MS);
    this.broadcastSnapshot();
  }

  sendEvent(event) {
    const wire = [++this.eventSequence, event.type, ACTOR_IDS.indexOf(event.actorId),
      ACTOR_IDS.indexOf(event.ownerId), event.damage ?? 0,
      Math.round((event.x ?? 0) * 4), Math.round((event.y ?? 0) * 4)];
    this.recentEvents.push(wire);
    if (this.recentEvents.length > 8) this.recentEvents.shift();
    for (const client of this.clients.values()) {
      if (client.joined && client.connection.open)
        client.connection.send({ type: 'game-event', event: wire });
    }
  }

  broadcastSnapshot() {
    if (!this.game) return;
    const wire = packSnapshot(this.game, performance.now(), ++this.snapshotSequence,
      this.recentEvents);
    for (const client of this.clients.values()) {
      if (!client.joined || client.fast?.readyState !== 'open' ||
          client.fast.bufferedAmount > 64_000) continue;
      client.fast.send(JSON.stringify({ ...wire, ack: client.gate.lastSeq }));
    }
  }

  removeClient(peerId) {
    const client = this.clients.get(peerId);
    if (!client) return;
    this.clients.delete(peerId);
    client.fast?.close();
    client.connection.close();
    if (this.started && client.actorId) this.game?.releaseRemotePlayer(client.actorId);
    this.broadcastLobby();
  }

  close() {
    clearInterval(this.snapshotTimer);
    clearInterval(this.heartbeatTimer);
    for (const client of [...this.clients.values()]) this.removeClient(client.peerId);
    this.peer?.destroy();
  }
}

export class RoomClient {
  constructor({ code, characterId = 'johnny', team = 'blue',
    onLobby = () => {}, onStart = () => {}, onSnapshot = () => {},
    onEvent = () => {}, onHostGone = () => {} }) {
    this.code = normalizeRoomCode(code);
    this.characterId = safeChoice(characterId);
    this.team = safeTeam(team);
    this.onLobby = onLobby;
    this.onStart = onStart;
    this.onSnapshot = onSnapshot;
    this.onEvent = onEvent;
    this.onHostGone = onHostGone;
    this.lastSnapshot = -1;
    this.seenEvents = new Set();
    this.inputSequence = 0;
    this.actionSequence = 0;
    this.intentionalClose = false;
  }

  async open() {
    if (!this.code) throw new Error('Digite um código de sala de 5 caracteres.');
    this.peer = new Peer();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.close();
        reject(error instanceof Error ? error : new Error(error));
      };
      const timer = setTimeout(() => fail('A conexão P2P falhou após 10 s. Confira o código e a rede.'),
        CONNECTION_TIMEOUT_MS);
      this.peer.on('error', error => fail(peerError(error)));
      this.peer.once('open', () => {
        this.connection = this.peer.connect(roomPeerId(this.code), {
        label: 'events', reliable: true, serialization: 'json',
        });
        this.connection.on('open', () => this.connection.send({ type: 'hello',
          version: GAME_VERSION, characterId: this.characterId, team: this.team }));
        this.connection.on('data', message => {
        this.lastHostAt = performance.now();
        if (message?.type === 'reject') { fail(message.reason); return; }
        if (message?.type === 'welcome') {
          this.actorId = message.actorId;
          const pc = this.connection.peerConnection;
          if (!pc) { fail('Canal WebRTC indisponível.'); return; }
          this.fast = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
          this.fast.onmessage = event => {
            try {
              const wire = JSON.parse(event.data);
              const snapshot = unpackSnapshot(wire);
              if (!snapshot || snapshot.sequence <= this.lastSnapshot) return;
              this.lastHostAt = performance.now();
              this.lastSnapshot = snapshot.sequence;
              snapshot.ack = wire.ack;
              this.onSnapshot(snapshot);
              for (const item of snapshot.events) this.deliverEvent(item);
            } catch { /* malformed snapshot is ignored */ }
          };
          this.fast.onopen = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            this.lastHostAt = performance.now();
            this.heartbeatTimer = setInterval(() => {
              if (performance.now() - this.lastHostAt > ROOM_SILENCE_MS) this.hostGone();
            }, 1000);
            resolve({ actorId: this.actorId, code: this.code });
          };
          this.fast.onclose = () => settled ? this.hostGone()
            : fail('Canal P2P fechado antes de entrar na sala.');
          return;
        }
        if (message?.type === 'lobby') {
          this.actorId = message.actorId ?? this.actorId;
          this.onLobby(message);
        }
        if (message?.type === 'start') {
          if (message.version !== GAME_VERSION) {
            fail(`Versão diferente: sala ${message.version}, seu jogo ${GAME_VERSION}.`);
            return;
          }
          this.onStart(message);
        }
        if (message?.type === 'game-event') this.deliverEvent(message.event);
        });
        this.connection.on('close', () => settled ? this.hostGone()
          : fail('Conexão P2P fechada antes de entrar na sala.'));
        this.connection.on('error', error => fail(peerError(error)));
      });
    });
  }

  deliverEvent(event) {
    if (!Array.isArray(event) || !Number.isSafeInteger(event[0]) ||
        this.seenEvents.has(event[0])) return;
    this.seenEvents.add(event[0]);
    if (this.seenEvents.size > 64) this.seenEvents.delete(this.seenEvents.values().next().value);
    this.onEvent({ id: event[0], type: event[1], actorId: ACTOR_IDS[event[2]],
      ownerId: ACTOR_IDS[event[3]], damage: event[4],
      x: event[5] / 4, y: event[6] / 4 });
  }

  choose(characterId, team) {
    this.characterId = safeChoice(characterId);
    this.team = safeTeam(team);
    if (this.connection?.open) this.connection.send({ type: 'choice',
      characterId: this.characterId, team: this.team });
  }

  sendInput(move, aim, actions = []) {
    if (!this.fast || this.fast.readyState !== 'open') return -1;
    const numbered = actions.slice(0, 4).map(item => ({ ...item, id: ++this.actionSequence }));
    const packet = packInput(++this.inputSequence, move, aim, numbered);
    this.fast.send(JSON.stringify(packet));
    for (const action of packet.e) if (this.connection.open)
      this.connection.send({ type: 'action', action });
    return packet.s;
  }

  hostGone() {
    if (this.intentionalClose) return;
    this.close();
    this.onHostGone('O host saiu da partida.');
  }

  close() {
    this.intentionalClose = true;
    clearInterval(this.heartbeatTimer);
    this.fast?.close();
    this.connection?.close();
    this.peer?.destroy();
  }
}
