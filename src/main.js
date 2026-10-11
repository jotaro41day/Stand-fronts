import { GemGame } from './game/GemGame.js';
import { RoomClient, RoomHost } from './network/room.js';
import { ACTOR_IDS, normalizeRoomCode } from './network/protocol.js';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './style.css';

const nativeAndroid = Capacitor.getPlatform() === 'android';
const gameScreen = registerPlugin('GameScreen');
const setScreenAwake = awake => nativeAndroid
  ? gameScreen.setAwake({ awake }).catch(error => console.warn('Tela ativa:', error))
  : Promise.resolve();

const selection = document.getElementById('character-select');
const lobbyScreen = document.getElementById('room-lobby');
const menuStatus = document.getElementById('menu-status');
const lobbyStatus = document.getElementById('lobby-status');
const lobbyPlayers = document.getElementById('lobby-players');
const lobbyCode = document.getElementById('lobby-code');
const lobbyCharacter = document.getElementById('lobby-character');
const lobbyTeam = document.getElementById('lobby-team');
const startButton = document.getElementById('start-room');
const codeInput = document.getElementById('room-code');
const preferredTeam = document.getElementById('preferred-team');
const modeButtons = ['offline-play', 'create-room', 'join-room']
  .map(id => document.getElementById(id));
let chosenCharacter = 'johnny';
let room = null;
let game = null;
let pendingSnapshots = [];
let pendingEvents = [];

const previousMessage = sessionStorage.getItem('stand-fronts-room-message');
if (previousMessage) {
  menuStatus.textContent = previousMessage;
  sessionStorage.removeItem('stand-fronts-room-message');
}

function setBusy(busy) { for (const button of modeButtons) button.disabled = busy; }

function showGame(characterId, options = {}) {
  try {
    game = new GemGame(characterId, options);
    void setScreenAwake(true);
    selection.hidden = true;
    lobbyScreen.hidden = true;
    return game;
  } catch (error) {
    console.error('Falha ao iniciar a arena 3D:', error);
    menuStatus.textContent = 'Este navegador precisa de WebGL para abrir a arena 3D.';
    throw error;
  }
}

function renderLobby(lobby) {
  lobbyCode.textContent = lobby.code;
  lobbyPlayers.replaceChildren();
  const players = [...lobby.players].sort((a, b) =>
    ACTOR_IDS.indexOf(a.actorId) - ACTOR_IDS.indexOf(b.actorId));
  for (const player of players) {
    const row = document.createElement('div');
    row.className = `lobby-player ${player.team}${player.human ? '' : ' bot'}`;
    const name = document.createElement('span');
    name.textContent = `${player.team === 'blue' ? 'AZUL' : 'VERMELHO'} · ${player.name}`;
    const character = document.createElement('em');
    character.textContent = player.characterId === 'kira' ? 'Kira' : 'Johnny';
    row.append(name, character);
    lobbyPlayers.appendChild(row);
  }
  const humans = players.filter(player => player.human).length;
  lobbyStatus.textContent = `${humans}/6 jogadores · vagas vazias serão bots`;
  if (room instanceof RoomClient) {
    const self = players.find(player => player.actorId === room.actorId);
    if (self) lobbyTeam.value = self.team;
  }
}

function showLobby(isHost) {
  selection.hidden = true;
  lobbyScreen.hidden = false;
  startButton.hidden = !isHost;
  lobbyTeam.disabled = isHost;
  lobbyTeam.value = isHost ? 'blue' : preferredTeam.value;
  lobbyCharacter.value = chosenCharacter;
  lobbyStatus.textContent = isHost ? 'Sala pronta. Inicie quando quiser.'
    : 'Conectado. Aguardando o host iniciar.';
}

document.querySelectorAll('[data-character]').forEach(button => {
  button.addEventListener('click', () => {
    chosenCharacter = button.dataset.character;
    document.querySelectorAll('[data-character]').forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
  });
});

document.getElementById('offline-play').addEventListener('click', () => {
  showGame(chosenCharacter);
});

document.getElementById('create-room').addEventListener('click', async () => {
  setBusy(true);
  menuStatus.textContent = 'Criando sala…';
  const host = new RoomHost({ characterId: chosenCharacter,
    onLobby: renderLobby, onError: message => { lobbyStatus.textContent = message; } });
  try {
    await host.open();
    room = host;
    showLobby(true);
    renderLobby(host.lobby());
    menuStatus.textContent = '';
  } catch (error) {
    host.close();
    menuStatus.textContent = error.message;
  } finally { setBusy(false); }
});

document.getElementById('join-room').addEventListener('click', async () => {
  const code = normalizeRoomCode(codeInput.value);
  if (!code) { menuStatus.textContent = 'Digite um código válido de 5 caracteres.'; return; }
  setBusy(true);
  menuStatus.textContent = 'Conectando…';
  const client = new RoomClient({ code, characterId: chosenCharacter,
    team: preferredTeam.value,
    onLobby: renderLobby,
    onStart: message => {
      if (game) return;
      showGame(message.roster[message.actorId], { role: 'client',
        localActorId: message.actorId, roster: message.roster, room: client });
      for (const snapshot of pendingSnapshots) game.receiveSnapshot(snapshot);
      for (const event of pendingEvents) game.applyNetworkEvent(event);
      pendingSnapshots = [];
      pendingEvents = [];
    },
    onSnapshot: snapshot => game ? game.receiveSnapshot(snapshot)
      : pendingSnapshots.push(snapshot),
    onEvent: event => game ? game.applyNetworkEvent(event) : pendingEvents.push(event),
    onHostGone: message => {
      sessionStorage.setItem('stand-fronts-room-message', message);
      window.location.reload();
    },
  });
  room = client;
  try {
    await client.open();
    if (!game) {
      showLobby(false);
      menuStatus.textContent = '';
    }
  } catch (error) {
    if (room === client) room = null;
    client.close();
    menuStatus.textContent = error.message;
  } finally { setBusy(false); }
});

for (const selector of [lobbyCharacter, lobbyTeam]) selector.addEventListener('change', () => {
  if (room instanceof RoomHost) {
    room.characterId = lobbyCharacter.value;
    room.broadcastLobby();
  } else if (room instanceof RoomClient) room.choose(lobbyCharacter.value, lobbyTeam.value);
});

startButton.addEventListener('click', () => {
  if (!(room instanceof RoomHost)) return;
  try {
    room.start((roster, remoteGates, onNetworkEvent) => showGame(room.characterId,
      { role: 'host', roster, remoteGates, onNetworkEvent }));
  } catch (error) {
    lobbyStatus.textContent = error.message;
  }
});

document.getElementById('leave-room').addEventListener('click', () => {
  room?.close();
  room = null;
  lobbyScreen.hidden = true;
  selection.hidden = false;
});

codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase(); });
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('standfronts:match-end', () => { void setScreenAwake(false); });
window.addEventListener('beforeunload', () => {
  room?.close();
  void setScreenAwake(false);
});

if (nativeAndroid) {
  void App.addListener('backButton', async () => {
    if (!game && !room) { await App.exitApp(); return; }
    await setScreenAwake(false);
    room?.close();
    window.location.reload();
  });
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL })
      .catch(error => console.warn('Cache offline:', error));
  });
}
