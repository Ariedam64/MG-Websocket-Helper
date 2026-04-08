class Room {
  constructor(data) {
    this.roomId = data.roomId;
    this.roomSessionId = data.roomSessionId;
    this.hostPlayerId = data.hostPlayerId;
    this.selectedGame = data.selectedGame;
    this.dateRoomCreated = data.dateRoomCreated;
    this.dateGameBegan = data.dateGameBegan;
    this.isGameStarting = data.isGameStarting;
    this.timer = data.timer;
    this.chat = data.chat;
    this.gameVotes = data.gameVotes || {};
  }

  update(data) {
    if (data.roomId) this.roomId = data.roomId;
    if (data.roomSessionId) this.roomSessionId = data.roomSessionId;
    if (data.hostPlayerId) this.hostPlayerId = data.hostPlayerId;
    if (data.selectedGame) this.selectedGame = data.selectedGame;
    if (data.timer) this.timer = data.timer;
    if (data.chat) this.chat = data.chat;
    if (data.gameVotes) this.gameVotes = data.gameVotes;
  }
}

module.exports = { Room };
